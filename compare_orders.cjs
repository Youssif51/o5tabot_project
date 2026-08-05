const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: o2928 } = await supabase.from('orders').select('id, source, created_by, updated_by, status').eq('id', 'ORD-2026-2928').single();
  const { data: o4016 } = await supabase.from('orders').select('id, source, created_by, updated_by, status').eq('id', 'ORD-2026-4016').single();

  console.log("ORD-2026-2928 details:", o2928);
  console.log("ORD-2026-4016 details:", o4016);
}

run();
