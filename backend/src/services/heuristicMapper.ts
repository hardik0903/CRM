import type { CRMRecord, RawCSVRecord, SkippedRecord } from '../types/crm.js';
import { CRMRecordSchema } from '../types/schemas.js';

/** Minimum ratio of values matching a pattern to consider a column as that type. */
const DETECTION_THRESHOLD = 0.3;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Column name patterns for common CRM fields (case-insensitive matching). */
const NAME_COLUMN_PATTERNS =
  /^(full[_\s]?name|name|contact[_\s]?name|first[_\s]?name|lead[_\s]?name|person|customer)$/i;
const EMAIL_COLUMN_PATTERNS =
  /^(email|e[_\s]?mail|email[_\s]?address|mail)$/i;
const PHONE_COLUMN_PATTERNS =
  /^(phone|mobile|cell|tel|telephone|contact|phone[_\s]?number|mobile[_\s]?number|contact[_\s]?number)$/i;
const COMPANY_COLUMN_PATTERNS =
  /^(company|org|organization|organisation|business|firm|employer)$/i;
const DATE_COLUMN_PATTERNS =
  /^(date|created[_\s]?at|created[_\s]?date|created|timestamp|time|signup[_\s]?date|registered)$/i;
const CITY_COLUMN_PATTERNS = /^(city|town|location)$/i;
const STATE_COLUMN_PATTERNS = /^(state|province|region)$/i;
const COUNTRY_COLUMN_PATTERNS = /^(country|nation)$/i;
const COUNTRY_CODE_PATTERNS =
  /^(country[_\s]?code|dial[_\s]?code|phone[_\s]?code|cc)$/i;

interface ColumnMapping {
  email?: string;
  phone?: string;
  name?: string;
  company?: string;
  date?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
}

/**
 * Detects which CSV columns correspond to CRM fields using a combination
 * of column name pattern matching and value content analysis.
 */
function detectColumns(
  records: RawCSVRecord[],
  headers: string[],
): ColumnMapping {
  const mapping: ColumnMapping = {};

  // Pass 1 — name-based matching
  for (const header of headers) {
    if (!mapping.email && EMAIL_COLUMN_PATTERNS.test(header)) {
      mapping.email = header;
    } else if (!mapping.phone && PHONE_COLUMN_PATTERNS.test(header)) {
      mapping.phone = header;
    } else if (!mapping.name && NAME_COLUMN_PATTERNS.test(header)) {
      mapping.name = header;
    } else if (!mapping.company && COMPANY_COLUMN_PATTERNS.test(header)) {
      mapping.company = header;
    } else if (!mapping.date && DATE_COLUMN_PATTERNS.test(header)) {
      mapping.date = header;
    } else if (!mapping.city && CITY_COLUMN_PATTERNS.test(header)) {
      mapping.city = header;
    } else if (!mapping.state && STATE_COLUMN_PATTERNS.test(header)) {
      mapping.state = header;
    } else if (!mapping.country && COUNTRY_COLUMN_PATTERNS.test(header)) {
      mapping.country = header;
    } else if (!mapping.countryCode && COUNTRY_CODE_PATTERNS.test(header)) {
      mapping.countryCode = header;
    }
  }

  // Pass 2 — content-based detection for email and phone if name-based failed
  if (!mapping.email || !mapping.phone) {
    const sampleSize = Math.min(records.length, 20);
    const sample = records.slice(0, sampleSize);

    for (const header of headers) {
      if (mapping.email && mapping.phone) break;

      const values = sample
        .map((r) => (r[header] ?? '').trim())
        .filter(Boolean);
      if (values.length === 0) continue;

      // Detect email column by @ presence
      if (!mapping.email) {
        const emailCount = values.filter((v) => EMAIL_PATTERN.test(v)).length;
        if (emailCount / values.length >= DETECTION_THRESHOLD) {
          mapping.email = header;
          continue;
        }
      }

      // Detect phone column by digit count
      if (!mapping.phone) {
        const phoneCount = values.filter((v) => {
          const digits = v.replace(/\D/g, '');
          return digits.length >= 7 && digits.length <= 15;
        }).length;
        if (phoneCount / values.length >= DETECTION_THRESHOLD) {
          mapping.phone = header;
        }
      }
    }
  }

  return mapping;
}

/**
 * Maps a single raw CSV record to a CRM record using the detected
 * column mapping. Falls back to empty strings for unmapped fields.
 */
function mapRecord(record: RawCSVRecord, mapping: ColumnMapping): CRMRecord {
  const raw = {
    created_at: mapping.date ? record[mapping.date] ?? '' : '',
    name: mapping.name ? record[mapping.name] ?? '' : '',
    email: mapping.email ? record[mapping.email] ?? '' : '',
    country_code: mapping.countryCode
      ? record[mapping.countryCode] ?? ''
      : '',
    mobile_without_country_code: mapping.phone
      ? record[mapping.phone] ?? ''
      : '',
    company: mapping.company ? record[mapping.company] ?? '' : '',
    city: mapping.city ? record[mapping.city] ?? '' : '',
    state: mapping.state ? record[mapping.state] ?? '' : '',
    country: mapping.country ? record[mapping.country] ?? '' : '',
    lead_owner: '',
    crm_status: '',
    crm_note: '[heuristic-mapped]',
    data_source: '',
    possession_time: '',
    description: '',
  };

  return CRMRecordSchema.parse(raw) as CRMRecord;
}

/**
 * Heuristic fallback mapper for when AI extraction fails after all retries.
 *
 * Uses column name pattern matching and value content analysis to map
 * CSV columns to CRM fields. Less accurate than AI, but recovers most
 * records that would otherwise be completely lost during a Gemini outage.
 *
 * @param records      - The batch of raw CSV records that failed AI extraction.
 * @param headers      - Original CSV column headers.
 * @param globalOffset - Row offset for skipped-row indices.
 * @returns Extracted CRM records and skipped entries.
 */
export function heuristicMapBatch(
  records: RawCSVRecord[],
  headers: string[],
  globalOffset: number,
): { extracted: CRMRecord[]; skipped: SkippedRecord[] } {
  const mapping = detectColumns(records, headers);
  const extracted: CRMRecord[] = [];
  const skipped: SkippedRecord[] = [];

  console.log(
    `[Heuristic] Detected columns — email: ${mapping.email ?? 'none'}, ` +
      `phone: ${mapping.phone ?? 'none'}, name: ${mapping.name ?? 'none'}, ` +
      `company: ${mapping.company ?? 'none'}, date: ${mapping.date ?? 'none'}`,
  );

  for (let i = 0; i < records.length; i++) {
    const mapped = mapRecord(records[i], mapping);

    if (!mapped.email && !mapped.mobile_without_country_code) {
      skipped.push({
        rowIndex: i + globalOffset,
        originalData: records[i],
        reason:
          'Heuristic fallback: missing both email and mobile number.',
      });
      continue;
    }

    extracted.push(mapped);
  }

  console.log(
    `[Heuristic] Mapped ${extracted.length} records, skipped ${skipped.length}`,
  );

  return { extracted, skipped };
}
