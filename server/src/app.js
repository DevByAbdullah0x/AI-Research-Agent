if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix { constructor() {} };
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData { constructor() {} };
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D { constructor() {} };
}

import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(sourceDirectory, '../.env') });

import authRoutes from './routes/authRoutes.js';
import researchRoutes from './routes/researchRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import researchHistoryRoutes from './routes/researchHistoryRoutes.js';
import { requireAuth } from './middleware/authMiddleware.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || true,
  credentials: true
}));
app.use(express.json({ limit: '32kb' }));

// Health check endpoint
app.get('/api/health', (req, res) => res.status(200).json({ success: true, status: 'ok' }));

// Public auth routes (send OTP, verify & register)
app.use('/api/auth', authRoutes);

// Protected application routes (requires Firebase JWT)
app.use('/api', requireAuth, researchRoutes);
app.use('/api', requireAuth, sessionRoutes);
app.use('/api', requireAuth, documentRoutes);
app.use('/api', requireAuth, researchHistoryRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
