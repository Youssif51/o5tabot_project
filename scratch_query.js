import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env manually
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    env[key] = val;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const productId = 'PROD-731';
  
  const { data: ledger, error: lErr } = await supabase
    .from('stock_ledger')
    .select('*')
    .eq('product_id', productId)
    .order('id', { ascending: true });
    
  if (lErr) {
    console.error("Error fetching stock ledger:", lErr);
    return;
  }
  
  console.log(JSON.stringify(ledger, null, 2));
}

main().catch(err => console.error(err));
