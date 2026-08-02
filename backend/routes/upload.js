import express from 'express';
import { upload, useS3, uploadToS3 } from '../config/s3.js';

const router = express.Router();

// POST /api/upload - upload a single file and return URL
router.post('/', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('[Upload Route Error]', err);
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please attach a file using the "file" field.' });
    }

    try {
      if (useS3) {
        const { url } = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype);
        return res.status(201).json({ message: 'File uploaded to S3 successfully.', url });
      }

      const localUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      return res.status(201).json({ message: 'File saved locally.', url: localUrl });
    } catch (error) {
      console.error('[Upload Route Error]', error);
      res.status(500).json({ message: 'Could not upload file.', error: error.message });
    }
  });
});

export default router;
