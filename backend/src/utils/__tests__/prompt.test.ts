import { buildExtractionPrompt } from '../prompt';

describe('buildExtractionPrompt', () => {
  it('should include all CRM fields in the prompt', () => {
    const prompt = buildExtractionPrompt(
      [{ Name: 'John', Email: 'john@test.com' }],
      ['Name', 'Email']
    );
    expect(prompt).toContain('created_at');
    expect(prompt).toContain('name');
    expect(prompt).toContain('email');
    expect(prompt).toContain('country_code');
    expect(prompt).toContain('mobile_without_country_code');
    expect(prompt).toContain('company');
    expect(prompt).toContain('crm_status');
    expect(prompt).toContain('crm_note');
    expect(prompt).toContain('data_source');
    expect(prompt).toContain('possession_time');
  });

  it('should include CSV headers in the prompt', () => {
    const prompt = buildExtractionPrompt(
      [{ 'Full Name': 'John', 'Phone': '1234' }],
      ['Full Name', 'Phone']
    );
    expect(prompt).toContain('Full Name');
    expect(prompt).toContain('Phone');
  });

  it('should include the records data in JSON format', () => {
    const records = [{ Name: 'John', Email: 'john@test.com' }];
    const prompt = buildExtractionPrompt(records, ['Name', 'Email']);
    expect(prompt).toContain('"John"');
    expect(prompt).toContain('"john@test.com"');
  });

  it('should include all allowed CRM status values', () => {
    const prompt = buildExtractionPrompt([{ x: '1' }], ['x']);
    expect(prompt).toContain('GOOD_LEAD_FOLLOW_UP');
    expect(prompt).toContain('DID_NOT_CONNECT');
    expect(prompt).toContain('BAD_LEAD');
    expect(prompt).toContain('SALE_DONE');
  });

  it('should include all allowed data source values', () => {
    const prompt = buildExtractionPrompt([{ x: '1' }], ['x']);
    expect(prompt).toContain('leads_on_demand');
    expect(prompt).toContain('meridian_tower');
    expect(prompt).toContain('eden_park');
    expect(prompt).toContain('varah_swamy');
    expect(prompt).toContain('sarjapur_plots');
  });

  it('should include output instructions for structured response', () => {
    const prompt = buildExtractionPrompt([{ x: '1' }], ['x']);
    expect(prompt).toContain('structured JSON output');
  });
});
