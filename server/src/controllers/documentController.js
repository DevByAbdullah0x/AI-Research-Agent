import { database } from '../db/database.js';
import { processAndStoreDocument } from '../services/documentService.js';
import { AppError } from '../services/appError.js';

export async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('No file was uploaded. Please attach a PDF, DOCX, or TXT file.', 400, 'NO_FILE_ATTACHED');
    }

    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : null;
    const document = await processAndStoreDocument({
      file: req.file,
      sessionId
    });

    res.status(201).json({ success: true, document });
  } catch (error) {
    next(error);
  }
}

export async function listDocuments(req, res, next) {
  try {
    const sessionId = typeof req.query?.sessionId === 'string' ? req.query.sessionId.trim() : null;
    const documents = await database.getDocuments(sessionId);
    res.status(200).json({ success: true, documents });
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await database.deleteDocument(id);
    if (!deleted) {
      throw new AppError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
    }
    res.status(200).json({ success: true, message: 'Document deleted successfully.' });
  } catch (error) {
    next(error);
  }
}
