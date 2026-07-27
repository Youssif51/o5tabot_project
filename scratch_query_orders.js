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
  const variantSku = 'OCT-SKU-731';
  
  // Find order items with this sku
  const { data: orderItems, error: oiErr } = await supabase
    .from('order_items')
    .select('*, orders(*)')
    .eq('variant_sku', variantSku);
    
  if (oiErr) {
    console.error("Error fetching order items:", oiErr);
    return;
  }
  
  console.log(`Found ${orderItems.length} order items matching SKU ${variantSku}:`);
  orderItems.forEach(oi => {
    const order = oi.orders;
    console.log(`Order ID: ${oi.order_id}, Date: ${order?.date || order?.created_at}, Status: ${order?.status}, Qty: ${oi.quantity}, Shopify ID: ${order?.shopify_id || 'N/A'}`);
  });
}

main().catch(err => console.error(err));
