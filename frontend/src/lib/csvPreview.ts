import Papa from 'papaparse';

export interface CSVPreviewData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export function parseCSVForPreview(file: File): Promise<CSVPreviewData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as string[][];
        if (data.length === 0) {
          reject(new Error('CSV file is empty'));
          return;
        }
        const headers = data[0] || [];
        const rows = data.slice(1).filter(row => row.some(cell => cell && cell.trim() !== ''));
        resolve({ headers, rows, totalRows: rows.length });
      },
      error: (error) => reject(error),
      skipEmptyLines: true,
    });
  });
}
