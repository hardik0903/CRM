'use client';

import { useState, useCallback, useMemo } from 'react';
import { ImportResult, CRMRecord } from '@/types';
import Sidebar from '@/components/Sidebar';
import ImportModal from '@/components/ImportModal';
import ResultsView from '@/components/ResultsView';
import styles from './page.module.css';

const CRM_DISPLAY_FIELDS: { key: keyof CRMRecord; label: string }[] = [
  { key: 'name', label: 'Lead Name' },
  { key: 'email', label: 'Email' },
  { key: 'mobile_without_country_code', label: 'Contact' },
  { key: 'created_at', label: 'Date Created' },
  { key: 'company', label: 'Company' },
  { key: 'crm_status', label: 'Status' },
  { key: 'data_source', label: 'Source' },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { className: string; label: string }> = {
    GOOD_LEAD_FOLLOW_UP: {
      className: 'badge badge-success',
      label: 'Good Lead',
    },
    DID_NOT_CONNECT: {
      className: 'badge badge-neutral',
      label: 'Not Dialed',
    },
    BAD_LEAD: { className: 'badge badge-error', label: 'Bad Lead' },
    SALE_DONE: { className: 'badge badge-info', label: 'Sale Done' },
  };
  const info = map[status] || {
    className: 'badge badge-neutral',
    label: status || '—',
  };
  return <span className={info.className}>{info.label}</span>;
}

export default function Home() {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [visibleRows, setVisibleRows] = useState(20);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  const handleImportComplete = useCallback((result: ImportResult) => {
    setImportResult(result);
    setShowResults(false);
    setVisibleRows(20);
  }, []);

  const handleDeleteLead = useCallback((idx: number) => {
    setImportResult((prev) => {
      if (!prev) return prev;
      const newRecords = [...prev.records];
      newRecords.splice(idx, 1);
      return { ...prev, records: newRecords };
    });
    setActiveMenu(null);
  }, []);

  const handleEditLead = useCallback((idx: number) => {
    setImportResult((prev) => {
      if (!prev) return prev;
      const currentName = prev.records[idx].name;
      const newName = window.prompt('Edit Lead Name:', currentName);
      if (newName === null) return prev;
      const newRecords = [...prev.records];
      newRecords[idx] = { ...newRecords[idx], name: newName };
      return { ...prev, records: newRecords };
    });
    setActiveMenu(null);
  }, []);

  const filteredRecords = useMemo(() => {
    if (!importResult) return [];
    if (!searchQuery.trim()) return importResult.records;
    const q = searchQuery.toLowerCase();
    return importResult.records.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.mobile_without_country_code.includes(q) ||
        r.company.toLowerCase().includes(q),
    );
  }, [importResult, searchQuery]);

  const displayedRecords = filteredRecords.slice(0, visibleRows);

  return (
    <div className={styles.layout}>
      <Sidebar onImportClick={() => setImportModalOpen(true)} />

      <main className={styles.main}>
        {/* Top Header */}
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <h1 className={styles.pageTitle}>Manage Your Leads</h1>
            <p className={styles.pageSubtitle}>
              Monitor lead status, design tasks, and close deals faster.
            </p>
          </div>
          <div className={styles.topBarRight}>
            <div className={styles.searchBox}>
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
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setImportModalOpen(true)}
            >
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
              Import Leads
            </button>
          </div>
        </header>

        {/* Content */}
        <div className={styles.content}>
          {/* Results summary toggle */}
          {importResult && importResult.totalSkipped > 0 && (
            <div className={styles.resultsBanner}>
              <div className={styles.resultsBannerStats}>
                <span className="badge badge-success">
                  {importResult.totalImported} imported
                </span>
                <span className="badge badge-warning">
                  {importResult.totalSkipped} skipped
                </span>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setShowResults(!showResults)}
                style={{ fontSize: '0.8125rem' }}
              >
                {showResults ? 'Hide Details' : 'View Skipped Records'}
              </button>
            </div>
          )}

          {/* Detailed results view */}
          {showResults && importResult && (
            <div className={`${styles.detailedResults} animate-slide-up`}>
              <ResultsView
                result={importResult}
                onReset={() => {
                  setImportResult(null);
                  setShowResults(false);
                }}
              />
            </div>
          )}

          {/* Your Leads section */}
          <div className={styles.leadsSection}>
            <div className={styles.leadsSectionHeader}>
              <h2 className={styles.leadsSectionTitle}>Your Leads</h2>
              {importResult && (
                <span className={styles.leadCount}>
                  {filteredRecords.length} leads
                </span>
              )}
            </div>

            {importResult && filteredRecords.length > 0 ? (
              <>
                <div className={styles.tableContainer}>
                  <table className={styles.leadsTable}>
                    <thead>
                      <tr>
                        {CRM_DISPLAY_FIELDS.map((field) => (
                          <th key={field.key}>{field.label}</th>
                        ))}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRecords.map((record, idx) => (
                        <tr key={idx}>
                          <td>
                            <span className={styles.leadName}>
                              {record.name || '—'}
                            </span>
                          </td>
                          <td className={styles.cellMuted}>
                            {record.email || '—'}
                          </td>
                          <td className={styles.cellMuted}>
                            {record.country_code &&
                            record.mobile_without_country_code
                              ? `${record.country_code} ${record.mobile_without_country_code}`
                              : record.mobile_without_country_code || '—'}
                          </td>
                          <td className={styles.cellMuted}>
                            {record.created_at || '—'}
                          </td>
                          <td className={styles.cellMuted}>
                            {record.company || '—'}
                          </td>
                          <td>
                            <StatusBadge status={record.crm_status} />
                          </td>
                          <td className={styles.cellMuted}>
                            {record.data_source || '—'}
                          </td>
                          <td className={styles.actionsCell}>
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleEditLead(idx)}
                            >
                              Edit
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                              onClick={() => handleDeleteLead(idx)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredRecords.length > visibleRows && (
                  <div className={styles.loadMore}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setVisibleRows((prev) => prev + 20)}
                    >
                      Load More ({filteredRecords.length - visibleRows}{' '}
                      remaining)
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <h3 className={styles.emptyTitle}>No leads yet</h3>
                <p className={styles.emptyText}>
                  Import your leads from a CSV file to get started.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => setImportModalOpen(true)}
                >
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
                  Import Your First Leads
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Import Modal */}
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
