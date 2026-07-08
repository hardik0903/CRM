import { ImportResult } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function importCSV(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Import failed' }));
    throw new Error(errorData.error || `Import failed with status ${response.status}`);
  }

  return response.json();
}

export async function importCSVWithProgress(
  file: File,
  onProgress?: (progress: { currentBatch: number; totalBatches: number; phase: string }) => void
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Import failed' }));
    throw new Error(errorData.error || `Import failed with status ${response.status}`);
  }

  if (onProgress) {
    onProgress({ currentBatch: 1, totalBatches: 1, phase: 'complete' });
  }

  return response.json();
}
