import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map English province/governorate names to system's Arabic names
const governorateMap: Record<string, string> = {
  "cairo": "القاهرة",
  "giza": "الجيزة",
  "alexandria": "الإسكندرية",
  "alex": "الإسكندرية",
  "qalyubia": "القليوبية",
  "qalyubeya": "القليوبية",
  "dakahlia": "الدقهلية",
  "sohag": "سوهاج",
  "beheira": "البحيرة",
  "gharbia": "الغربية",
  "monufia": "المنوفية",
  "sharqia": "الشرقية",
  "damietta": "دمياط",
  "kafr el-sheikh": "كفر الشيخ",
  "fayoum": "الفيوم",
  "beni suef": "بني سويف",
  "minya": "المنيا",
  "assiut": "أسيوط",
  "qena": "قنا",
  "luxor": "الأقصر",
  "aswan": "أسوان",
  "red sea": "البحر الأحمر",
  "new valley": "الوادي الجديد",
  "matrouh": "مطروح",
  "north sinai": "شمال سيناء",
  "south sinai": "جنوب سيناء",
  "port said": "بورسعيد",
  "ismailia": "الإسماعيلية",
  "suez": "السويس"
};

function mapGovernorate(province: string | null | undefined): string {
  if (!province) return "القاهرة";
  const clean = province.trim().toLowerCase().replace(" governorate", "").replace(" el ", " ").replace(" el-", " ");
  return governorateMap[clean] || province;
}

// Normalize phone to 11 digits (Egyptian standard: 01XXXXXXXXX)
function normalizePhone(phoneStr: string | null | undefined): string {
  if (!phoneStr) return "";
  let cleaned = phoneStr.replace(/\D/g, "");
  if (cleaned.startsWith("20") && cleaned.length > 10) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.length === 10 && !cleaned.startsWith("0")) {
    cleaned = "0" + cleaned;
  }
  if (cleaned.length > 11) {
    cleaned = cleaned.substring(cleaned.length - 11);
  }
  return cleaned;
}

// Dynamically resolve, match, link or create local variant from Shopify line item
async function resolveLocalVariantSku(supabase: any, item: any, shopifyProductId: string, productName: string, trace: string[]): Promise<string> {
  const titleLower = (productName || "").toLowerCase();
  const words = titleLower.split(/[\s_\-\/\.\,]+/);
  const isDigital = ["tiktok", "pubg", "coins", "top-up", "top up", "bundle", "prime plus"].some(kw => titleLower.includes(kw)) || words.includes("uc");
  trace.push(`isDigital = ${isDigital}`);
  if (isDigital) {
    return "DIGITAL-ITEM";
  }

  const shopifyVariantId = String(item.variant_id);
  const itemSku = item.sku ? item.sku.trim() : "";
  const variantTitle = item.variant_title || "Standard Option";
  trace.push(`shopifyVariantId = ${shopifyVariantId}, itemSku = ${itemSku}, variantTitle = ${variantTitle}`);

  // Step 1: Check by shopify_id in product_variants
  const { data: vByShopifyId, error: e1 } = await supabase
    .from("product_variants")
    .select("sku")
    .eq("shopify_id", shopifyVariantId)
    .maybeSingle();
  trace.push(`Step 1 (by shopify_id): found = ${!!vByShopifyId}, error = ${e1 ? JSON.stringify(e1) : 'none'}`);
  if (vByShopifyId) return vByShopifyId.sku;

  // Step 2: Check by SKU in product_variants
  if (itemSku) {
    const { data: vBySku, error: e2 } = await supabase
      .from("product_variants")
      .select("sku, product_id")
      .eq("sku", itemSku)
      .maybeSingle();
    trace.push(`Step 2 (by SKU): found = ${!!vBySku}, error = ${e2 ? JSON.stringify(e2) : 'none'}`);
    if (vBySku) {
      // Link them permanently since SKU matches
      const { error: up1 } = await supabase.from("product_variants").update({ shopify_id: shopifyVariantId }).eq("sku", itemSku);
      const { error: up2 } = await supabase.from("products").update({ shopify_id: shopifyProductId }).eq("id", vBySku.product_id);
      trace.push(`Step 2: updates error = ${up1 ? JSON.stringify(up1) : 'none'} / ${up2 ? JSON.stringify(up2) : 'none'}`);
      return vBySku.sku;
    }
  }

  // Step 3: Check by Product Name + Variant Name
  const { data: pByName, error: e3 } = await supabase
    .from("products")
    .select("id")
    .ilike("name", productName.trim())
    .maybeSingle();
  trace.push(`Step 3 products (by name): found = ${!!pByName}, error = ${e3 ? JSON.stringify(e3) : 'none'}`);

  if (pByName) {
    const { data: vByName, error: e4 } = await supabase
      .from("product_variants")
      .select("sku")
      .eq("product_id", pByName.id)
      .ilike("name", variantTitle.trim() === "Default Title" ? "Standard Option" : variantTitle.trim())
      .maybeSingle();
    trace.push(`Step 3 variants (by product_id & name): found = ${!!vByName}, error = ${e4 ? JSON.stringify(e4) : 'none'}`);
    
    if (vByName) {
      // Link them permanently
      const { error: up1 } = await supabase.from("product_variants").update({ shopify_id: shopifyVariantId }).eq("sku", vByName.sku);
      const { error: up2 } = await supabase.from("products").update({ shopify_id: shopifyProductId }).eq("id", pByName.id);
      trace.push(`Step 3: updates error = ${up1 ? JSON.stringify(up1) : 'none'} / ${up2 ? JSON.stringify(up2) : 'none'}`);
      return vByName.sku;
    }
  }

  // Step 4: Dynamically import/create product and variant if no match found
  trace.push(`Step 4: Dynamically importing...`);
  
  let localProductId = crypto.randomUUID();
  if (pByName) {
    localProductId = pByName.id;
  } else {
    // Insert new product
    await supabase.from("products").insert([{
      id: localProductId,
      name: productName,
      category: "Shopify Sync",
      unit: "Piece",
      shopify_id: shopifyProductId,
      description: "Dynamically imported via order webhook."
    }]);
  }

  // Insert new variant
  const finalSku = itemSku || `SKU-${Math.random().toString(36).substring(2,8).toUpperCase()}`;
  await supabase.from("product_variants").insert([{
    product_id: localProductId,
    sku: finalSku,
    name: variantTitle === "Default Title" ? "Standard Option" : variantTitle,
    shopify_id: shopifyVariantId,
    retail_price: parseFloat(item.price) || 0,
    wholesale_price: 0,
    stock_sulur: 0
  }]);

  return finalSku;
}

// Verify Shopify Webhook signature
async function verifyShopifyWebhook(bodyText: string, hmacHeader: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const bodyBuf = encoder.encode(bodyText);
  const signatureBuf = await crypto.subtle.sign("HMAC", key, bodyBuf);
  
  const signatureBytes = new Uint8Array(signatureBuf);
  let binary = "";
  for (let i = 0; i < signatureBytes.byteLength; i++) {
    binary += String.fromCharCode(signatureBytes[i]);
  }
  const computedHmac = btoa(binary);
  
  return computedHmac === hmacHeader;
}

async function generateUniqueOrderId(supabase: any): Promise<string> {
  const year = new Date().getFullYear();
  let unique = false;
  let orderId = "";
  
  while (!unique) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    orderId = `ORD-${year}-${rand}`;
    const { data } = await supabase
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .maybeSingle();
    if (!data) {
      unique = true;
    }
  }
  return orderId;
}

function deduplicateProductName(name: any): string {
  if (name === null || name === undefined) return '';
  let cleanName = String(name).trim();

  // Strip out (أساسي) or (اساسي) or (أساسى) or (اساسيه) or (Default Title) or (Standard Option) from name
  cleanName = cleanName.replace(/\s*\((أساسي|اساسي|أساسى|اساسيه|Default Title|Standard Option)\)\s*/gi, '').trim();
  
  // Check if it's split by hyphen "Product - Product"
  const parts = cleanName.split(/\s+-\s+/);
  if (parts.length === 2 && parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) {
    return parts[0].trim();
  }
  
  // Check if it's exactly duplicated "Product A Product A"
  const words = cleanName.split(/\s+/);
  if (words.length > 1 && words.length % 2 === 0) {
    const halfLen = words.length / 2;
    const firstHalf = words.slice(0, halfLen).join(' ');
    const secondHalf = words.slice(halfLen).join(' ');
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      return firstHalf;
    }
  }
  
  return cleanName;
}

function cleanVariantName(productName: any, variantName: any): string {
  let pName = deduplicateProductName(productName);
  let vName = String(variantName || '').trim();

  if (!vName) return '';

  const defaultTerms = ['default title', 'standard option', 'standard', 'default', 'أساسي', 'اساسي', 'أساسى', 'أساسيه', 'اساسيه'];

  // Strip default terms completely
  if (defaultTerms.includes(vName.toLowerCase())) {
    return '';
  }

  // Strip out default terms or product name if present
  pName = pName.replace(/\s*\((أساسي|اساسي|أساسى|اساسيه|Default Title|Standard Option)\)\s*/gi, '').trim();

  const basePName = pName.replace(/\s*\d+$/, '').trim();

  let prevVName = '';
  while (vName && vName !== prevVName) {
    prevVName = vName;
    vName = vName.trim();
    if (pName && vName.toLowerCase().startsWith(pName.toLowerCase())) {
      vName = vName.slice(pName.length).trim();
    } else if (basePName && vName.toLowerCase().startsWith(basePName.toLowerCase())) {
      vName = vName.slice(basePName.length).trim();
    }
    
    // Clean leading/trailing spaces, hyphens, slashes, or other separators
    vName = vName.replace(/^[-\s/|\\#@#_]+|[-\s/|\\#@#_]+$/g, '').trim();
    
    // Safe parenthesis stripping
    if (vName.startsWith('(') && vName.endsWith(')')) {
      vName = vName.slice(1, -1).trim();
    }
  }

  if (!vName || defaultTerms.includes(vName.toLowerCase()) || vName.toLowerCase() === pName.toLowerCase() || vName.toLowerCase() === basePName.toLowerCase()) {
    return '';
  }

  return vName;
}

// @ts-ignore - Deno is global in Supabase Edge Functions runtime
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Headers received:", Object.fromEntries(req.headers.entries()));
    const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256") || req.headers.get("x-shopify-hmac-sha256");
    const webhookSecret = Deno.env.get("SHOPIFY_WEBHOOK_SECRET");
    const testBypass = req.headers.get("X-Test-Bypass") === "true" || req.headers.get("x-test-bypass") === "true";

    if (!hmacHeader && !testBypass) {
      return new Response(JSON.stringify({ error: "Missing HMAC signature header." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!webhookSecret && !testBypass) {
      return new Response(JSON.stringify({ error: "Edge function missing SHOPIFY_WEBHOOK_SECRET environment variable." }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Read raw body as text for verification
    const rawBody = await req.text();
    const verified = testBypass ? true : await verifyShopifyWebhook(rawBody, hmacHeader!, webhookSecret!);

    if (!verified) {
      console.warn("HMAC verification failed.");
      return new Response(JSON.stringify({ error: "Invalid signature verification." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Now safe to parse the JSON
    const payload = JSON.parse(rawBody);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const topic = req.headers.get("X-Shopify-Topic") || req.headers.get("x-shopify-topic") || "";

    // Reject checkout events - we only process fully placed orders
    if (topic.startsWith("checkouts/") || topic.startsWith("draft_orders/")) {
      console.log(`Ignoring non-order webhook topic: ${topic}`);
      return new Response(JSON.stringify({ success: true, message: "Checkout/draft event ignored." }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    console.log("Received Shopify Webhook Topic:", topic);

    // Handle Collection Webhooks
    if (topic.includes("collection")) {
      const collectionId = String(payload.id);

      if (topic.includes("delete")) {
        console.log(`Deleting collection: ${collectionId}`);
        const { error } = await supabase
          .from("shopify_collections")
          .delete()
          .eq("id", collectionId);
        
        if (error) {
          console.error("Error deleting collection from DB:", error);
          return new Response(JSON.stringify({ error: "Failed to delete collection" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        return new Response(JSON.stringify({ success: true, message: "Collection deleted successfully" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } else {
        // Create or Update
        console.log(`Upserting collection: ${collectionId} - ${payload.title}`);
        const { error } = await supabase
          .from("shopify_collections")
          .upsert({
            id: collectionId,
            title: payload.title,
            handle: payload.handle,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error("Error upserting collection to DB:", error);
          return new Response(JSON.stringify({ error: "Failed to upsert collection" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        return new Response(JSON.stringify({ success: true, message: "Collection upserted successfully" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }
    // Handle Product Webhooks (create, update, delete)
    if (topic.includes("product")) {
      const shopifyProductId = String(payload.id);

      if (topic.includes("delete")) {
        console.log(`Deleting/archiving product via webhook: ${shopifyProductId}`);
        const { error } = await supabase
          .from("products")
          .update({ status: "Archived" })
          .eq("shopify_id", shopifyProductId);

        if (error) {
          console.error("Error archiving product via webhook:", error);
          return new Response(JSON.stringify({ error: "Failed to archive product" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        return new Response(JSON.stringify({ success: true, message: "Product archived successfully" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } else {
        // Create or Update Product
        console.log(`Processing product webhook (${topic}): ${shopifyProductId} - ${payload.title}`);

        // Parse images
        let imageUrl = '';
        let imagesArray = [];
        if (payload.images && payload.images.length > 0) {
          imageUrl = (payload.images[0].src || '').split('?')[0];
          imagesArray = payload.images.map((img: any) => (img.src || '').split('?')[0]);
        }
        const tagsStr = payload.tags || '';
        const tagsArray = tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean);
        let finalDescription = payload.body_html || '';

        // Check if product already exists locally by shopify_id or name
        const { data: existingProdByShopify } = await supabase
          .from("products")
          .select("id, name")
          .eq("shopify_id", shopifyProductId)
          .maybeSingle();

        let matchedProduct = existingProdByShopify;
        if (!matchedProduct && payload.title) {
          const { data: existingProdByName } = await supabase
            .from("products")
            .select("id, name")
            .ilike("name", payload.title.trim())
            .maybeSingle();
          matchedProduct = existingProdByName;
        }

        let localProductId = matchedProduct?.id || crypto.randomUUID();

        // 1. Upsert product
        const productData = {
          id: localProductId,
          name: deduplicateProductName(payload.title || 'بدون اسم'),
          category: payload.product_type || 'Uncategorized',
          shopify_id: shopifyProductId,
          image: JSON.stringify({
            images: imagesArray,
            vendor: payload.vendor || '',
            tags: tagsArray.join(', '),
            status: payload.status === 'active' ? 'Active' : 'Draft'
          }),
          description: finalDescription,
          status: payload.status === 'active' ? 'Active' : 'Draft'
        };

        const { error: prodErr } = await supabase.from("products").upsert([productData]);
        if (prodErr) {
          console.error("Error upserting product via webhook:", prodErr);
          return new Response(JSON.stringify({ error: "Failed to upsert product" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 2. Process variants
        const shopifyVariants = payload.variants || [];
        const { data: localVariants } = await supabase
          .from("product_variants")
          .select("*")
          .eq("product_id", localProductId);

        const localVarsList = localVariants || [];

        for (const sv of shopifyVariants) {
          let sku = sv.sku;
          if (!sku) {
            sku = `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          }

          let variantName = cleanVariantName(payload.title, sv.title) || 'Standard Option';

          // Try to match variant by shopify_id or sku
          const matchedVar = localVarsList.find(lv => String(lv.shopify_id) === String(sv.id) || (sv.sku && lv.sku.toLowerCase() === sv.sku.trim().toLowerCase()));

          const variantData = {
            product_id: localProductId,
            name: variantName,
            sku: matchedVar?.sku || sku,
            barcode: sv.barcode || '',
            retail_price: parseFloat(sv.price) || 0,
            shopify_id: String(sv.id),
            // Keep existing stock & wholesale price if matched, otherwise defaults
            wholesale_price: matchedVar?.wholesale_price || 0,
            stock_sulur: matchedVar?.stock_sulur || 0
          };

          const { error: varErr } = await supabase.from("product_variants").upsert([variantData]);
          if (varErr) {
            console.error(`Error upserting variant ${sku} via webhook:`, varErr);
          }
        }

        return new Response(JSON.stringify({ success: true, message: "Product processed successfully via webhook" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    const shopifyOrderId = String(payload.id);

    // 1. Prevent duplicates
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("shopify_order_id", shopifyOrderId)
      .maybeSingle();

    if (existingOrder) {
      if (topic.includes("cancelled") || payload.cancelled_at) {
        console.log(`Updating order ${shopifyOrderId} status to Cancelled via Webhook...`);
        
        // 1. Check if order has a deposit
        const { data: orderDetails } = await supabase
          .from("orders")
          .select("deposit, deposit_receiver_id, deposit_status")
          .eq("id", existingOrder.id)
          .maybeSingle();

        const dbUpdate: Record<string, any> = { status: "Cancelled" };
        if (
          orderDetails && 
          (parseFloat(orderDetails.deposit) || 0) > 0 && 
          orderDetails.deposit_receiver_id &&
          (orderDetails.deposit_status === 'confirmed' || orderDetails.deposit_status === 'received' || orderDetails.deposit_status === 'pending')
        ) {
          dbUpdate.deposit_refund_status = 'awaiting_return';
        }

        await supabase.from("orders").update(dbUpdate).eq("id", existingOrder.id);

        // 2. Check if stock was already restored (type: 'Return' ledger entry exists for this order)
        const { data: existingReturnLedger } = await supabase
          .from("stock_ledger")
          .select("id")
          .eq("order_id", existingOrder.id)
          .eq("type", "Return")
          .limit(1);

        const wasRestored = existingReturnLedger && existingReturnLedger.length > 0;

        if (wasRestored) {
          console.log(`Stock was already restored for order ${existingOrder.id}. Skipping restoration to prevent double-restocking.`);
        } else {
          // Restore stock in local ERP database for each item in the cancelled order
          const lineItems = payload.line_items || [];
          for (const item of lineItems) {
            const shopifyVariantId = String(item.variant_id);
            const qty = parseInt(item.quantity) || 1;
            
            const { data: variant } = await supabase
              .from("product_variants")
              .select("sku, stock_sulur, average_cost, wholesale_price, product_id")
              .eq("shopify_id", shopifyVariantId)
              .maybeSingle();
              
            if (variant) {
              const currentStock = typeof variant.stock_sulur === 'number' ? variant.stock_sulur : 0;
              const newStock = currentStock + qty;
              
              await supabase
                .from("product_variants")
                .update({ stock_sulur: newStock })
                .eq("sku", variant.sku);
                
              const uCost = parseFloat(variant.average_cost) || parseFloat(variant.wholesale_price) || 0;
              const tCost = uCost * qty;
              
              await supabase.from("stock_ledger").insert([{
                order_id: existingOrder.id,
                date: new Date().toISOString(),
                product_id: variant.product_id,
                variant_sku: variant.sku,
                warehouse: "Sulur",
                type: "Return",
                quantity: qty,
                unit_cost: uCost,
                total_cost: tCost,
                balance_after: newStock
              }]);
              
              console.log(`Restored local ERP stock for SKU ${variant.sku} via Webhook cancellation: ${currentStock} -> ${newStock} (+${qty})`);
            }
          }
        }

        return new Response(JSON.stringify({ success: true, message: "Order cancelled and stock restored successfully." }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      console.log(`Order ${shopifyOrderId} already processed. Skipping.`);
      return new Response(JSON.stringify({ success: true, message: "Order already processed." }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 2. Extract customer & address details
    const shipping = payload.shipping_address || payload.billing_address || {};
    const customerObj = payload.customer || {};
    
    const rawFirstName = shipping.first_name || customerObj.first_name || "";
    const rawLastName  = shipping.last_name  || customerObj.last_name  || "";
    const customerName = (shipping.name || `${rawFirstName} ${rawLastName}`.trim() || customerObj.name || "").trim();
    const rawPhone = shipping.phone || customerObj.phone || payload.phone || "";
    const phone = normalizePhone(rawPhone);

    // Guard: reject placeholder / incomplete orders that have no real customer data
    const isPlaceholderName = !customerName || customerName.toLowerCase() === "shopify customer";
    const isPlaceholderPhone = !phone || phone === "00000000000" || phone.replace(/0/g, "").length === 0;

    if (isPlaceholderName || isPlaceholderPhone) {
      console.warn(`Rejected incomplete Shopify order ${shopifyOrderId}: name='${customerName}', phone='${phone}'`);
      return new Response(JSON.stringify({
        success: false,
        message: "Order rejected: missing real customer name or phone number. Customer has not completed checkout yet."
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    const email = payload.email || customerObj.email || null;
    const governorate = mapGovernorate(shipping.province);
    
    const detailAddress = [
      shipping.address1,
      shipping.address2,
      shipping.city,
      shipping.province,
      shipping.country
    ].filter(Boolean).join(", ") || "Shopify Address";

    // 3. Find or create customer
    let customerId = null;
    const { data: matchedCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (matchedCustomer) {
      customerId = matchedCustomer.id;
      // Update existing customer fields (email, address) if they are missing
      await supabase
        .from("customers")
        .update({
          email: email || undefined,
          address: detailAddress || undefined,
          governorate: governorate || undefined
        })
        .eq("id", customerId);
    } else {
      // Create new customer
      const newCustomerId = crypto.randomUUID();
      const { data: createdCustomer, error: cErr } = await supabase
        .from("customers")
        .insert([{
          id: newCustomerId,
          name: customerName,
          phone: phone,
          governorate: governorate,
          email: email,
          address: detailAddress,
          customer_type: "Regular",
          total_purchases: 0,
          orders_count: 0
        }])
        .select()
        .single();
      
      if (cErr) {
        console.error("Error creating customer:", cErr);
      }
      customerId = createdCustomer?.id || newCustomerId;
    }

    // 4. Extract shipping & billing details for the JSON address column
    const shippingLines = payload.shipping_lines || [];
    const shippingFee = shippingLines.length > 0 ? parseFloat(shippingLines[0].price) || 0 : 65;

    const discountCodes = payload.discount_codes || [];
    const couponCode = discountCodes.length > 0 ? discountCodes[0].code : null;
    const discountValue = parseFloat(payload.total_discounts) || 0;
    const discountType = discountValue > 0 ? "Fixed" : null;

    const addressJson = JSON.stringify({
      detailAddress: detailAddress,
      phone: phone,
      vatEnabled: false,
      orderDiscountPercent: 0,
      customerCode: `CUS-${phone.substring(7) || "SHPF"}`,
      appliedCoupon: couponCode
    });

    const isPaid = payload.financial_status === "paid";
    const totalValue = parseFloat(payload.total_price) || 0;
    const deposit = isPaid ? totalValue : 0;

    const gatewayNames = payload.payment_gateway_names || [];
    const paymentMethod = gatewayNames[0] || payload.gateway || "COD";

    // Generate unique ERP Order ID (e.g. ORD-2026-1234)
    const orderId = await generateUniqueOrderId(supabase);

    // 5. Insert order in Pending status
    const { error: oErr } = await supabase
      .from("orders")
      .insert([{
        id: orderId,
        client: customerName || "عميل شوبيفاي",
        customer_id: customerId,
        date: new Date().toISOString().split("T")[0],
        warehouse: "Sulur",
        status: "Pending", // Webhook creates orders as Pending approval
        total_value: totalValue,
        discount_type: discountType,
        discount_value: discountValue,
        applied_coupon_code: couponCode,
        address: addressJson,
        governorate: governorate,
        deposit: deposit,
        shipping_fee: shippingFee,
        shopify_order_id: shopifyOrderId,
        source: "shopify",
        payment_method: paymentMethod,
        created_by: "Shopify Webhook"
      }]);

    if (oErr) {
      throw oErr;
    }

    // 6. Enrich and insert line items
    const lineItems = payload.line_items || [];
    const orderItemsToInsert = [];
    const traceLogs: string[] = [];
    console.log(`shopify-webhook: processing ${lineItems.length} line items...`);

    for (const item of lineItems) {
      console.log(`shopify-webhook: resolving variant for item SKU = ${item.sku}, variant_id = ${item.variant_id}`);
      const itemTrace: string[] = [];
      const resolvedSku = await resolveLocalVariantSku(supabase, item, String(item.product_id), item.title || item.name || "Shopify Product", itemTrace);
      traceLogs.push(`SKU ${item.sku}: ` + itemTrace.join(" -> "));
      console.log(`shopify-webhook: resolved SKU = ${resolvedSku}`);
      if (resolvedSku === "DIGITAL-ITEM") {
        console.log(`Skipping digital line item: ${item.title}`);
        continue;
      }

      // Find variant average cost for inventory reports
      let costAtTimeOfSale = 0;
      const { data: variant, error: vErr } = await supabase
        .from("product_variants")
        .select("average_cost, wholesale_price")
        .eq("sku", resolvedSku)
        .maybeSingle();
      
      console.log(`shopify-webhook: query variant average_cost for ${resolvedSku} result:`, variant, vErr);
      if (variant) {
        costAtTimeOfSale = parseFloat(variant.average_cost) || parseFloat(variant.wholesale_price) || 0;
      }

      orderItemsToInsert.push({
        order_id: orderId,
        variant_sku: resolvedSku,
        quantity: parseInt(item.quantity) || 1,
        price: parseFloat(item.price) || 0,
        cost_at_time_of_sale: costAtTimeOfSale
      });
    }

    console.log(`shopify-webhook: orderItemsToInsert count = ${orderItemsToInsert.length}`);

    if (orderItemsToInsert.length > 0) {
      const { error: oiErr } = await supabase
        .from("order_items")
        .insert(orderItemsToInsert);
      
      if (oiErr) {
        console.error("Error inserting order items:", oiErr);
        traceLogs.push(`Insert order_items error: ${JSON.stringify(oiErr)}`);
      } else {
        traceLogs.push(`Successfully inserted ${orderItemsToInsert.length} order_items`);
      }
    }

    console.log(`Successfully processed Shopify order ${shopifyOrderId} as ERP Order ${orderId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Order processed successfully.", order_id: orderId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );

  } catch (error) {
    console.error("Error in shopify-webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
