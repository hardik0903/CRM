import Papa from 'papaparse';

export interface CSVPreviewData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

const PREVIEW_ROW_LIMIT = 100;

export function parseCSVForPreview(file: File): Promise<CSVPreviewData> {
  return new Promise((resolve, reject) => {
    let headers: string[] = [];
    const rows: string[][] = [];
    let totalRows = 0;
    let hasHeader = false;

    Papa.parse<string[]>(file, {
      step: (results) => {
        const row = results.data.map((cell) => String(cell ?? '').trim());

        if (!hasHeader) {
          headers = row;
          hasHeader = true;
          return;
        }

        if (!row.some((cell) => cell !== '')) {
          return;
        }

        totalRows += 1;
        if (rows.length < PREVIEW_ROW_LIMIT) {
          rows.push(row);
        }
      },
      complete: () => {
        if (!hasHeader || headers.length === 0) {
          reject(new Error('CSV file is empty'));
          return;
        }
        resolve({ headers, rows, totalRows });
      },
      error: (error) => reject(error),
      skipEmptyLines: true,
    });
  });
}
