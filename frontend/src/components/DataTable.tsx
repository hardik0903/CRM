'use client';

import { useMemo, useState } from 'react';
import { CRMRecord } from '@/types';
import styles from './DataTable.module.css';

interface DataTableProps {
  headers: string[];
  rows: string[][];
  maxHeight?: string;
  title?: string;
  crmRecords?: CRMRecord[];
}

const CRM_FIELD_ORDER: (keyof CRMRecord)[] = [
  'created_at',
  'name',
  'email',
  'country_code',
  'mobile_without_country_code',
  'company',
  'city',
  'state',
  'country',
  'lead_owner',
  'crm_status',
  'crm_note',
  'data_source',
  'possession_time',
  'description',
];

const CRM_FIELD_LABELS: Record<string, string> = {
  created_at: 'Created At',
  name: 'Name',
  email: 'Email',
  country_code: 'Country Code',
  mobile_without_country_code: 'Mobile',
  company: 'Company',
  city: 'City',
  state: 'State',
  country: 'Country',
  lead_owner: 'Lead Owner',
  crm_status: 'CRM Status',
  crm_note: 'CRM Note',
  data_source: 'Data Source',
  possession_time: 'Possession Time',
  description: 'Description',
};

const ROW_HEIGHT = 41;
const OVERSCAN_ROWS = 8;

export default function DataTable({
  headers: propHeaders,
  rows: propRows,
  maxHeight = '480px',
  title,
  crmRecords,
}: DataTableProps) {
  const [scrollTop, setScrollTop] = useState(0);

  const { headers, rows } = useMemo(() => {
    if (crmRecords && crmRecords.length > 0) {
      const h = CRM_FIELD_ORDER.map((f) => CRM_FIELD_LABELS[f] || f);
      const r = crmRecords.map((rec) =>
        CRM_FIELD_ORDER.map((field) => rec[field] ?? '')
      );
      return { headers: h, rows: r };
    }
    return { headers: propHeaders, rows: propRows };
  }, [propHeaders, propRows, crmRecords]);

  const viewportHeight = Number.parseInt(maxHeight, 10) || 480;
  const totalHeight = rows.length * ROW_HEIGHT;
  const visibleWindow = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2;
  const maxStartIndex = Math.max(0, rows.length - visibleWindow);
  const startIndex = Math.min(
    maxStartIndex,
    Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS),
  );
  const endIndex = Math.min(rows.length, startIndex + visibleWindow);
  const visibleRows = rows.slice(startIndex, endIndex);
  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(
    0,
    totalHeight - topSpacerHeight - visibleRows.length * ROW_HEIGHT,
  );

  if (headers.length === 0 && rows.length === 0) {
    return (
      <div className={styles.empty}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        <p>No data to display</p>
      </div>
    );
  }

  return (
    <div className={`${styles.container} animate-fade-in`}>
      {title && (
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <span className={styles.rowCount}>
            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
          </span>
        </div>
      )}
      <div
        className={styles.tableWrapper}
        style={{ maxHeight }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <table className={styles.table} role="table" aria-rowcount={rows.length}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.thIndex}>#</th>
              {headers.map((header, idx) => (
                <th key={idx} className={styles.th} title={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td
                  className={styles.spacerCell}
                  colSpan={headers.length + 1}
                  style={{ height: topSpacerHeight }}
                />
              </tr>
            )}
            {visibleRows.map((row, rowIdx) => {
              const globalIdx = startIndex + rowIdx + 1;
              return (
                <tr key={globalIdx} className={styles.tr}>
                  <td className={styles.tdIndex}>{globalIdx}</td>
                  {headers.map((_, colIdx) => (
                    <td
                      key={colIdx}
                      className={styles.td}
                      title={row[colIdx] || ''}
                    >
                      {row[colIdx] || '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
            {bottomSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td
                  className={styles.spacerCell}
                  colSpan={headers.length + 1}
                  style={{ height: bottomSpacerHeight }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <span className={styles.rowCount}>
          {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </span>
      </div>
    </div>
  );
}
