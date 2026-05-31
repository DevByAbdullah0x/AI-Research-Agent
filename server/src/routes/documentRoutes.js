import { Router } from 'express';
import multer from 'multer';
import { uploadDocument, listDocuments, deleteDocument } from '../controllers/documentController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB limit
});

const router = Router();

router.post('/documents/upload', upload.single('file'), uploadDocument);
router.get('/documents', listDocuments);
router.delete('/documents/:id', deleteDocument);

export default router;

