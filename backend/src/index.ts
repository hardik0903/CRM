import dotenv from 'dotenv';
dotenv.config();

// ---------------------------------------------------------------------------
// Startup validation
// ---------------------------------------------------------------------------

if (!process.env.GEMINI_API_KEY) {
  console.error(
    '❌ GEMINI_API_KEY environment variable is not set. Please add it to your .env file.',
  );
  process.exit(1);
}

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import importRouter from './routes/import.js';

const app = express();

// Trust the first proxy hop (adjust number if you have multiple proxies, e.g. Railway + nginx)
app.set('trust proxy', 1);

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/** Enable CORS for the configured frontend origin. */
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === FRONTEND_URL) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

/** Rate limit API requests — max 10 per minute per IP. */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api', apiLimiter);

/** Parse JSON request bodies (up to 50 MB). */
app.use(express.json({ limit: '50mb' }));

/** Parse URL-encoded request bodies (up to 50 MB). */
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Mount the import API routes under /api. */
app.use('/api', importRouter);

/** Health-check endpoint. */
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  },
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const server = app.listen(PORT, () => {
  console.log(`🚀 CSV Importer backend listening on http://localhost:${PORT}`);
  console.log(`   Allowed origin: ${FRONTEND_URL}`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

/**
 * Handles graceful shutdown on SIGINT / SIGTERM by closing the HTTP server
 * and exiting the process cleanly.
 */
function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received — shutting down gracefully…`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force exit after 10 seconds if connections won't close
  setTimeout(() => {
    console.error('Forcing exit after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
