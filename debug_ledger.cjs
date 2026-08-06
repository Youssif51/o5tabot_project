const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: ledger } = await supabase
    .from('stock_ledger')
    .select('*')
    .eq('variant_sku', 'OCT-SKU-731-2')
    .order('id', { ascending: true });

  console.log("Ledger for OCT-SKU-731-2:");
  console.log(ledger);

  const { data: v } = await supabase
    .from('product_variants')
    .select('stock_sulur')
    .eq('sku', 'OCT-SKU-731-2')
    .single();

  console.log("Current stock_sulur in DB:", v.stock_sulur);
}

run().catch(console.error);
