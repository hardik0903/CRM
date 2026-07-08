/**
 * Allowed CRM lead status values.
 */
export type CRMStatus =
  | 'GOOD_LEAD_FOLLOW_UP'
  | 'DID_NOT_CONNECT'
  | 'BAD_LEAD'
  | 'SALE_DONE';

/**
 * Allowed data source values for lead origin tracking.
 */
export type DataSource =
  | 'leads_on_demand'
  | 'meridian_tower'
  | 'eden_park'
  | 'varah_swamy'
  | 'sarjapur_plots';

/**
 * A single CRM record with all required fields for the GrowEasy CRM system.
 */
export interface CRMRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: CRMStatus | '';
  crm_note: string;
  data_source: DataSource | '';
  possession_time: string;
  description: string;
}

/**
 * Result of a full CSV import operation, including successfully
 * extracted records and any skipped rows.
 */
export interface ImportResult {
  records: CRMRecord[];
  skipped: SkippedRecord[];
  totalImported: number;
  totalSkipped: number;
}

/**
 * Represents a row that was skipped during AI extraction,
 * along with the reason it was skipped.
 */
export interface SkippedRecord {
  rowIndex: number;
  originalData: Record<string, string>;
  reason: string;
}

/**
 * A raw CSV record as parsed by PapaParse — a flat key-value map
 * where all values are strings.
 */
export interface RawCSVRecord {
  [key: string]: string;
}
