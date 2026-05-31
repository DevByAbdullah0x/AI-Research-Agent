import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  extractTextFromBuffer,
  chunkDocumentPages,
  findRelevantChunks
} from '../src/services/documentService.js';
import { database } from '../src/db/database.js';

describe('PDF & Document Research', () => {
  const testSessionId = `test-doc-session-${randomUUID()}`;

  test('should extract text from TXT buffer and create page structure', async () => {
    const textContent = 'Quarterly Research Summary:\nOur AI research showed a 40% reduction in query latency when using streaming SSE compared to polling.';
    const buffer = Buffer.from(textContent, 'utf-8');

    const result = await extractTextFromBuffer(buffer, 'text/plain', 'summary.txt');
    assert.ok(result.text.includes('40% reduction'));
    assert.equal(result.pageCount, 1);
    assert.equal(result.pages[0].pageNumber, 1);
  });

  test('should chunk document pages with page number awareness', () => {
    const pages = [
      { pageNumber: 1, text: 'This is the introductory section of the first page about distributed systems and consensus.' },
      { pageNumber: 2, text: 'This is the second page discussing Raft protocol, leader election, and log replication details.' }
    ];

    const chunks = chunkDocumentPages(pages, 100, 20);
    assert.ok(chunks.length >= 2);
    assert.equal(chunks[0].pageNumber, 1);
    assert.ok(chunks.some((c) => c.pageNumber === 2));
  });

  test('should persist document and chunks in database and retrieve them', () => {
    database.createSession({ id: testSessionId, title: 'Document Test Session' });
    const docId = randomUUID();
    const doc = database.createDocument({
      id: docId,
      sessionId: testSessionId,
      filename: 'ai-architecture-whitepaper.pdf',
      mimeType: 'application/pdf',
      fileSize: 102400,
      pageCount: 5
    });

    assert.equal(doc.id, docId);
    assert.equal(doc.filename, 'ai-architecture-whitepaper.pdf');

    database.createDocumentChunk({
      id: randomUUID(),
      documentId: docId,
      pageNumber: 3,
      chunkIndex: 0,
      chunkText: 'Section 3.2: Retrieval-augmented generation with vector embeddings drastically increases factual accuracy.'
    });

    const chunks = database.getDocumentChunks(docId);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].page_number, 3);

    // Test findRelevantChunks
    const matches = findRelevantChunks('factual accuracy embeddings', testSessionId, 5);
    assert.ok(matches.length > 0);
    assert.equal(matches[0].filename, 'ai-architecture-whitepaper.pdf');
    assert.equal(matches[0].pageNumber, 3);
    assert.equal(matches[0].isDocument, true);

    // Cleanup
    database.deleteDocument(docId);
    database.deleteSession(testSessionId);
    assert.equal(database.getDocumentChunks(docId).length, 0);
  });

  test('should detect document overview and meta queries accurately', async () => {
    const { isDocumentOverviewQuery } = await import('../src/services/documentService.js');
    const { isDocumentDirectedQuery } = await import('../src/controllers/researchController.js');

    assert.equal(isDocumentOverviewQuery("what's in the file?"), true);
    assert.equal(isDocumentOverviewQuery("what is in the file"), true);
    assert.equal(isDocumentOverviewQuery("summarize the document"), true);
    assert.equal(isDocumentOverviewQuery("what does this PDF talk about?"), true);
    assert.equal(isDocumentOverviewQuery("give me an overview of the file"), true);
    assert.equal(isDocumentOverviewQuery("quantum computing algorithms 2026"), false);

    assert.equal(isDocumentDirectedQuery("what's in the file?", true, ['MERN_Interview_Guide.pdf']), true);
    assert.equal(isDocumentDirectedQuery("summarize it", true, ['MERN_Interview_Guide.pdf']), true);
    assert.equal(isDocumentDirectedQuery("explain the MERN interview guide", true, ['MERN_Interview_Guide.pdf']), true);
    assert.equal(isDocumentDirectedQuery("how does solar energy work?", false, []), false);
  });

  test('should retrieve introductory and overview chunks for broad "what is in the file" queries', () => {
    const overviewSessionId = `overview-session-${randomUUID()}`;
    database.createSession({ id: overviewSessionId, title: 'Overview Test' });
    const docId = randomUUID();
    database.createDocument({
      id: docId,
      sessionId: overviewSessionId,
      filename: 'MERN_Interview_Guide.pdf',
      mimeType: 'application/pdf',
      fileSize: 50000,
      pageCount: 20
    });

    // Page 1: Title & Table of contents (does NOT have the word "file")
    database.createDocumentChunk({
      id: randomUUID(),
      documentId: docId,
      pageNumber: 1,
      chunkIndex: 0,
      chunkText: 'MERN Stack Interview Preparation Guide. Table of Contents: 1. React 2. Node.js 3. Express 4. MongoDB.'
    });

    // Page 16: File upload code with multiple occurrences of "file"
    database.createDocumentChunk({
      id: randomUUID(),
      documentId: docId,
      pageNumber: 16,
      chunkIndex: 1,
      chunkText: 'const file = req.file; upload.single("file"); file handling in multer middleware for file processing.'
    });

    // Query "what's in the file?" must return the introductory chunk (Page 1) first
    const chunks = findRelevantChunks("what's in the file?", overviewSessionId, 4);
    assert.ok(chunks.length > 0);
    assert.equal(chunks[0].pageNumber, 1, 'Page 1 should be prioritized for broad overview questions');
    assert.ok(chunks[0].snippet.includes('Table of Contents'));

    // Cleanup
    database.deleteDocument(docId);
    database.deleteSession(overviewSessionId);
  });

  test('should separate primary documents from web sources in buildPrompt and include grounding instructions', async () => {
    const { buildPrompt } = await import('../src/services/geminiService.js');

    const sources = [
      {
        title: 'MERN_Interview_Guide.pdf (Page 1)',
        url: 'doc://MERN_Interview_Guide.pdf#page=1',
        snippet: 'MERN Stack Interview Guide covering React, Node.js, Express, MongoDB.',
        isDocument: true
      },
      {
        title: 'Random FBI Surveillance Article',
        url: 'https://example.com/essay-on-files',
        snippet: 'An essay about inspecting government surveillance records and files.',
        isDocument: false
      }
    ];

    const prompt = buildPrompt("what's in the file?", sources);

    assert.ok(prompt.includes('PRIMARY ATTACHED DOCUMENTS (Uploaded by User):'));
    assert.ok(prompt.includes('EXTERNAL LIVE WEB SOURCES:'));
    assert.ok(prompt.includes('CRITICAL INSTRUCTIONS FOR ATTACHED DOCUMENTS:'));
    assert.ok(prompt.includes('referring EXCLUSIVELY to their uploaded document(s)'));
    assert.ok(prompt.includes('NEVER confuse external web articles or web search results with the user\'s uploaded file'));
  });

  test('should strictly isolate documents to their assigned session', () => {
    const session1 = `session-1-${randomUUID()}`;
    const session2 = `session-2-${randomUUID()}`;
    database.createSession({ id: session1, title: 'Chat 1' });
    database.createSession({ id: session2, title: 'Chat 2' });

    const docId = randomUUID();
    database.createDocument({
      id: docId,
      sessionId: session1,
      filename: 'Session1Only.pdf',
      mimeType: 'application/pdf',
      fileSize: 12000,
      pageCount: 2
    });

    // Chat 1 has the document
    const docs1 = database.getDocuments(session1);
    assert.equal(docs1.length, 1);
    assert.equal(docs1[0].filename, 'Session1Only.pdf');

    // Chat 2 must NOT have the document
    const docs2 = database.getDocuments(session2);
    assert.equal(docs2.length, 0);

    // Empty/new session must NOT have the document
    const docsNull = database.getDocuments(null);
    assert.equal(docsNull.length, 0);

    // Deleting session 1 should cascade delete its documents
    database.deleteSession(session1);
    database.deleteSession(session2);
    assert.equal(database.getDocuments(session1).length, 0);
  });
});
