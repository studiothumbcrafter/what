const { match } = require('../services/matcher');

describe('Property matching engine', () => {
  const props = [
    { id: '1', title: '2BHK Mumbai', rent: 12000, location: 'mumbai', bedrooms: 2, status: 'available' },
    { id: '2', title: '3BHK Mumbai', rent: 15000, location: 'mumbai', bedrooms: 3, status: 'available' },
    { id: '3', title: '2BHK Delhi', rent: 10000, location: 'delhi', bedrooms: 2, status: 'available' },
    { id: '4', title: '2BHK Mumbai Rented', rent: 11000, location: 'mumbai', bedrooms: 2, status: 'rented' },
    { id: '5', title: 'Luxury 2BHK Mumbai', rent: 22000, location: 'mumbai', bedrooms: 2, status: 'available' },
  ];

  test('returns empty for no properties', () => {
    const results = match({ budgetMax: 12000, location: 'mumbai', bedrooms: 2 }, []);
    expect(results).toEqual([]);
  });

  test('returns matching properties with reasons', () => {
    const results = match({ budgetMax: 12000, location: 'mumbai', bedrooms: 2 }, props);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].property).toBeDefined();
    expect(results[0].matchReasons).toBeDefined();
    expect(Array.isArray(results[0].matchReasons)).toBe(true);
  });

  test('excludes properties over budget', () => {
    const results = match({ budgetMax: 12000, location: 'mumbai', bedrooms: 2 }, props);
    const overBudget = results.find(r => r.property.rent > 12000);
    expect(overBudget).toBeUndefined();
  });

  test('excludes properties in wrong location', () => {
    const results = match({ budgetMax: 12000, location: 'mumbai', bedrooms: 2 }, props);
    const wrongLoc = results.find(r => r.property.location !== 'mumbai');
    expect(wrongLoc).toBeUndefined();
  });

  test('excludes unavailable properties', () => {
    const results = match({ budgetMax: 12000, location: 'mumbai', bedrooms: 2 }, props);
    const unavailable = results.find(r => r.property.status !== 'available');
    expect(unavailable).toBeUndefined();
  });

  test('returns max 3 results', () => {
    const manyProps = [
      { id: '1', title: 'A', rent: 10000, location: 'mumbai', bedrooms: 2, status: 'available' },
      { id: '2', title: 'B', rent: 10000, location: 'mumbai', bedrooms: 2, status: 'available' },
      { id: '3', title: 'C', rent: 10000, location: 'mumbai', bedrooms: 2, status: 'available' },
      { id: '4', title: 'D', rent: 10000, location: 'mumbai', bedrooms: 2, status: 'available' },
      { id: '5', title: 'E', rent: 10000, location: 'mumbai', bedrooms: 2, status: 'available' },
    ];
    const results = match({ budgetMax: 12000, location: 'mumbai', bedrooms: 2 }, manyProps);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test('flexibility allows budget stretch', () => {
    const results = match({ budgetMax: 12000, location: 'mumbai', bedrooms: 2, flexibility: 1 }, props);
    const ids = results.map(r => r.property.id);
    expect(ids).toContain('5'); // Luxury 2BHK Mumbai at 22000 should appear with flexibility
  });

  test('flexibility is off by default - over-budget properties excluded', () => {
    const results = match({ budgetMax: 12000, location: 'mumbai', bedrooms: 2 }, props);
    const ids = results.map(r => r.property.id);
    expect(ids).not.toContain('5'); // Luxury 2BHK at 22000 excluded without flexibility
  });

  test('ranks exact matches higher', () => {
    const results = match({ budgetMax: 12000, location: 'mumbai', bedrooms: 2 }, props);
    const first = results[0];
    expect(first.property.id).toBe('1'); // Exact match: 2BHK, 12000, mumbai
  });
});
