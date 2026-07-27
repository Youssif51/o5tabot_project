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
  const { data: items, error } = await supabase
    .from('order_items')
    .select('*, orders(*)')
    .eq('variant_sku', 'OCT-SKU-731')
    .order('id', { ascending: true });
    
  if (error) {
    console.error(error);
    return;
  }
  
  items.forEach(item => {
    console.log(`OrderItemID: ${item.id} | OrderID: ${item.order_id} | Qty: ${item.quantity} | Status: ${item.orders?.status} | Date: ${item.orders?.date} | CreatedAt: ${item.orders?.created_at}`);
  });
}

main().catch(err => console.error(err));
