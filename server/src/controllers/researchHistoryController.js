import { randomUUID } from 'node:crypto';
import { database } from '../db/database.js';
import { searchWeb } from '../services/tavilyService.js';
import { findRelevantChunks } from '../services/documentService.js';
import { filterAndScoreSources } from '../services/credibilityService.js';
import { generateResearchAnswer } from '../services/geminiService.js';
import { AppError } from '../services/appError.js';

export function extractTopicTags(query) {
  const words = query
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['what', 'when', 'where', 'which', 'compare', 'about', 'explain', 'between', 'with', 'from', 'this', 'that'].includes(w.toLowerCase()));

  const uniqueWords = [...new Set(words)];
  return uniqueWords.slice(0, 4);
}

export async function listResearchRuns(req, res, next) {
  try {
    const userId = req.user?.uid || null;
    const { search = '', topic = '', startDate = '', endDate = '', limit = 50 } = req.query;
    const runs = await database.getResearchRuns({ userId, search, topic, startDate, endDate, limit });
    res.status(200).json({ success: true, runs });
  } catch (error) {
    next(error);
  }
}

export async function getResearchRun(req, res, next) {
  try {
    const userId = req.user?.uid || null;
    const { id } = req.params;
    const run = await database.getResearchRunById(id, userId);
    if (!run) {
      throw new AppError('Research run not found in archive.', 404, 'RUN_NOT_FOUND');
    }
    res.status(200).json({ success: true, run });
  } catch (error) {
    next(error);
  }
}

export async function rerunResearch(req, res, next) {
  try {
    const userId = req.user?.uid || null;
    const { id } = req.params;
    const run = await database.getResearchRunById(id, userId);
    if (!run) {
      throw new AppError('Research run not found in archive.', 404, 'RUN_NOT_FOUND');
    }

    const depth = run.depth || 'standard';
    const query = run.query;

    // Fetch fresh web sources and attached documents
    const docSources = await findRelevantChunks(query, run.session_id);
    const webSources = await searchWeb(query, depth);
    const rawSources = [...docSources, ...webSources];
    const sources = filterAndScoreSources(rawSources, {});

    // Generate fresh response
    const answer = await generateResearchAnswer(query, sources, []);

    // Update the research run record with fresh report & sources
    const updatedRun = await database.updateResearchRun(id, { answer, sources, depth }, userId);

    res.status(200).json({ success: true, run: updatedRun, message: 'Research run updated with fresh sources.' });
  } catch (error) {
    next(error);
  }
}

export async function deleteResearchRun(req, res, next) {
  try {
    const userId = req.user?.uid || null;
    const { id } = req.params;
    const deleted = await database.deleteResearchRun(id, userId);
    if (!deleted) {
      throw new AppError('Research run not found in archive.', 404, 'RUN_NOT_FOUND');
    }
    res.status(200).json({ success: true, message: 'Research run deleted successfully.' });
  } catch (error) {
    next(error);
  }
}
