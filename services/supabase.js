// Supabase client setup
// Stage 2: Multi-tenant database with Supabase PostgreSQL + Auth

const { createClient } = require('@supabase/supabase-js');

// Admin client (server-side only, bypasses RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false }, db: { schema: 'public' } },
);

// Anon client factory (per-request, user-scoped)
function supabaseClient(accessToken) {
  return createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false, accessToken }, db: { schema: 'public' } },
  );
}

module.exports = { supabaseAdmin, supabaseClient };
