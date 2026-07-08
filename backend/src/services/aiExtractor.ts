import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type {
  CRMRecord,
  ImportResult,
  RawCSVRecord,
  SkippedRecord,
} from '../types/crm.js';
import { CRMRecordSchema, GeminiResponseSchema } from '../types/schemas.js';
import { buildExtractionPrompt } from '../utils/prompt.js';
import { heuristicMapBatch } from './heuristicMapper.js';

/** Maximum number of records per Gemini API call. */
const BATCH_SIZE = 50;

/** Maximum number of retry attempts per batch. */
const MAX_RETRIES = 3;

/** Base delay (in ms) for exponential backoff. */
const BASE_DELAY_MS = 1_000;

/** Timeout (in ms) for each Gemini API call. */
const API_TIMEOUT_MS = 60_000;

/** Number of batches to process concurrently. */
const CONCURRENCY = 3;

export interface ExtractionProgress {
  phase: 'started' | 'batch_started' | 'batch_completed' | 'completed';
  currentBatch: number;
  totalBatches: number;
  imported: number;
  skipped: number;
}

/**
 * JSON Schema for Gemini's structured output.
 * Defines the exact shape of the response we expect, eliminating the need
 * for `stripCodeFences()` and prompt-based JSON enforcement.
 */
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    extracted: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          created_at: { type: SchemaType.STRING },
          name: { type: SchemaType.STRING },
          email: { type: SchemaType.STRING },
          country_code: { type: SchemaType.STRING },
          mobile_without_country_code: { type: SchemaType.STRING },
          company: { type: SchemaType.STRING },
          city: { type: SchemaType.STRING },
          state: { type: SchemaType.STRING },
          country: { type: SchemaType.STRING },
          lead_owner: { type: SchemaType.STRING },
          crm_status: { type: SchemaType.STRING },
          crm_note: { type: SchemaType.STRING },
          data_source: { type: SchemaType.STRING },
          possession_time: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
        },
        required: [
          'created_at',
          'name',
          'email',
          'country_code',
          'mobile_without_country_code',
          'company',
          'city',
          'state',
          'country',
          'lead_owner',
          'crm_status',
          'crm_note',
          'data_source',
          'possession_time',
          'description',
        ],
      },
    },
    skipped: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          rowIndex: { type: SchemaType.NUMBER },
          reason: { type: SchemaType.STRING },
        },
        required: ['rowIndex', 'reason'],
      },
    },
  },
  required: ['extracted', 'skipped'],
};

/**
 * Initialises and returns the Gemini generative model with structured
 * output configuration. The model will return valid JSON matching
 * {@link RESPONSE_SCHEMA} directly, without markdown code fences.
 *
 * @throws If the GEMINI_API_KEY environment variable is not set.
 */
function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Please add it to your .env file.',
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    } as any,
  });
}

/**
 * Pauses execution for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * the given number of milliseconds, the returned promise rejects.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Gemini API timed out after ${ms}ms`)),
      ms,
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Sanitises a raw CRM record from the AI response using Zod schema
 * validation. All fields are validated, normalised, and transformed.
 *
 * - Ensures all 15 CRM fields exist, defaulting missing ones to empty string.
 * - Validates `crm_status` is one of the allowed enum values.
 * - Validates `data_source` is one of the allowed enum values.
 * - Validates `created_at` is parseable by JavaScript's `new Date()`.
 * - Normalises email format and mobile digit extraction.
 *
 * @param raw - The raw record object returned by the AI.
 * @returns A sanitised CRMRecord with valid values.
 */
export function sanitizeCRMRecord(raw: Partial<CRMRecord>): CRMRecord {
  const result = CRMRecordSchema.safeParse(raw);
  if (result.success) {
    return result.data as CRMRecord;
  }

  // If Zod parsing fails entirely, log the error and return an empty record.
  // This should be extremely rare since all fields use z.any().transform().
  console.warn(
    '[sanitizeCRMRecord] Zod validation failed:',
    result.error.message,
  );
  return {
    created_at: '',
    name: '',
    email: '',
    country_code: '',
    mobile_without_country_code: '',
    company: '',
    city: '',
    state: '',
    country: '',
    lead_owner: '',
    crm_status: '',
    crm_note: '',
    data_source: '',
    possession_time: '',
    description: '',
  };
}

/**
 * Processes a single batch of CSV records through Gemini and returns
 * extracted CRM records and skipped entries.
 *
 * Implements retry with exponential backoff (1 s → 2 s → 4 s).
 * Falls back to heuristic mapping if all retries are exhausted.
 *
 * @param records      - The batch of raw CSV records.
 * @param headers      - Original CSV column headers.
 * @param batchIndex   - Zero-based index of this batch (for logging).
 * @param globalOffset - The row offset to add to skipped-row indices so
 *                       they reference the original CSV row numbers.
 */
async function processBatch(
  records: RawCSVRecord[],
  headers: string[],
  batchIndex: number,
  globalOffset: number,
): Promise<{ extracted: CRMRecord[]; skipped: SkippedRecord[] }> {
  const model = getModel();
  const prompt = buildExtractionPrompt(records, headers);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `[Batch ${batchIndex + 1}] Attempt ${attempt}/${MAX_RETRIES} — sending ${records.length} records to Gemini…`,
      );

      const result = await withTimeout(
        model.generateContent(prompt),
        API_TIMEOUT_MS,
      );
      const responseText = result.response.text();

      if (!responseText) {
        throw new Error('Gemini returned an empty response.');
      }

      // With structured output, Gemini returns valid JSON directly.
      // Parse and validate through Zod schema.
      const rawParsed = JSON.parse(responseText);
      const validated = GeminiResponseSchema.safeParse(rawParsed);

      if (!validated.success) {
        throw new Error(
          `Invalid Gemini response shape: ${validated.error.message}`,
        );
      }

      const parsed = validated.data;

      // Sanitise each extracted record via Zod, then enforce the
      // contactability rule even if the model forgets to skip a bad row.
      const sanitizedRecords = parsed.extracted.map(sanitizeCRMRecord);
      const extractedWithContact: CRMRecord[] = [];
      const contactlessSkipped: SkippedRecord[] = [];

      sanitizedRecords.forEach((record, idx) => {
        if (!record.email && !record.mobile_without_country_code) {
          contactlessSkipped.push({
            rowIndex: idx + globalOffset,
            originalData: records[idx] ?? {},
            reason: 'Missing both email and mobile number.',
          });
          return;
        }

        extractedWithContact.push(record);
      });

      // Map skipped entries to include original data and global row index
      const skipped: SkippedRecord[] = (parsed.skipped ?? []).map((s) => ({
        rowIndex: s.rowIndex + globalOffset,
        originalData: records[s.rowIndex] ?? {},
        reason: s.reason,
      }));
      skipped.push(...contactlessSkipped);

      console.log(
        `[Batch ${batchIndex + 1}] Extracted ${extractedWithContact.length} records, skipped ${skipped.length}`,
      );

      return { extracted: extractedWithContact, skipped };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[Batch ${batchIndex + 1}] Attempt ${attempt} failed: ${lastError.message}`,
      );

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`  ↳ Retrying in ${delay}ms…`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted — fall back to heuristic mapping instead of
  // skipping the entire batch.
  console.warn(
    `[Batch ${batchIndex + 1}] All ${MAX_RETRIES} attempts failed. Falling back to heuristic mapping.`,
  );

  return heuristicMapBatch(records, headers, globalOffset);
}

/**
 * Simple counting semaphore for limiting concurrency.
 */
class Semaphore {
  private queue: (() => void)[] = [];
  private running = 0;

  constructor(private readonly maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}

/**
 * Extracts CRM-formatted records from raw CSV data using Google Gemini.
 *
 * Records are split into batches of {@link BATCH_SIZE} and batches are
 * processed concurrently (up to {@link CONCURRENCY} at a time). Failed
 * batches are retried up to {@link MAX_RETRIES} times with exponential
 * backoff before falling back to heuristic mapping.
 *
 * @param records - All raw CSV records parsed from the uploaded file.
 * @param headers - The column headers from the original CSV.
 * @returns A complete {@link ImportResult} with extracted records, skipped
 *          rows, and aggregate counts.
 */
export async function extractCRMRecords(
  records: RawCSVRecord[],
  headers: string[],
  onProgress?: (progress: ExtractionProgress) => void,
): Promise<ImportResult> {
  const allExtracted: CRMRecord[] = [];
  const allSkipped: SkippedRecord[] = [];

  // Split into batches
  const totalBatches = Math.ceil(records.length / BATCH_SIZE);
  console.log(
    `Starting AI extraction: ${records.length} records in ${totalBatches} batch(es), concurrency=${CONCURRENCY}`,
  );
  onProgress?.({
    phase: 'started',
    currentBatch: 0,
    totalBatches,
    imported: 0,
    skipped: 0,
  });

  const semaphore = new Semaphore(CONCURRENCY);
  let completedBatches = 0;

  // Create batch tasks
  const batchTasks = Array.from({ length: totalBatches }, (_, i) => {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, records.length);
    const batch = records.slice(start, end);

    return async () => {
      await semaphore.acquire();
      try {
        onProgress?.({
          phase: 'batch_started',
          currentBatch: i + 1,
          totalBatches,
          imported: allExtracted.length,
          skipped: allSkipped.length,
        });

        const { extracted, skipped } = await processBatch(
          batch,
          headers,
          i,
          start,
        );

        allExtracted.push(...extracted);
        allSkipped.push(...skipped);
        completedBatches++;

        onProgress?.({
          phase: 'batch_completed',
          currentBatch: completedBatches,
          totalBatches,
          imported: allExtracted.length,
          skipped: allSkipped.length,
        });
      } finally {
        semaphore.release();
      }
    };
  });

  // Execute all batches with concurrency control
  await Promise.all(batchTasks.map((task) => task()));

  console.log(
    `AI extraction complete: ${allExtracted.length} imported, ${allSkipped.length} skipped`,
  );
  onProgress?.({
    phase: 'completed',
    currentBatch: totalBatches,
    totalBatches,
    imported: allExtracted.length,
    skipped: allSkipped.length,
  });

  return {
    records: allExtracted,
    skipped: allSkipped,
    totalImported: allExtracted.length,
    totalSkipped: allSkipped.length,
  };
}
