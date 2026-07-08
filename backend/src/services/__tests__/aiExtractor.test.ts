import { sanitizeCRMRecord } from '../aiExtractor';

describe('sanitizeCRMRecord', () => {
  it('should pass through valid records unchanged', () => {
    const record = {
      created_at: '2026-05-13 14:20:48',
      name: 'John Doe',
      email: 'john@test.com',
      country_code: '+91',
      mobile_without_country_code: '9876543210',
      company: 'TestCo',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      lead_owner: 'admin@test.com',
      crm_status: 'GOOD_LEAD_FOLLOW_UP',
      crm_note: 'Test note',
      data_source: 'meridian_tower',
      possession_time: 'Ready to Move',
      description: 'Test desc',
    };
    const result = sanitizeCRMRecord(record as any);
    expect(result).toEqual(record);
  });

  it('should reset invalid crm_status to empty string', () => {
    const record = {
      created_at: '', name: '', email: 'a@b.com', country_code: '', mobile_without_country_code: '',
      company: '', city: '', state: '', country: '', lead_owner: '',
      crm_status: 'INVALID_STATUS', crm_note: '', data_source: '', possession_time: '', description: '',
    };
    const result = sanitizeCRMRecord(record as any);
    expect(result.crm_status).toBe('');
  });

  it('should reset invalid data_source to empty string', () => {
    const record = {
      created_at: '', name: '', email: 'a@b.com', country_code: '', mobile_without_country_code: '',
      company: '', city: '', state: '', country: '', lead_owner: '',
      crm_status: '', crm_note: '', data_source: 'facebook_ads', possession_time: '', description: '',
    };
    const result = sanitizeCRMRecord(record as any);
    expect(result.data_source).toBe('');
  });

  it('should reset invalid created_at to empty string', () => {
    const record = {
      created_at: 'not-a-date', name: '', email: 'a@b.com', country_code: '', mobile_without_country_code: '',
      company: '', city: '', state: '', country: '', lead_owner: '',
      crm_status: '', crm_note: '', data_source: '', possession_time: '', description: '',
    };
    const result = sanitizeCRMRecord(record as any);
    expect(result.created_at).toBe('');
  });

  it('should default missing fields to empty string', () => {
    const partial = { email: 'test@test.com' } as any;
    const result = sanitizeCRMRecord(partial);
    expect(result.name).toBe('');
    expect(result.company).toBe('');
    expect(result.city).toBe('');
    expect(result.email).toBe('test@test.com');
  });
});
