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
  // Fetch all variants
  const { data: variants, error: vErr } = await supabase
    .from('product_variants')
    .select('sku, stock_sulur, product_id, name');
    
  if (vErr) {
    console.error("Error fetching variants:", vErr);
    return;
  }
  
  // Fetch all stock ledger rows
  const { data: ledger, error: lErr } = await supabase
    .from('stock_ledger')
    .select('*');
    
  if (lErr) {
    console.error("Error fetching stock ledger:", lErr);
    return;
  }
  
  console.log(`Analyzing ${variants.length} variants and ${ledger.length} ledger rows...`);
  
  const ledgerSumBySku = {};
  ledger.forEach(row => {
    const sku = row.variant_sku || row.variantSku;
    if (sku) {
      const cleanSku = sku.trim().toLowerCase();
      ledgerSumBySku[cleanSku] = (ledgerSumBySku[cleanSku] || 0) + (row.quantity || 0);
    }
  });
  
  let mismatches = 0;
  variants.forEach(v => {
    if (!v.sku) return;
    const cleanSku = v.sku.trim().toLowerCase();
    const ledgerSum = ledgerSumBySku[cleanSku] || 0;
    const dbStock = v.stock_sulur || 0;
    
    if (ledgerSum !== dbStock) {
      mismatches++;
      console.log(`Mismatch for SKU: ${v.sku} (${v.name}):`);
      console.log(`  - DB Stock: ${dbStock}`);
      console.log(`  - Sum of Ledger Qty: ${ledgerSum}`);
      console.log(`  - Discrepancy: ${dbStock - ledgerSum}`);
      
      // Let's print the ledger rows for this sku in detail
      const skuLedger = ledger.filter(row => {
        const rowSku = row.variant_sku || row.variantSku;
        return rowSku && rowSku.trim().toLowerCase() === cleanSku;
      }).sort((a,b) => a.id - b.id);
      
      console.log(`  - Ledger Rows:`);
      skuLedger.forEach(row => {
        console.log(`    [ID: ${row.id}] Date: ${row.date}, Type: ${row.type}, Qty: ${row.quantity}, Balance After: ${row.balance_after}, Notes: ${row.notes}`);
      });
    }
  });
  
  console.log(`\nAnalysis complete. Found ${mismatches} mismatching variants.`);
}

main().catch(err => console.error(err));
