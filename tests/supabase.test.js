process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const { supabaseAdmin, supabaseClient } = require('../services/supabase');

describe('Supabase client setup', () => {
  test('supabaseAdmin is defined', () => {
    expect(supabaseAdmin).toBeDefined();
  });

  test('supabaseClient is a function', () => {
    expect(typeof supabaseClient).toBe('function');
  });

  test('supabaseClient returns a client instance', () => {
    const client = supabaseClient();
    expect(client).toBeDefined();
    expect(client.from).toBeDefined();
  });
});
