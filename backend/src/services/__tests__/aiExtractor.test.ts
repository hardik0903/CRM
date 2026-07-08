import { sanitizeCRMRecord, extractCRMRecords } from '../aiExtractor';

// ---------------------------------------------------------------------------
// Mock the Gemini SDK so extractCRMRecords can be tested without a live
// API key or network call. `generateContentMock` is reassigned per-test.
// ---------------------------------------------------------------------------
const generateContentMock = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: (...args: unknown[]) => generateContentMock(...args),
    }),
  })),
}));

/** Wraps a JSON payload the way Gemini's SDK response object is shaped. */
function fakeGeminiResponse(text: string) {
  return { response: { text: () => text } };
}

const RAW_RECORD = { name: 'Jane Doe', email: 'jane@test.com', phone: '9876543210' };

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

describe('extractCRMRecords', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, GEMINI_API_KEY: 'test-key' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('extracts records successfully on the first attempt', async () => {
    generateContentMock.mockResolvedValueOnce(
      fakeGeminiResponse(
        JSON.stringify({
          extracted: [
            {
              created_at: '2026-05-13 14:20:48',
              name: 'Jane Doe',
              email: 'jane@test.com',
              country_code: '+91',
              mobile_without_country_code: '9876543210',
              company: '',
              city: '',
              state: '',
              country: '',
              lead_owner: '',
              crm_status: 'GOOD_LEAD_FOLLOW_UP',
              crm_note: '',
              data_source: '',
              possession_time: '',
              description: '',
            },
          ],
          skipped: [],
        }),
      ),
    );

    const result = await extractCRMRecords([RAW_RECORD], ['name', 'email', 'phone']);

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(result.totalImported).toBe(1);
    expect(result.totalSkipped).toBe(0);
    expect(result.records[0].email).toBe('jane@test.com');
  });

  it('strips markdown code fences before parsing', async () => {
    generateContentMock.mockResolvedValueOnce(
      fakeGeminiResponse(
        '```json\n' +
          JSON.stringify({
            extracted: [{ ...emptyRecord(), email: 'fenced@test.com' }],
            skipped: [],
          }) +
          '\n```',
      ),
    );

    const result = await extractCRMRecords([RAW_RECORD], ['name', 'email']);

    expect(result.records[0].email).toBe('fenced@test.com');
  });

  it('splits records into multiple batches of 50', async () => {
    const records = Array.from({ length: 75 }, (_, i) => ({
      name: `Lead ${i}`,
      email: `lead${i}@test.com`,
    }));

    generateContentMock
      .mockResolvedValueOnce(
        fakeGeminiResponse(JSON.stringify({ extracted: [], skipped: [] })),
      )
      .mockResolvedValueOnce(
        fakeGeminiResponse(JSON.stringify({ extracted: [], skipped: [] })),
      );

    await extractCRMRecords(records, ['name', 'email']);

    // 75 records / batch size 50 => 2 batches => 2 calls
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it('retries on failure and succeeds on a later attempt', async () => {
    generateContentMock
      .mockRejectedValueOnce(new Error('transient network error'))
      .mockResolvedValueOnce(
        fakeGeminiResponse(
          JSON.stringify({
            extracted: [{ ...emptyRecord(), email: 'retried@test.com' }],
            skipped: [],
          }),
        ),
      );

    const result = await extractCRMRecords([RAW_RECORD], ['name', 'email']);

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(result.totalImported).toBe(1);
    expect(result.records[0].email).toBe('retried@test.com');
  }, 10_000);

  it('marks the whole batch as skipped after exhausting all retries', async () => {
    generateContentMock.mockRejectedValue(new Error('persistent failure'));

    const result = await extractCRMRecords([RAW_RECORD], ['name', 'email']);

    // MAX_RETRIES = 3
    expect(generateContentMock).toHaveBeenCalledTimes(3);
    expect(result.totalImported).toBe(0);
    expect(result.totalSkipped).toBe(1);
    expect(result.skipped[0].reason).toContain('persistent failure');
  }, 10_000);

  it('treats malformed JSON as a failure and retries', async () => {
    generateContentMock
      .mockResolvedValueOnce(fakeGeminiResponse('not valid json {{{'))
      .mockResolvedValueOnce(
        fakeGeminiResponse(
          JSON.stringify({
            extracted: [{ ...emptyRecord(), email: 'recovered@test.com' }],
            skipped: [],
          }),
        ),
      );

    const result = await extractCRMRecords([RAW_RECORD], ['name', 'email']);

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(result.records[0].email).toBe('recovered@test.com');
  }, 10_000);

  it('maps skipped rowIndex to the correct global offset across batches', async () => {
    const records = Array.from({ length: 51 }, (_, i) => ({
      name: `Lead ${i}`,
      email: i === 50 ? '' : `lead${i}@test.com`, // last record in batch 2 has no email
    }));

    generateContentMock
      .mockResolvedValueOnce(
        fakeGeminiResponse(JSON.stringify({ extracted: [], skipped: [] })),
      )
      .mockResolvedValueOnce(
        fakeGeminiResponse(
          JSON.stringify({
            extracted: [],
            skipped: [{ rowIndex: 0, reason: 'no email or mobile' }],
          }),
        ),
      );

    const result = await extractCRMRecords(records, ['name', 'email']);

    // Batch 2 starts at global offset 50, so local rowIndex 0 => global 50
    expect(result.skipped[0].rowIndex).toBe(50);
  });
});

/** Returns a fully-populated empty CRMRecord shape for test fixtures. */
function emptyRecord() {
  return {
    created_at: '',
    name: '',
    email: '',
    country_code: '',
    mobile_without_country_code: '',
    company: '',
    city: '',
    state: '',
    country: '',
    lead_owner: '',
    crm_status: '',
    crm_note: '',
    data_source: '',
    possession_time: '',
    description: '',
  };
}
