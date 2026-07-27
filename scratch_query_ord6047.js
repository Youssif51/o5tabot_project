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
  const { data: o, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', 'ORD-2026-6047')
    .maybeSingle();
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('Order ORD-2026-6047:', o);
}

main().catch(err => console.error(err));
