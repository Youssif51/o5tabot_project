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
  // Query all orders from 2026-07-24
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('date', '2026-07-24');
    
  if (oErr) {
    console.error(oErr);
    return;
  }
  
  console.log("Orders on 2026-07-24:");
  orders.forEach(o => {
    console.log(`Order ID: ${o.id}, Status: ${o.status}, Client: ${o.client}, Source: ${o.source}, Created By: ${o.created_by}, Updated At: ${o.updated_at || o.created_at || 'N/A'}`);
    o.order_items.forEach(item => {
      console.log(`  - Sku: ${item.variant_sku}, Qty: ${item.quantity}`);
    });
  });
}

main().catch(err => console.error(err));
