'use client';

import { useState, useCallback } from 'react';
import { ImportResult } from '@/types';
import { CSVPreviewData, parseCSVForPreview } from '@/lib/csvPreview';
import { importCSVWithProgress } from '@/lib/api';
import FileUpload from './FileUpload';
import DataTable from './DataTable';
import styles from './ImportModal.module.css';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
}

export default function ImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: ImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CSVPreviewData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setError(null);
    try {
      const preview = await parseCSVForPreview(file);
      setPreviewData(preview);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to parse CSV file.',
      );
    }
  }, []);

  const handleFileRemove = useCallback(() => {
    setSelectedFile(null);
    setPreviewData(null);
    setError(null);
  }, []);

  const resetAndClose = useCallback(() => {
    setSelectedFile(null);
    setPreviewData(null);
    setError(null);
    setIsProcessing(false);
    setProgress(0);
    setProcessingStatus('');
    onClose();
  }, [onClose]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setError(null);
    setIsProcessing(true);
    setProgress(0);
    setProcessingStatus('Uploading CSV...');

    try {
      const result = await importCSVWithProgress(selectedFile, (event) => {
        setProgress(event.progress);
        if (event.phase === 'parsing') {
          setProcessingStatus('Parsing CSV...');
        } else if (event.phase === 'parsed') {
          setProcessingStatus(
            `Parsed ${event.totalRecords ?? 0} records. Starting AI extraction...`,
          );
        } else if (event.phase === 'batch_started') {
          setProcessingStatus(
            `Processing batch ${event.currentBatch} of ${event.totalBatches}...`,
          );
        } else if (event.phase === 'batch_completed') {
          setProcessingStatus(
            `Batch ${event.currentBatch}/${event.totalBatches} done. ${event.imported ?? 0} imported, ${event.skipped ?? 0} skipped.`,
          );
        } else if (event.phase === 'completed') {
          setProcessingStatus('Finalizing...');
        }
      });
      setProgress(100);
      onImportComplete(result);
      // Close modal after success
      resetAndClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Import failed. Please try again.',
      );
      setIsProcessing(false);
    }
  }, [selectedFile, onImportComplete, resetAndClose]);

  const handleClose = useCallback(() => {
    if (isProcessing) return;
    resetAndClose();
  }, [isProcessing, resetAndClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Import Leads via CSV</h2>
            <p className={styles.subtitle}>
              Upload a CSV file to bulk import leads into your system.
            </p>
          </div>
          <button
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close"
            disabled={isProcessing}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.error}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        <div className={styles.body}>
          {isProcessing ? (
            <div className={styles.processing}>
              <div className={styles.processingIcon}>
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
              </div>
              <p className={styles.processingStatus}>{processingStatus}</p>
              <div className={styles.progressBarContainer}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className={styles.progressText}>
                {Math.round(Math.min(progress, 100))}% complete
              </p>
            </div>
          ) : previewData ? (
            <div className={styles.preview}>
              <div className={styles.fileInfo}>
                <div className={styles.fileInfoIcon}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <p className={styles.fileName}>{selectedFile?.name}</p>
                  <p className={styles.fileMeta}>
                    {previewData.totalRows} rows · {previewData.headers.length}{' '}
                    columns
                  </p>
                </div>
              </div>
              <div className={styles.previewTable}>
                <DataTable
                  headers={previewData.headers}
                  rows={previewData.rows.slice(0, 10)}
                  maxHeight="250px"
                />
              </div>
              {previewData.totalRows > 10 && (
                <p className={styles.truncNote}>
                  Showing first 10 of {previewData.totalRows} rows
                </p>
              )}
            </div>
          ) : (
            <div className={styles.uploadArea}>
              <FileUpload
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                onRemove={handleFileRemove}
              />
              <div className={styles.uploadHints}>
                <p className={styles.hintLine}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Supported File: .csv (max 10MB)
                </p>
                <p className={styles.hintDetail}>
                  AI will intelligently map your CSV columns to CRM fields
                  including name, email, phone, company, status, and more.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </button>
          {previewData && !isProcessing && (
            <button className="btn btn-accent" onClick={handleUpload}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload File
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
