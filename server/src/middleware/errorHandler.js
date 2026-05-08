import { AppError } from '../services/appError.js';

export function notFound(req, res) {
  res.status(404).json({ success: false, error: 'Route not found.', code: 'NOT_FOUND' });
}

export function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const isKnown = error instanceof AppError;
  const status = isKnown ? error.statusCode : 500;
  if (!isKnown) console.error('Unexpected server error:', error);
  res.status(status).json({
    success: false,
    error: isKnown ? error.message : 'Something unexpected happened. Please try again.',
    code: isKnown ? error.code : 'INTERNAL_ERROR'
  });
}
