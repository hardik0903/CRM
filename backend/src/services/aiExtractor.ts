import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  CRMRecord,
  ImportResult,
  RawCSVRecord,
  SkippedRecord,
} from '../types/crm.js';
import { buildExtractionPrompt } from '../utils/prompt.js';

/** Maximum number of records per Gemini API call. */
const BATCH_SIZE = 50;

/** Maximum number of retry attempts per batch. */
const MAX_RETRIES = 3;

/** Base delay (in ms) for exponential backoff. */
const BASE_DELAY_MS = 1_000;

/** Timeout (in ms) for each Gemini API call. */
const API_TIMEOUT_MS = 60_000;

/** Allowed CRM status values. */
const VALID_CRM_STATUSES = new Set([
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
  '',
]);

/** Allowed data source values. */
const VALID_DATA_SOURCES = new Set([
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
  '',
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ExtractionProgress {
  phase: 'started' | 'batch_started' | 'batch_completed' | 'completed';
  currentBatch: number;
  totalBatches: number;
  imported: number;
  skipped: number;
}

/**
 * Initialises and returns the Gemini generative model.
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
  return genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
}

/**
 * Strips markdown code fences (```json … ```) that the model sometimes
 * wraps around its JSON output.
 */
function stripCodeFences(text: string): string {
  let cleaned = text.trim();

  // Remove opening ```json or ``` fence
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    if (firstNewline !== -1) {
      cleaned = cleaned.slice(firstNewline + 1);
    }
  }

  // Remove closing ``` fence
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
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

function normalizeEmail(value: string): string {
  return EMAIL_PATTERN.test(value) ? value : '';
}

function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  return digits;
}

/**
 * Sanitises a raw CRM record from the AI response.
 *
 * - Ensures all 15 CRM fields exist, defaulting missing ones to empty string.
 * - Validates `crm_status` is one of the allowed enum values.
 * - Validates `data_source` is one of the allowed enum values.
 * - Validates `created_at` is parseable by JavaScript's `new Date()`.
 *
 * @param raw - The raw record object returned by the AI.
 * @returns A sanitised CRMRecord with valid values.
 */
export function sanitizeCRMRecord(raw: Partial<CRMRecord>): CRMRecord {
  const getString = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };

  const crmStatus = getString(raw.crm_status);
  const dataSource = getString(raw.data_source);
  const createdAt = getString(raw.created_at);
  const email = normalizeEmail(getString(raw.email));
  const mobile = normalizeMobile(getString(raw.mobile_without_country_code));

  // Validate created_at is parseable by new Date()
  let validCreatedAt = '';
  if (createdAt) {
    const date = new Date(createdAt);
    if (!isNaN(date.getTime())) {
      validCreatedAt = createdAt;
    }
  }

  return {
    created_at: validCreatedAt,
    name: getString(raw.name),
    email,
    country_code: getString(raw.country_code),
    mobile_without_country_code: mobile,
    company: getString(raw.company),
    city: getString(raw.city),
    state: getString(raw.state),
    country: getString(raw.country),
    lead_owner: getString(raw.lead_owner),
    crm_status: VALID_CRM_STATUSES.has(crmStatus)
      ? (crmStatus as CRMRecord['crm_status'])
      : '',
    crm_note: getString(raw.crm_note),
    data_source: VALID_DATA_SOURCES.has(dataSource)
      ? (dataSource as CRMRecord['data_source'])
      : '',
    possession_time: getString(raw.possession_time),
    description: getString(raw.description),
  };
}

/**
 * Processes a single batch of CSV records through Gemini and returns
 * extracted CRM records and skipped entries.
 *
 * Implements retry with exponential backoff (1 s → 2 s → 4 s).
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

      const cleanedJSON = stripCodeFences(responseText);
      const parsed = JSON.parse(cleanedJSON) as {
        extracted: CRMRecord[];
        skipped: Array<{ rowIndex: number; reason: string }>;
      };

      // Validate the response shape
      if (!Array.isArray(parsed.extracted)) {
        throw new Error(
          'Invalid Gemini response: "extracted" is not an array.',
        );
      }

      // Sanitise each extracted record, then enforce the assignment's
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

  // All retries exhausted — mark every record in this batch as skipped
  console.error(
    `[Batch ${batchIndex + 1}] All ${MAX_RETRIES} attempts failed. Skipping entire batch.`,
  );

  const skipped: SkippedRecord[] = records.map((record, idx) => ({
    rowIndex: idx + globalOffset,
    originalData: record,
    reason: `AI extraction failed after ${MAX_RETRIES} retries: ${lastError?.message ?? 'Unknown error'}`,
  }));

  return { extracted: [], skipped };
}

/**
 * Extracts CRM-formatted records from raw CSV data using Google Gemini.
 *
 * Records are split into batches of {@link BATCH_SIZE} and each batch is
 * processed sequentially. Failed batches are retried up to
 * {@link MAX_RETRIES} times with exponential backoff before the records
 * are marked as skipped.
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
    `Starting AI extraction: ${records.length} records in ${totalBatches} batch(es)`,
  );
  onProgress?.({
    phase: 'started',
    currentBatch: 0,
    totalBatches,
    imported: 0,
    skipped: 0,
  });

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, records.length);
    const batch = records.slice(start, end);

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

    onProgress?.({
      phase: 'batch_completed',
      currentBatch: i + 1,
      totalBatches,
      imported: allExtracted.length,
      skipped: allSkipped.length,
    });
  }

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
