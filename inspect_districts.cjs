const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, address')
    .limit(10);

  if (orders) {
    orders.forEach(o => {
      try {
        const parsed = JSON.parse(o.address);
        console.log(`Order ${o.id}:`, {
          bostaCityCode: parsed.bostaCityCode,
          bostaDistrictId: parsed.bostaDistrictId,
          bostaDistrictName: parsed.bostaDistrictName
        });
      } catch (e) {
        console.log(`Order ${o.id} address is not valid JSON`);
      }
    });
  }
}

run();
