require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipeTable(tableName) {
  console.log(`Wiping ${tableName}...`);
  // Deleting rows where id is not null (which means all rows)
  const { data, error } = await supabase
    .from(tableName)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Assuming uuid or similar, neq an impossible id deletes all
    
  if (error) {
    // If the table doesn't have an 'id' column, we can try another approach
    console.error(`Error wiping ${tableName} with fast delete:`, error.message);
    // Fallback: select all ids then delete them in batches?
    const { data: allData } = await supabase.from(tableName).select('*');
    if (allData && allData.length > 0) {
      console.log(`Fallback: Wiping ${allData.length} records manually from ${tableName}...`);
      for (const item of allData) {
        if (item.id) {
          await supabase.from(tableName).delete().eq('id', item.id);
        } else if (item.product_id && item.sku) { // For variants maybe
           await supabase.from(tableName).delete().match({ product_id: item.product_id, sku: item.sku });
        } else if (item.order_id && item.variant_sku) { 
           await supabase.from(tableName).delete().match({ order_id: item.order_id, variant_sku: item.variant_sku });
        } else {
          console.log(`Cannot delete item from ${tableName} (no ID recognized)`);
        }
      }
      console.log(`${tableName} fallback wipe complete.`);
    } else {
      console.log(`${tableName} is already empty.`);
    }
  } else {
    console.log(`${tableName} wiped successfully.`);
  }
}

async function run() {
  console.log("Starting database wipe...");
  
  // Must delete in order to avoid foreign key constraints
  const tables = [
    'stock_ledger',
    'order_items',
    'orders',
    'purchase_order_items',
    'purchase_orders',
    'wastes',
    'adjustments',
    'product_variants',
    'products',
    'activities',
    'customers',
    'suppliers'
  ];

  for (const table of tables) {
    await wipeTable(table);
  }

  console.log("Database wipe completed.");
}

run();
