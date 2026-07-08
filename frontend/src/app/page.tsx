'use client';

import { useState, useCallback } from 'react';
import { AppStep, ImportResult } from '@/types';
import { CSVPreviewData, parseCSVForPreview } from '@/lib/csvPreview';
import { importCSVWithProgress } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';
import StepIndicator from '@/components/StepIndicator';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import ResultsView from '@/components/ResultsView';
import styles from './page.module.css';

export default function Home() {
  const [currentStep, setCurrentStep] = useState<AppStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CSVPreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('Preparing import...');
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setError(null);
    try {
      const preview = await parseCSVForPreview(file);
      setPreviewData(preview);
      setCurrentStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file.');
    }
  }, []);

  const handleFileRemove = useCallback(() => {
    setSelectedFile(null);
    setPreviewData(null);
    setError(null);
    setCurrentStep('upload');
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!selectedFile) return;
    setError(null);
    setCurrentStep('processing');
    setIsProcessing(true);
    setProgress(0);
    setProcessingStatus('Uploading and parsing CSV...');

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
            `Processed batch ${event.currentBatch} of ${event.totalBatches}. Imported ${event.imported ?? 0}, skipped ${event.skipped ?? 0}.`,
          );
        } else if (event.phase === 'completed') {
          setProcessingStatus('Finalizing results...');
        }
      });
      setProgress(100);
      setImportResult(result);
      setCurrentStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Please try again.');
      setCurrentStep('preview');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile]);

  const handleBack = useCallback(() => {
    setError(null);
    if (currentStep === 'preview') {
      setCurrentStep('upload');
    }
  }, [currentStep]);

  const handleReset = useCallback(() => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setPreviewData(null);
    setImportResult(null);
    setIsProcessing(false);
    setProgress(0);
    setProcessingStatus('Preparing import...');
    setError(null);
  }, []);

  return (
    <main className={styles.main}>
      <div className="container">
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.logoSection}>
              <div className={styles.logoIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div>
                <h1 className={styles.title}>AI CSV Importer</h1>
                <p className={styles.subtitle}>
                  Intelligently map, validate &amp; transform your data
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Step indicator */}
        <div className={styles.stepSection}>
          <StepIndicator currentStep={currentStep} />
        </div>

        {/* Error banner */}
        {error && (
          <div className={`${styles.errorBanner} animate-fade-in`} role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{error}</span>
            <button
              className={styles.errorDismiss}
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Main content */}
        <div className={`glass-card ${styles.contentCard}`}>
          {/* Upload step */}
          {currentStep === 'upload' && (
            <div className={`${styles.stepContent} animate-fade-in`}>
              <div className={styles.stepHeader}>
                <h2 className={styles.stepTitle}>Upload your CSV file</h2>
                <p className={styles.stepDescription}>
                  Upload a CSV file and our AI will automatically map your columns to CRM fields, validate the data, and prepare it for import.
                </p>
              </div>
              <FileUpload
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                onRemove={handleFileRemove}
              />
            </div>
          )}

          {/* Preview step */}
          {currentStep === 'preview' && previewData && (
            <div className={`${styles.stepContent} animate-fade-in`}>
              <div className={styles.stepHeader}>
                <h2 className={styles.stepTitle}>Preview your data</h2>
                <p className={styles.stepDescription}>
                  Review the parsed CSV data below. We found{' '}
                  <strong>{previewData.totalRows}</strong>{' '}
                  {previewData.totalRows === 1 ? 'row' : 'rows'} and{' '}
                  <strong>{previewData.headers.length}</strong>{' '}
                  {previewData.headers.length === 1 ? 'column' : 'columns'}.
                </p>
              </div>

              {selectedFile && (
                <div className={styles.fileSummary}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>{selectedFile.name}</span>
                </div>
              )}

              <DataTable
                headers={previewData.headers}
                rows={previewData.rows.slice(0, 100)}
                maxHeight="400px"
                title={
                  previewData.totalRows > 100
                    ? `Showing first 100 of ${previewData.totalRows} rows`
                    : undefined
                }
              />

              {previewData.totalRows > 100 && (
                <p className={styles.truncationNote}>
                  Showing the first 100 rows for preview. All {previewData.totalRows} rows will be imported.
                </p>
              )}

              <div className={styles.actions}>
                <button className="btn btn-secondary" onClick={handleBack}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  Back
                </button>
                <button className="btn btn-primary" onClick={handleConfirmImport}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Confirm Import
                </button>
              </div>
            </div>
          )}

          {/* Processing step */}
          {currentStep === 'processing' && isProcessing && (
            <div className={`${styles.stepContent} ${styles.processingContent} animate-fade-in`}>
              <div className={styles.processingAnimation}>
                <div className={styles.processingOrb}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div className={styles.processingRings}>
                  <div className={styles.ring1} />
                  <div className={styles.ring2} />
                  <div className={styles.ring3} />
                </div>
              </div>
              <h2 className={styles.processingTitle}>AI is analyzing your data</h2>
              <p className={styles.processingDescription}>
                {processingStatus}
              </p>
              <div className={styles.processingDots}>
                <span className={styles.dot} style={{ animationDelay: '0ms' }} />
                <span className={styles.dot} style={{ animationDelay: '160ms' }} />
                <span className={styles.dot} style={{ animationDelay: '320ms' }} />
              </div>
              <div className={styles.progressBarContainer}>
                <div className={styles.progressBar} style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <p className={styles.progressText}>{Math.round(Math.min(progress, 100))}% complete</p>
            </div>
          )}

          {/* Results step */}
          {currentStep === 'results' && importResult && (
            <div className={`${styles.stepContent} animate-slide-up`}>
              <div className={styles.stepHeader}>
                <h2 className={styles.stepTitle}>Import Complete</h2>
                <p className={styles.stepDescription}>
                  Your CSV has been processed. Review the results below.
                </p>
              </div>
              <ResultsView result={importResult} onReset={handleReset} />
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <p>Powered by AI &bull; GrowEasy CRM</p>
        </footer>
      </div>
    </main>
  );
}
