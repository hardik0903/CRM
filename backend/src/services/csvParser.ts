import Papa from 'papaparse';
import type { RawCSVRecord } from '../types/crm.js';

/**
 * Result of parsing a CSV file buffer.
 */
export interface CSVParseResult {
  /** Column headers extracted from the first row of the CSV. */
  headers: string[];
  /** Parsed rows as key-value objects keyed by header names. */
  records: RawCSVRecord[];
}

/**
 * Parses a CSV file buffer into structured records.
 *
 * Strips the UTF-8 BOM (if present) before parsing and uses PapaParse
 * with `header: true` so each record is keyed by its column header.
 *
 * @param fileBuffer - The raw file buffer uploaded by the client.
 * @returns An object containing the detected headers and parsed records.
 * @throws If the CSV file contains no parseable data.
 */
export async function parseCSV(fileBuffer: Buffer): Promise<CSVParseResult> {
  // Convert buffer to string and strip UTF-8 BOM (U+FEFF)
  let csvString = fileBuffer.toString('utf-8');
  if (csvString.charCodeAt(0) === 0xfeff) {
    csvString = csvString.slice(1);
  }

  return new Promise<CSVParseResult>((resolve, reject) => {
    Papa.parse<RawCSVRecord>(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete(results) {
        const headers = results.meta.fields ?? [];

        if (headers.length === 0) {
          reject(new Error('CSV file contains no headers.'));
          return;
        }

        // Normalise every value to a trimmed string (PapaParse may
        // leave undefined for trailing-comma columns).
        const records: RawCSVRecord[] = results.data.map((row) => {
          const cleaned: RawCSVRecord = {};
          for (const header of headers) {
            cleaned[header] = (row[header] ?? '').toString().trim();
          }
          return cleaned;
        });

        resolve({ headers, records });
      },
      error(error: Error) {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}
