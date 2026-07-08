import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'node:path';
import { parseCSV } from '../services/csvParser.js';
import { extractCRMRecords } from '../services/aiExtractor.js';

/**
 * Multer storage configuration — files are kept in memory as Buffers.
 */
const storage = multer.memoryStorage();

/**
 * Multer file filter — only allows `.csv` files.
 */
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.csv') {
    cb(new Error('Only .csv files are allowed.'));
    return;
  }
  cb(null, true);
};

/**
 * Configured Multer middleware instance.
 * - Single file upload under the field name `file`
 * - Maximum file size: 10 MB
 * - Only `.csv` extensions accepted
 */
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const router = Router();

/**
 * POST /import
 *
 * Accepts a CSV file upload, parses it, sends the records to Google Gemini
 * for intelligent CRM field extraction, and returns the result.
 *
 * @returns {ImportResult} JSON response with extracted records, skipped rows,
 *                         and aggregate totals.
 */
router.post(
  '/import',
  (req: Request, res: Response, next: NextFunction): void => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'File size exceeds the 10 MB limit.' });
          return;
        }
        res.status(400).json({ error: `Upload error: ${err.message}` });
        return;
      }
      if (err instanceof Error) {
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. Validate that a file was provided
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded. Please attach a CSV file.' });
        return;
      }

      console.log(
        `Received file: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`,
      );

      // 2. Parse the CSV file
      const { headers, records } = await parseCSV(req.file.buffer);

      if (records.length === 0) {
        res.status(400).json({ error: 'CSV file contains no data records.' });
        return;
      }

      console.log(
        `Parsed ${records.length} records with ${headers.length} columns: [${headers.join(', ')}]`,
      );

      // 3. Extract CRM records via AI
      const importResult = await extractCRMRecords(records, headers);

      // 4. Return the result
      res.status(200).json(importResult);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred.';
      console.error('Import failed:', message);
      res.status(500).json({ error: message });
    }
  },
);

export default router;
