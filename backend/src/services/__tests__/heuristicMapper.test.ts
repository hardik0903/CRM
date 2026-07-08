import { heuristicMapBatch } from '../heuristicMapper';

describe('heuristicMapBatch', () => {
  it('detects email column by header name', () => {
    const records = [
      { Name: 'Alice', Email: 'alice@test.com', Phone: '9876543210' },
    ];
    const { extracted } = heuristicMapBatch(records, ['Name', 'Email', 'Phone'], 0);

    expect(extracted).toHaveLength(1);
    expect(extracted[0].email).toBe('alice@test.com');
    expect(extracted[0].name).toBe('Alice');
  });

  it('detects email column by content analysis when header is unusual', () => {
    const records = [
      { full_name: 'Bob', contact_info: 'bob@example.com', num: '1234567890' },
      { full_name: 'Eve', contact_info: 'eve@example.com', num: '0987654321' },
    ];
    const { extracted } = heuristicMapBatch(
      records,
      ['full_name', 'contact_info', 'num'],
      0,
    );

    expect(extracted.length).toBeGreaterThanOrEqual(1);
    expect(extracted[0].email).toBe('bob@example.com');
  });

  it('detects phone column by header name', () => {
    const records = [
      { name: 'Carol', email: 'carol@test.com', mobile: '9876543210' },
    ];
    const { extracted } = heuristicMapBatch(records, ['name', 'email', 'mobile'], 0);

    expect(extracted[0].mobile_without_country_code).toBe('9876543210');
  });

  it('detects phone column by digit count when header is unusual', () => {
    const records = [
      { person: 'Dave', mail: 'dave@test.com', reach: '(415) 555-0100' },
      { person: 'Fay', mail: 'fay@test.com', reach: '9876543210' },
    ];
    const { extracted } = heuristicMapBatch(
      records,
      ['person', 'mail', 'reach'],
      0,
    );

    expect(extracted.length).toBeGreaterThanOrEqual(1);
    // Phone digits should be extracted
    expect(extracted[0].mobile_without_country_code).toBe('4155550100');
  });

  it('skips records with neither email nor phone', () => {
    const records = [
      { name: 'Ghost', note: 'no contact info at all' },
    ];
    const { extracted, skipped } = heuristicMapBatch(records, ['name', 'note'], 0);

    expect(extracted).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toContain('Heuristic');
  });

  it('adds [heuristic-mapped] to crm_note', () => {
    const records = [
      { name: 'Hera', email: 'hera@test.com', phone: '1234567890' },
    ];
    const { extracted } = heuristicMapBatch(records, ['name', 'email', 'phone'], 0);

    expect(extracted[0].crm_note).toBe('[heuristic-mapped]');
  });

  it('applies global offset to skipped row indices', () => {
    const records = [
      { name: 'NoContact', note: 'nothing' },
    ];
    const { skipped } = heuristicMapBatch(records, ['name', 'note'], 50);

    expect(skipped[0].rowIndex).toBe(50);
  });

  it('handles a full batch with mixed valid and invalid records', () => {
    const records = [
      { name: 'Valid1', email: 'v1@test.com', phone: '1111111111', note: '' },
      { name: 'Invalid', email: '', phone: '', note: 'no contacts' },
      { name: 'Valid2', email: 'v2@test.com', phone: '2222222222', note: '' },
    ];
    const { extracted, skipped } = heuristicMapBatch(
      records,
      ['name', 'email', 'phone', 'note'],
      0,
    );

    expect(extracted).toHaveLength(2);
    expect(skipped).toHaveLength(1);
    expect(extracted[0].name).toBe('Valid1');
    expect(extracted[1].name).toBe('Valid2');
  });

  it('detects company, city, state, country columns', () => {
    const records = [
      {
        name: 'Zeus',
        email: 'zeus@olympus.com',
        company: 'Olympus Inc',
        city: 'Athens',
        state: 'Attica',
        country: 'Greece',
      },
    ];
    const { extracted } = heuristicMapBatch(
      records,
      ['name', 'email', 'company', 'city', 'state', 'country'],
      0,
    );

    expect(extracted[0].company).toBe('Olympus Inc');
    expect(extracted[0].city).toBe('Athens');
    expect(extracted[0].state).toBe('Attica');
    expect(extracted[0].country).toBe('Greece');
  });
});
