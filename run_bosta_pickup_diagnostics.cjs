const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseAnonKey = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Fetching pickup locations from deployed Edge Function...");
  const { data, error } = await supabase.functions.invoke('get-bosta-error', {
    body: {}
  });
  console.log("Pickup Locations Data:", JSON.stringify(data, null, 2));
}

run();
