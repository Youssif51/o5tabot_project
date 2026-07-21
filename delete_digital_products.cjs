// Script to delete digital/virtual products from LOCAL system only
// This does NOT touch Shopify at all - only removes from Supabase DB
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://skvwhgcclmvejmpsgkes.supabase.co';
const supabaseKey = 'sb_publishable_ybVS0yt1S0X1iCbnwTNsJg_qcWydQS2';

const supabase = createClient(supabaseUrl, supabaseKey);

// Target collection names to remove (digital/virtual products)
const TARGET_COLLECTION_NAMES = [
    'TikTok Coins',
    'PUBG Korean',
    'PUBG Global',
    'Digital Top-Up'
];

async function main() {
    console.log('=== Deleting Digital Products from LOCAL System Only ===');
    console.log('⚠️  Shopify will NOT be touched!\n');

    // 1. Fetch collections
    const { data: collections, error: colErr } = await supabase
        .from('shopify_collections')
        .select('*');

    if (colErr) {
        console.error('Error fetching collections:', colErr);
        return;
    }

    console.log(`Found ${collections.length} total collections in system.`);

    // Find target collections
    const targetCollections = collections.filter(c =>
        TARGET_COLLECTION_NAMES.some(name => c.title.includes(name))
    );

    if (targetCollections.length === 0) {
        console.log('No matching digital collections found!');
        console.log('Available collections:', collections.map(c => `  - ${c.title} (ID: ${c.id})`).join('\n'));
        return;
    }

    console.log('\n📋 Target collections to clean:');
    targetCollections.forEach(c => console.log(`  - ${c.title} (ID: ${c.id})`));

    const targetCollectionIds = targetCollections.map(c => String(c.id));

    // 2. Fetch all products
    const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('*');

    if (prodErr) {
        console.error('Error fetching products:', prodErr);
        return;
    }

    console.log(`\nTotal products in system: ${products.length}`);

    // 3. Find products belonging to target collections
    const productsToDelete = products.filter(p => {
        const collIds = p.shopify_collection_ids || p.shopifyCollectionIds || [];
        return collIds.some(id => targetCollectionIds.includes(String(id)));
    });

    if (productsToDelete.length === 0) {
        console.log('\n✅ No products found in the target collections. Nothing to delete.');
        console.log('\nLet me check product fields to debug...');
        // Show sample product structure
        if (products.length > 0) {
            const sample = products[0];
            console.log('Sample product keys:', Object.keys(sample));
            console.log('shopify_collection_ids:', sample.shopify_collection_ids);
            console.log('shopifyCollectionIds:', sample.shopifyCollectionIds);
        }
        return;
    }

    console.log(`\n🗑️  Products to delete (${productsToDelete.length}):`);
    productsToDelete.forEach(p => console.log(`  - ${p.name} (ID: ${p.id})`));

    // 4. Delete product variants first
    const productIds = productsToDelete.map(p => p.id);

    console.log('\n🔄 Deleting product variants...');
    const { error: varErr } = await supabase
        .from('product_variants')
        .delete()
        .in('product_id', productIds);

    if (varErr) {
        console.error('Error deleting variants:', varErr);
    } else {
        console.log('✅ Product variants deleted.');
    }

    // 5. Delete products
    console.log('🔄 Deleting products...');
    const { error: delErr } = await supabase
        .from('products')
        .delete()
        .in('id', productIds);

    if (delErr) {
        console.error('Error deleting products:', delErr);
    } else {
        console.log('✅ Products deleted from Supabase.');
    }

    // 6. Optionally delete the collections themselves from local
    console.log('🔄 Deleting digital collections from local system...');
    const targetDbIds = targetCollections.map(c => c.id);
    const { error: colDelErr } = await supabase
        .from('shopify_collections')
        .delete()
        .in('id', targetDbIds);

    if (colDelErr) {
        console.error('Error deleting collections:', colDelErr);
    } else {
        console.log('✅ Digital collections removed from local system.');
    }

    console.log('\n=== DONE ===');
    console.log(`Deleted ${productsToDelete.length} digital products from local system.`);
    console.log('🛡️  Shopify was NOT touched - all products remain on your Shopify store.');
    console.log('\n⚡ Please refresh your app (F5) to see the changes.');
}

main().catch(console.error);
