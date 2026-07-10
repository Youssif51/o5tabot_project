import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://skvwhgcclmvejmpsgkes.supabase.co',
  'sb_publishable_ybVS0yt1S0X1iCbnwTNsJg_qcWydQS2'
);

async function run() {
  const { data, error } = await supabase.from('product_variants').select('sku, name').limit(5);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("SKUs available in database:");
    console.log(JSON.stringify(data, null, 2));
  }
}
run();
