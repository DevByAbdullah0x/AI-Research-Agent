if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix { constructor() {} };
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData { constructor() {} };
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D { constructor() {} };
}

import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import { randomUUID } from 'node:crypto';
import { database } from '../db/database.js';
import { AppError } from './appError.js';

/**
 * Extract text and page structures from uploaded file buffer
 */
export async function extractTextFromBuffer(buffer, mimeType, filename) {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    try {
      if (typeof globalThis.DOMMatrix === 'undefined') {
        globalThis.DOMMatrix = class DOMMatrix { constructor() {} };
      }
      if (typeof globalThis.ImageData === 'undefined') {
        globalThis.ImageData = class ImageData { constructor() {} };
      }
      if (typeof globalThis.Path2D === 'undefined') {
        globalThis.Path2D = class Path2D { constructor() {} };
      }

      const pdfModule = await import('pdf-parse');
      const PDFParse = pdfModule.PDFParse || pdfModule.default;
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const data = await parser.getText();
      const extractedText = (data.text || '').trim();

      // If text extraction yielded content, return it
      if (extractedText.length > 50) {
        const pages = Array.isArray(data.pages) && data.pages.length > 0
          ? data.pages.map((p) => ({ pageNumber: p.num || 1, text: (p.text || '').trim() }))
          : splitTextIntoEstimatedPages(extractedText, 2000);

        return {
          text: extractedText,
          pageCount: data.total || pages.length || 1,
          pages
        };
      }

      // OCR Fallback for scanned PDFs
      console.log(`PDF text extraction yielded <50 characters for ${filename}. Invoking OCR fallback...`);
      const worker = await createWorker('eng');
      const ret = await worker.recognize(buffer);
      await worker.terminate();

      return {
        text: ret.data.text.trim() || 'Scanned document with no readable text detected.',
        pageCount: 1,
        pages: [{ pageNumber: 1, text: ret.data.text.trim() }]
      };
    } catch (err) {
      throw new AppError(`Failed to extract text from PDF: ${err.message}`, 422, 'PDF_EXTRACTION_ERROR');
    }
  }

  if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || '').trim();
      return {
        text,
        pageCount: Math.max(1, Math.ceil(text.length / 2000)),
        pages: splitTextIntoEstimatedPages(text, 2000)
      };
    } catch (err) {
      throw new AppError(`Failed to extract text from DOCX: ${err.message}`, 422, 'DOCX_EXTRACTION_ERROR');
    }
  }

  if (ext === 'txt' || ext === 'md' || mimeType.startsWith('text/')) {
    const text = buffer.toString('utf-8').trim();
    return {
      text,
      pageCount: Math.max(1, Math.ceil(text.length / 2000)),
      pages: splitTextIntoEstimatedPages(text, 2000)
    };
  }

  throw new AppError(`Unsupported file format: ${filename}. Please upload a PDF, DOCX, or TXT file.`, 400, 'UNSUPPORTED_FILE_TYPE');
}

function splitPdfTextIntoPages(fullText, numPages) {
  // Approximate page breaks if form-feed exists, or distribute evenly
  if (fullText.includes('\f')) {
    const parts = fullText.split('\f').map((p) => p.trim()).filter(Boolean);
    return parts.map((text, idx) => ({ pageNumber: idx + 1, text }));
  }
  return splitTextIntoEstimatedPages(fullText, Math.max(500, Math.ceil(fullText.length / numPages)));
}

function splitTextIntoEstimatedPages(text, pageSize = 2000) {
  const pages = [];
  let currentOffset = 0;
  let pageNum = 1;

  while (currentOffset < text.length) {
    const slice = text.slice(currentOffset, currentOffset + pageSize);
    pages.push({ pageNumber: pageNum, text: slice });
    currentOffset += pageSize;
    pageNum += 1;
  }

  return pages.length > 0 ? pages : [{ pageNumber: 1, text }];
}

/**
 * Chunk document pages into overlapping segments of ~600 characters
 */
export function chunkDocumentPages(pages, chunkSize = 600, overlap = 100) {
  const chunks = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const pageText = page.text;
    if (!pageText) continue;

    let start = 0;
    while (start < pageText.length) {
      const end = Math.min(start + chunkSize, pageText.length);
      let segment = pageText.slice(start, end).trim();

      if (segment.length > 20) {
        chunks.push({
          chunkIndex: chunkIndex++,
          pageNumber: page.pageNumber,
          chunkText: segment
        });
      }

      if (end >= pageText.length) break;
      start += chunkSize - overlap;
    }
  }

  return chunks;
}

const STOP_AND_META_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was', 'one',
  'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see',
  'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'what',
  'whats', "what's", 'with', 'have', 'this', 'that', 'from', 'they', 'here', 'there', 'about',
  'into', 'more', 'some', 'such', 'than', 'them', 'then', 'these', 'many', 'most', 'other',
  'file', 'files', 'document', 'documents', 'doc', 'docs', 'pdf', 'pdfs', 'upload', 'uploaded',
  'attachment', 'attached', 'explain', 'tell', 'show', 'give', 'does', 'please', 'inside',
  'summary', 'summarize', 'overview', 'content', 'contents', 'mean', 'meaning'
]);

/**
 * Check if the query is an overview/meta question about an attached document
 */
export function isDocumentOverviewQuery(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase().trim();
  const overviewPatterns = [
    /\b(what('s| is| are| does)?|tell me about|explain|describe)\s+.*?\b(file|document|doc|pdf|guide|paper|attachment)\b/i,
    /\b(what\s+(is|does)\s+.*?\s+(about|say|cover|contain|discuss|talk about))\b/i,
    /\b(summarize|summary|overview|table of contents|outline|contents|topics|what topics)\b/i,
    /\b(what('s| is)\s+(in|inside)\s+(it|the file|this file|the doc|this doc|the document|this document|the pdf|this pdf))\b/i,
    /\bwhat\s+(is|does)\s+it\s+(say|mean|talk about|cover)\b/i
  ];
  return overviewPatterns.some((pattern) => pattern.test(q));
}

/**
 * Calculate relevance score between query terms and chunk text (BM25 / TF-IDF style)
 */
function scoreChunkRelevance(query, chunkText) {
  const allTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 2);

  const meaningfulTerms = allTerms.filter((term) => !STOP_AND_META_WORDS.has(term));
  const searchTerms = meaningfulTerms.length > 0 ? meaningfulTerms : allTerms;

  if (!searchTerms.length) return 0;

  const textLower = chunkText.toLowerCase();
  let score = 0;

  for (const term of searchTerms) {
    const matches = (textLower.match(new RegExp(`\\b${term}`, 'g')) || []).length;
    if (matches > 0) {
      score += 1 + Math.log(1 + matches);
    }
  }

  // Exact phrase match bonus if meaningful
  if (meaningfulTerms.length > 0 && textLower.includes(meaningfulTerms.join(' '))) {
    score += 5;
  }

  return score;
}

/**
 * Find relevant document chunks for a research query
 */
export async function findRelevantChunks(query, sessionId = null, limit = 6) {
  const allChunks = await database.getAllDocumentChunks(sessionId);
  if (!allChunks || allChunks.length === 0) {
    return [];
  }

  const isOverview = isDocumentOverviewQuery(query);

  const scored = allChunks
    .map((chunk) => ({
      documentId: chunk.document_id,
      filename: chunk.filename,
      pageNumber: chunk.page_number,
      chunkIndex: chunk.chunk_index ?? 0,
      snippet: chunk.chunk_text,
      score: scoreChunkRelevance(query, chunk.chunk_text)
    }))
    .sort((a, b) => b.score - a.score);

  let selected = [];

  if (isOverview || scored.every((s) => s.score <= 0.5)) {
    // For document overview queries or broad questions, ensure introductory
    // chunks (Page 1, table of contents, introduction) are prioritized,
    // plus representative samples distributed across the document.
    const sortedByIndex = [...allChunks].sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0));

    if (sortedByIndex.length <= limit) {
      selected = sortedByIndex.map((c) => ({
        filename: c.filename,
        pageNumber: c.page_number,
        snippet: c.chunk_text,
        score: 1.0
      }));
    } else {
      // Pick first 3 chunks (cover page, TOC, introduction)
      const introChunks = sortedByIndex.slice(0, Math.min(3, sortedByIndex.length));
      const remainingCount = limit - introChunks.length;
      const sampleChunks = [];

      if (remainingCount > 0) {
        const step = Math.max(1, Math.floor((sortedByIndex.length - 3) / remainingCount));
        for (let i = 3; i < sortedByIndex.length && sampleChunks.length < remainingCount; i += step) {
          sampleChunks.push(sortedByIndex[i]);
        }
      }

      selected = [...introChunks, ...sampleChunks].map((c) => ({
        filename: c.filename,
        pageNumber: c.page_number,
        snippet: c.chunk_text,
        score: 1.0
      }));
    }
  } else {
    // Specific keyword query: take highest scored chunks
    const topScored = scored.filter((item) => item.score > 0.5).slice(0, limit);

    // If top scored does not include page 1 / intro chunk, replace the lowest scored one with chunk 0
    const hasIntro = topScored.some((item) => item.pageNumber === 1 || item.chunkIndex === 0);
    if (!hasIntro && allChunks.length > 0 && topScored.length >= limit) {
      const firstChunk = [...allChunks].sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))[0];
      topScored[topScored.length - 1] = {
        filename: firstChunk.filename,
        pageNumber: firstChunk.page_number,
        snippet: firstChunk.chunk_text,
        score: 0.8
      };
    }
    selected = topScored;
  }

  return selected.map((item) => ({
    title: `${item.filename} (Page ${item.pageNumber})`,
    url: `doc://${encodeURIComponent(item.filename)}#page=${item.pageNumber}`,
    snippet: item.snippet,
    score: Math.min(0.99, 0.75 + (item.score || 1) * 0.03),
    isDocument: true,
    filename: item.filename,
    pageNumber: item.pageNumber
  }));
}

/**
 * Process and persist an uploaded file
 */
export async function processAndStoreDocument({ file, sessionId = null }) {
  const documentId = randomUUID();
  const filename = file.originalname;
  const mimeType = file.mimetype;
  const fileSize = file.size;

  const { text, pageCount, pages } = await extractTextFromBuffer(file.buffer, mimeType, filename);
  const chunks = chunkDocumentPages(pages);

  // Save document record
  const docRecord = await database.createDocument({
    id: documentId,
    sessionId,
    filename,
    mimeType,
    fileSize,
    pageCount
  });

  // Save chunks
  for (const chunk of chunks) {
    await database.createDocumentChunk({
      id: randomUUID(),
      documentId,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      chunkText: chunk.chunkText
    });
  }

  return {
    id: documentId,
    filename,
    pageCount,
    chunkCount: chunks.length,
    fileSize
  };
}
