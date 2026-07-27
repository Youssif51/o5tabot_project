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
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('*, order_items(*)');
    
  if (oErr) {
    console.error(oErr);
    return;
  }
  
  console.log(`Found ${orders.length} total orders.`);
  orders.forEach(o => {
    const itemsStr = o.order_items.map(item => `${item.variant_sku} (Qty: ${item.quantity})`).join(', ');
    console.log(`Order: ${o.id}, Status: ${o.status}, Source: ${o.source}, Items: [${itemsStr}]`);
  });
}

main().catch(err => console.error(err));
