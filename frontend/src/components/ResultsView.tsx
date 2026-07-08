'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ImportResult, CRMRecord } from '@/types';
import DataTable from './DataTable';
import styles from './ResultsView.module.css';

interface ResultsViewProps {
  result: ImportResult;
  onReset: () => void;
}

function AnimatedCounter({ value, label, color }: { value: number; label: string; color: 'green' | 'amber' }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }
    let start = 0;
    const duration = 800;
    const stepTime = Math.max(Math.floor(duration / value), 16);
    const timer = setInterval(() => {
      start += 1;
      setDisplayValue(start);
      if (start >= value) {
        clearInterval(timer);
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <div className={`${styles.statCard} ${styles[`stat_${color}`]}`}>
      <div className={styles.statIcon}>
        {color === 'green' ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
      </div>
      <div className={styles.statValue}>{displayValue}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

const CRM_FIELDS: (keyof CRMRecord)[] = [
  'created_at', 'name', 'email', 'country_code',
  'mobile_without_country_code', 'company', 'city', 'state',
  'country', 'lead_owner', 'crm_status', 'crm_note',
  'data_source', 'possession_time', 'description',
];

export default function ResultsView({ result, onReset }: ResultsViewProps) {
  const [activeTab, setActiveTab] = useState<'imported' | 'skipped'>('imported');

  const skippedTableData = useMemo(() => {
    const headers = ['Row #', 'Reason', ...Object.keys(result.skipped[0]?.originalData || {})];
    const rows = result.skipped.map((s) => [
      String(s.rowIndex),
      s.reason,
      ...Object.values(s.originalData),
    ]);
    return { headers, rows };
  }, [result.skipped]);

  const handleExport = useCallback(() => {
    if (result.records.length === 0) return;

    const headerRow = CRM_FIELDS.join(',');
    const dataRows = result.records.map((rec) =>
      CRM_FIELDS.map((field) => {
        const val = rec[field] ?? '';
        // Escape commas and quotes
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    );

    const csv = [headerRow, ...dataRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crm_import_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [result.records]);

  return (
    <div className={`${styles.container} animate-slide-up`}>
      {/* Stats cards */}
      <div className={styles.statsGrid}>
        <AnimatedCounter value={result.totalImported} label="Records Imported" color="green" />
        <AnimatedCounter value={result.totalSkipped} label="Records Skipped" color="amber" />
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'imported' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('imported')}
            aria-selected={activeTab === 'imported'}
            role="tab"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Imported Records
            <span className={`badge badge-success ${styles.tabBadge}`}>{result.totalImported}</span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'skipped' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('skipped')}
            aria-selected={activeTab === 'skipped'}
            role="tab"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Skipped Records
            <span className={`badge badge-warning ${styles.tabBadge}`}>{result.totalSkipped}</span>
          </button>
        </div>
        <div className={styles.tabActions}>
          <button className="btn btn-secondary" onClick={handleExport} disabled={result.records.length === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Table content */}
      <div className={styles.tableContent} role="tabpanel">
        {activeTab === 'imported' ? (
          result.records.length > 0 ? (
            <DataTable
              headers={[]}
              rows={[]}
              crmRecords={result.records}
              maxHeight="500px"
              title="Imported CRM Records"
            />
          ) : (
            <div className={styles.emptyState}>
              <p>No records were imported.</p>
            </div>
          )
        ) : (
          result.skipped.length > 0 ? (
            <DataTable
              headers={skippedTableData.headers}
              rows={skippedTableData.rows}
              maxHeight="500px"
              title="Skipped Records"
            />
          ) : (
            <div className={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p>All records were imported successfully!</p>
            </div>
          )
        )}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className="btn btn-primary" onClick={onReset}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Start Over
        </button>
      </div>
    </div>
  );
}
