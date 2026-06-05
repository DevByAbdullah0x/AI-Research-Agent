import { randomUUID } from 'node:crypto';
import { generateResearchAnswer, streamResearchAnswer } from '../services/geminiService.js';
import { searchWeb } from '../services/tavilyService.js';
import { findRelevantChunks } from '../services/documentService.js';
import { filterAndScoreSources } from '../services/credibilityService.js';
import { extractTopicTags } from './researchHistoryController.js';
import { AppError } from '../services/appError.js';
import { database } from '../db/database.js';

export function isDocumentDirectedQuery(query, hasAttachedDocs = false, docFilenames = []) {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase().trim();

  // Explicit document/file references
  const fileRefRegex = /\b(the|this|my|that|attached|uploaded)?\s*(file|files|document|documents|doc|docs|pdf|pdfs|guide|paper|attachment|attachments)\b/i;
  const overviewRegex = /\b(what('s| is| are)?\s*(in|inside|the content of)?|summarize|summary|overview|contents of|explain|tell me about|outline)\b/i;

  if (fileRefRegex.test(q)) return true;
  if (hasAttachedDocs && overviewRegex.test(q)) return true;

  if (Array.isArray(docFilenames) && docFilenames.length > 0) {
    for (const name of docFilenames) {
      const baseName = name.toLowerCase().replace(/\.[^.]+$/, '');
      const parts = baseName.split(/[-_\s]+/).filter((p) => p.length > 2);
      if (parts.length > 0 && parts.some((p) => q.includes(p))) {
        return true;
      }
    }
  }

  return false;
}

export async function research(req, res, next) {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) throw new AppError('Please enter a research question.', 400, 'INVALID_QUERY');
    if (query.length > 1000) throw new AppError('Your research question must be 1,000 characters or fewer.', 400, 'QUERY_TOO_LONG');

    const userId = req.user?.uid || null;
    let sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
    const depth = ['quick', 'standard', 'deep'].includes(req.body?.depth) ? req.body.depth : 'standard';
    let priorHistory = [];

    if (sessionId) {
      const existingSession = await database.getSession(sessionId, userId);
      if (existingSession) {
        priorHistory = existingSession.messages || [];
        if (!priorHistory.length) {
          await database.updateSessionTitle(sessionId, query.slice(0, 50), userId);
        }
      } else {
        await database.createSession({ id: sessionId, title: query.slice(0, 50), userId });
      }
    } else {
      sessionId = randomUUID();
      await database.createSession({ id: sessionId, title: query.slice(0, 50), userId });
    }

    const sessionDocs = await database.getDocuments(sessionId);
    const hasAttachedDocs = sessionDocs && sessionDocs.length > 0;
    const docFilenames = (sessionDocs || []).map((d) => d.filename);
    const isDocQuery = isDocumentDirectedQuery(query, hasAttachedDocs, docFilenames);

    const docSources = await findRelevantChunks(query, sessionId);

    let webSources = [];
    if (!isDocQuery || docSources.length === 0) {
      webSources = await searchWeb(query, depth);
    }
    const rawSources = [...docSources, ...webSources];

    const minCredibility = Number(req.body?.minCredibility) || 0;
    const excludeDomainTypes = Array.isArray(req.body?.excludeDomainTypes) ? req.body.excludeDomainTypes : [];
    const sources = filterAndScoreSources(rawSources, { minCredibility, excludeDomainTypes });

    const answer = await generateResearchAnswer(query, sources, priorHistory);

    // Persist user and assistant messages
    await database.createMessage({
      id: randomUUID(),
      sessionId,
      role: 'user',
      content: query
    });

    const assistantMessageId = randomUUID();
    await database.createMessage({
      id: assistantMessageId,
      sessionId,
      role: 'assistant',
      content: answer,
      sources
    });

    // Archive completed research run
    await database.createResearchRun({
      id: randomUUID(),
      sessionId,
      query,
      depth,
      answer,
      sources,
      topicTags: extractTopicTags(query),
      userId
    });

    res.status(200).json({ success: true, sessionId, query, answer, sources });
  } catch (error) {
    next(error);
  }
}

export async function streamResearch(req, res, next) {
  const abortController = new AbortController();

  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  function sendEvent(event, data) {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) throw new AppError('Please enter a research question.', 400, 'INVALID_QUERY');
    if (query.length > 1000) throw new AppError('Your research question must be 1,000 characters or fewer.', 400, 'QUERY_TOO_LONG');

    const userId = req.user?.uid || null;
    let sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
    const depth = ['quick', 'standard', 'deep'].includes(req.body?.depth) ? req.body.depth : 'standard';
    let priorHistory = [];

    if (sessionId) {
      const existingSession = await database.getSession(sessionId, userId);
      if (existingSession) {
        priorHistory = existingSession.messages || [];
        if (!priorHistory.length) {
          await database.updateSessionTitle(sessionId, query.slice(0, 50), userId);
        }
      } else {
        await database.createSession({ id: sessionId, title: query.slice(0, 50), userId });
      }
    } else {
      sessionId = randomUUID();
      await database.createSession({ id: sessionId, title: query.slice(0, 50), userId });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const sessionDocs = await database.getDocuments(sessionId);
    const hasAttachedDocs = sessionDocs && sessionDocs.length > 0;
    const docFilenames = (sessionDocs || []).map((d) => d.filename);
    const isDocQuery = isDocumentDirectedQuery(query, hasAttachedDocs, docFilenames);

    sendEvent('session', { sessionId });
    if (isDocQuery && hasAttachedDocs) {
      sendEvent('stage', { stage: 0, text: 'Reading and analyzing attached document…' });
    } else {
      sendEvent('stage', { stage: 0, text: depth === 'deep' ? 'Generating sub-queries & deep searching…' : 'Searching the web…' });
    }

    if (abortController.signal.aborted) return res.end();

    const docSources = await findRelevantChunks(query, sessionId);

    let webSources = [];
    if (!isDocQuery || docSources.length === 0) {
      webSources = await searchWeb(query, depth);
    }
    const rawSources = [...docSources, ...webSources];

    const minCredibility = Number(req.body?.minCredibility) || 0;
    const excludeDomainTypes = Array.isArray(req.body?.excludeDomainTypes) ? req.body.excludeDomainTypes : [];
    const sources = filterAndScoreSources(rawSources, { minCredibility, excludeDomainTypes });

    if (isDocQuery && hasAttachedDocs) {
      sendEvent('stage', { stage: 1, text: 'Extracting key document sections & citations…' });
    } else {
      sendEvent('stage', { stage: 1, text: 'Analyzing sources…' });
    }
    sendEvent('sources', { sources });

    if (abortController.signal.aborted) return res.end();

    sendEvent('stage', { stage: 2, text: 'Generating research response…' });

    const answer = await streamResearchAnswer(
      query,
      sources,
      priorHistory,
      (token) => {
        sendEvent('token', { token });
      },
      abortController.signal
    );

    if (abortController.signal.aborted) {
      return res.end();
    }

    // Persist messages upon successful completion
    await database.createMessage({
      id: randomUUID(),
      sessionId,
      role: 'user',
      content: query
    });

    const assistantMessageId = randomUUID();
    await database.createMessage({
      id: assistantMessageId,
      sessionId,
      role: 'assistant',
      content: answer,
      sources
    });

    // Archive completed research run
    await database.createResearchRun({
      id: randomUUID(),
      sessionId,
      query,
      depth,
      answer,
      sources,
      topicTags: extractTopicTags(query),
      userId
    });

    sendEvent('complete', {
      sessionId,
      query,
      answer,
      sources,
      messageId: assistantMessageId
    });

    res.end();
  } catch (error) {
    if (res.headersSent) {
      sendEvent('error', {
        error: error.message || 'An error occurred during research.',
        code: error.code || 'RESEARCH_ERROR'
      });
      res.end();
    } else {
      next(error);
    }
  }
}
