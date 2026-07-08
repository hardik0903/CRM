import { parseCSV } from '../csvParser';

describe('parseCSV', () => {
  it('should parse a standard CSV buffer', async () => {
    const csv = 'Name,Email,Phone\nJohn,john@test.com,1234567890\nJane,jane@test.com,0987654321';
    const buffer = Buffer.from(csv, 'utf-8');
    const result = await parseCSV(buffer);
    expect(result.headers).toEqual(['Name', 'Email', 'Phone']);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toEqual({ Name: 'John', Email: 'john@test.com', Phone: '1234567890' });
  });

  it('should handle UTF-8 BOM', async () => {
    const csv = '\uFEFFName,Email\nTest,test@test.com';
    const buffer = Buffer.from(csv, 'utf-8');
    const result = await parseCSV(buffer);
    expect(result.headers).toEqual(['Name', 'Email']);
    expect(result.records[0].Name).toBe('Test');
  });

  it('should trim whitespace from values', async () => {
    const csv = 'Name,Email\n  John  ,  john@test.com  ';
    const buffer = Buffer.from(csv, 'utf-8');
    const result = await parseCSV(buffer);
    expect(result.records[0].Name).toBe('John');
    expect(result.records[0].Email).toBe('john@test.com');
  });

  it('should skip empty lines', async () => {
    const csv = 'Name,Email\nJohn,john@test.com\n\n\nJane,jane@test.com';
    const buffer = Buffer.from(csv, 'utf-8');
    const result = await parseCSV(buffer);
    expect(result.records).toHaveLength(2);
  });

  it('should reject CSV with no headers', async () => {
    const buffer = Buffer.from('', 'utf-8');
    await expect(parseCSV(buffer)).rejects.toThrow();
  });

  it('should handle quoted fields with commas', async () => {
    const csv = 'Name,Note\n"Doe, John","Has 3 offices, all in Mumbai"';
    const buffer = Buffer.from(csv, 'utf-8');
    const result = await parseCSV(buffer);
    expect(result.records[0].Name).toBe('Doe, John');
    expect(result.records[0].Note).toBe('Has 3 offices, all in Mumbai');
  });

  it('should handle CSV with only headers and no data', async () => {
    const csv = 'Name,Email,Phone';
    const buffer = Buffer.from(csv, 'utf-8');
    const result = await parseCSV(buffer);
    expect(result.headers).toEqual(['Name', 'Email', 'Phone']);
    expect(result.records).toHaveLength(0);
  });
});
