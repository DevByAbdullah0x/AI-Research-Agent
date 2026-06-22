import { randomUUID } from 'node:crypto';
import { database } from '../db/database.js';
import { AppError } from '../services/appError.js';

export async function listSessions(req, res, next) {
  try {
    const userId = req.user?.uid || null;
    const sessions = await database.getSessions(userId);
    res.status(200).json({ success: true, sessions });
  } catch (error) {
    next(error);
  }
}

export async function createSession(req, res, next) {
  try {
    const userId = req.user?.uid || null;
    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const title = rawTitle || 'New Research Session';
    const id = randomUUID();
    const session = await database.createSession({ id, title, userId });
    res.status(201).json({ success: true, session: { ...session, messages: [] } });
  } catch (error) {
    next(error);
  }
}

export async function getSession(req, res, next) {
  try {
    const userId = req.user?.uid || null;
    const { id } = req.params;
    let session = await database.getSession(id, userId);
    if (!session) {
      session = await database.createSession({ id, title: 'Research Session', userId });
      return res.status(200).json({ success: true, session: { ...session, messages: [] } });
    }
    res.status(200).json({ success: true, session });
  } catch (error) {
    next(error);
  }
}

export async function updateSession(req, res, next) {
  try {
    const userId = req.user?.uid || null;
    const { id } = req.params;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) {
      throw new AppError('Session title cannot be empty.', 400, 'INVALID_SESSION_TITLE');
    }
    let session = await database.updateSessionTitle(id, title, userId);
    if (!session) {
      session = await database.createSession({ id, title, userId });
    }
    res.status(200).json({ success: true, session });
  } catch (error) {
    next(error);
  }
}

export async function deleteSession(req, res, next) {
  try {
    const userId = req.user?.uid || null;
    const { id } = req.params;
    await database.deleteSession(id, userId);
    res.status(200).json({ success: true, message: 'Session deleted successfully.' });
  } catch (error) {
    next(error);
  }
}
