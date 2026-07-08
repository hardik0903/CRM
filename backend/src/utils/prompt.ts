import type { RawCSVRecord } from '../types/crm.js';

/**
 * Builds the extraction prompt sent to Google Gemini.
 *
 * The prompt instructs the model to map arbitrary CSV columns to the
 * fixed GrowEasy CRM schema, handle duplicates, skip invalid rows,
 * and return a strict JSON response.
 *
 * @param records - The batch of raw CSV records to include in the prompt.
 * @param headers - The column headers from the original CSV file.
 * @returns The fully-formed prompt string.
 */
export function buildExtractionPrompt(
  records: RawCSVRecord[],
  headers: string[],
): string {
  const headersStr = headers.join(', ');
  const recordsStr = JSON.stringify(records, null, 2);

  return `You are a CRM data extraction expert. Your task is to analyze CSV records and map them to GrowEasy CRM format.

## Target CRM Fields
- created_at: Lead creation date (must be parseable by JavaScript's new Date())
- name: Full name of the lead
- email: Primary email address
- country_code: Phone country code (e.g., +91)
- mobile_without_country_code: Mobile number without country code
- company: Company/organization name
- city: City
- state: State/province
- country: Country
- lead_owner: Lead owner email or name
- crm_status: One of EXACTLY these values: GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, SALE_DONE (leave empty if unsure)
- crm_note: Any remarks, follow-up notes, extra phone numbers, extra emails, or additional useful info
- data_source: One of EXACTLY these values: leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots (leave empty if none match)
- possession_time: Property possession time
- description: Additional description

## CRITICAL RULES
1. Map columns INTELLIGENTLY - columns may have different names (e.g., "Phone" → mobile_without_country_code, "Full Name" → name, "Organisation" → company)
2. If multiple emails exist, use the FIRST as \`email\` and put the rest in \`crm_note\`
3. If multiple phone numbers exist, use the FIRST as \`mobile_without_country_code\` and put the rest in \`crm_note\`
4. SKIP records that have NEITHER an email NOR a mobile number - mark them in the skipped array with reason
5. created_at must be parseable by JavaScript new Date(). If the original date is in another format, convert it.
6. Do NOT invent data. If a field is not present in the source, leave it as empty string.
7. For crm_status and data_source, only use the EXACT allowed values listed above. If unsure, leave empty.
8. Escape any line breaks in field values as \\n

## CSV Column Headers
${headersStr}

## Records to Process
${recordsStr}

## Output Instructions
Map each record to the CRM fields listed above following the critical rules. Return the result as the structured JSON output.`;
}
