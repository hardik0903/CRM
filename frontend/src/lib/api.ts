import { ImportProgress, ImportResult } from '@/types';

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
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/import/stream`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Import failed' }));
    throw new Error(errorData.error || `Import failed with status ${response.status}`);
  }

  if (!response.body) {
    return response.json();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: ImportResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as
          | { type: 'progress' } & ImportProgress
          | { type: 'result'; result: ImportResult }
          | { type: 'error'; error: string };

        if (event.type === 'progress') {
          onProgress?.(event);
        } else if (event.type === 'result') {
          finalResult = event.result;
        } else if (event.type === 'error') {
          throw new Error(event.error);
        }
      }
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as
      | { type: 'result'; result: ImportResult }
      | { type: 'error'; error: string };
    if (event.type === 'result') finalResult = event.result;
    if (event.type === 'error') throw new Error(event.error);
  }

  if (!finalResult) {
    throw new Error('Import stream ended before returning a result.');
  }

  return finalResult;
}
