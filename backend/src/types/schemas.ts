import { z } from 'zod';

const VALID_CRM_STATUSES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
] as const;

const VALID_DATA_SOURCES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Coerces any value to a trimmed string, treating null/undefined as ''.
 */
const toTrimmedString = (val: unknown): string =>
  val == null ? '' : String(val).trim();

/**
 * Helper: creates a field schema that accepts any value (including missing
 * keys) and transforms it through a validator function.
 * Uses `.optional()` so Zod v4 doesn't reject missing keys.
 */
const optField = (transform: (val: unknown) => string) =>
  z.any().optional().transform((val) => transform(val));

/**
 * Zod schema for a single CRM record with full validation and transformation.
 *
 * Every field accepts any input (including `undefined` / missing keys) and
 * transforms the value through validation logic — invalid values are
 * silently reset to empty strings rather than throwing, which mirrors the
 * original `sanitizeCRMRecord` behaviour.
 */
export const CRMRecordSchema = z.object({
  created_at: optField((val) => {
    const str = toTrimmedString(val);
    if (!str) return '';
    const date = new Date(str);
    return isNaN(date.getTime()) ? '' : str;
  }),
  name: optField(toTrimmedString),
  email: optField((val) => {
    const str = toTrimmedString(val);
    return EMAIL_PATTERN.test(str) ? str : '';
  }),
  country_code: optField(toTrimmedString),
  mobile_without_country_code: optField((val) => {
    const str = toTrimmedString(val);
    const digits = str.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15 ? digits : '';
  }),
  company: optField(toTrimmedString),
  city: optField(toTrimmedString),
  state: optField(toTrimmedString),
  country: optField(toTrimmedString),
  lead_owner: optField(toTrimmedString),
  crm_status: optField((val) => {
    const str = toTrimmedString(val);
    return (VALID_CRM_STATUSES as readonly string[]).includes(str) ? str : '';
  }),
  crm_note: optField(toTrimmedString),
  data_source: optField((val) => {
    const str = toTrimmedString(val);
    return (VALID_DATA_SOURCES as readonly string[]).includes(str) ? str : '';
  }),
  possession_time: optField(toTrimmedString),
  description: optField(toTrimmedString),
});

/**
 * Schema for a single skipped-row entry as returned by Gemini.
 */
export const SkippedEntrySchema = z.object({
  rowIndex: z.number(),
  reason: z.string(),
});

/**
 * Schema for the full Gemini response shape, validating that the
 * top-level structure contains `extracted` and `skipped` arrays.
 */
export const GeminiResponseSchema = z.object({
  extracted: z.array(z.record(z.string(), z.any())),
  skipped: z.array(SkippedEntrySchema).default([]),
});

export type ValidatedCRMRecord = z.output<typeof CRMRecordSchema>;
