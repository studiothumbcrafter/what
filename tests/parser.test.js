const { parse } = require('../services/parser');

const cases = [
  { msg: 'I need a 2BHK under ₹12,000', expected: { bedrooms: 2, budgetMax: 12000 } },
  { msg: 'I need a furnished house with parking', expected: { furnishing: 'furnished', parking: 1 } },
  { msg: 'I need a house near my workplace in mumbai', expected: { location: 'mumbai' } },
  { msg: 'I need a family-friendly home with a balcony', expected: { balcony: 1 } },
  { msg: 'I need a house available next month', expected: { availabilityDate: '2026-12-01' } },
  { msg: 'मुंबई में घर चाहिए', expected: { location: 'mumbai' } },
  { msg: '3 bedroom under 15k', expected: { bedrooms: 3, budgetMax: 15000 } },
  { msg: 'semi-furnished 2BHK with balcony and parking', expected: { furnishing: 'semi-furnished', bedrooms: 2, balcony: 1, parking: 1 } },
];

describe('Requirement parser', () => {
  test.each(cases)('parses: $msg', ({ msg, expected }) => {
    const res = parse(msg);
    for (const key of Object.keys(expected)) {
      expect(res.requirements[key]).toBe(expected[key]);
    }
  });
});
