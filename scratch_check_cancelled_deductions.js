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
  // Query cancelled orders with their items
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('status', 'Cancelled');
    
  if (oErr) {
    console.error(oErr);
    return;
  }
  
  console.log(`Found ${orders.length} Cancelled orders.`);
  
  // For each cancelled order, let's check its history and see if there are corresponding 'Return' ledger entries
  const { data: ledger, error: lErr } = await supabase
    .from('stock_ledger')
    .select('*')
    .eq('type', 'Return');
    
  if (lErr) {
    console.error(lErr);
    return;
  }
  
  orders.forEach(o => {
    console.log(`Cancelled Order: ${o.id}, Date: ${o.date}, Client: ${o.client}`);
    o.order_items.forEach(item => {
      // Find matching Return entry in ledger
      const matches = ledger.filter(row => {
        const rowSku = row.variant_sku || row.variantSku;
        return rowSku && rowSku.trim().toLowerCase() === item.variant_sku.trim().toLowerCase() &&
               Math.abs(row.quantity) === Math.abs(item.quantity);
      });
      
      console.log(`  - Item: ${item.variant_sku}, Qty: ${item.quantity}`);
      if (matches.length > 0) {
        console.log(`    Matching Return Ledger row IDs: ${matches.map(m => m.id).join(', ')}`);
      } else {
        console.log(`    WARNING: NO MATCHING RETURN LEDGER ROW FOUND!`);
      }
    });
  });
}

main().catch(err => console.error(err));
