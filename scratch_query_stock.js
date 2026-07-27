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
  const productId = 'PROD-731';
  
  // Get product
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();
    
  console.log("Product:", product);
  
  // Get variants
  const { data: variants } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId);
    
  console.log("Variants:", variants);
}

main().catch(err => console.error(err));
