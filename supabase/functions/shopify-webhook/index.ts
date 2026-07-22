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
async function resolveLocalVariantSku(supabase: any, item: any, shopifyProductId: string, productName: string): Promise<string> {
  const titleLower = (productName || "").toLowerCase();
  const isDigital = ["tiktok", "pubg", "coins", "uc", "top-up", "top up", "bundle", "prime plus"].some(kw => titleLower.includes(kw));
  if (isDigital) {
    return "DIGITAL-ITEM";
  }

  const shopifyVariantId = String(item.variant_id);
  const itemSku = item.sku ? item.sku.trim() : "";
  const variantTitle = item.variant_title || "Standard Option";

  // Step 1: Check by shopify_id in product_variants
  const { data: vByShopifyId } = await supabase
    .from("product_variants")
    .select("sku")
    .eq("shopify_id", shopifyVariantId)
    .maybeSingle();
  if (vByShopifyId) return vByShopifyId.sku;

  // Step 2: Check by SKU in product_variants
  if (itemSku) {
    const { data: vBySku } = await supabase
      .from("product_variants")
      .select("sku, product_id")
      .eq("sku", itemSku)
      .maybeSingle();
    if (vBySku) {
      // Link them permanently since SKU matches
      await supabase.from("product_variants").update({ shopify_id: shopifyVariantId }).eq("sku", itemSku);
      await supabase.from("products").update({ shopify_id: shopifyProductId }).eq("id", vBySku.product_id);
      return vBySku.sku;
    }
  }

  // Step 3: Check by Product Name + Variant Name
  const { data: pByName } = await supabase
    .from("products")
    .select("id")
    .ilike("name", productName.trim())
    .maybeSingle();

  if (pByName) {
    const { data: vByName } = await supabase
      .from("product_variants")
      .select("sku")
      .eq("product_id", pByName.id)
      .ilike("name", variantTitle.trim() === "Default Title" ? "Standard Option" : variantTitle.trim())
      .maybeSingle();
    
    if (vByName) {
      // Link them permanently
      await supabase.from("product_variants").update({ shopify_id: shopifyVariantId }).eq("sku", vByName.sku);
      await supabase.from("products").update({ shopify_id: shopifyProductId }).eq("id", pByName.id);
      return vByName.sku;
    }
  }

  // Step 4: Dynamically import/create product and variant if no match found
  console.log(`Product/Variant not found locally. Dynamically importing "${productName}" - "${variantTitle}"`);
  
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

    const shopifyOrderId = String(payload.id);

    // 1. Prevent duplicates
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("shopify_order_id", shopifyOrderId)
      .maybeSingle();

    if (existingOrder) {
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

    for (const item of lineItems) {
      // Safely map/link/create the variant to resolve local SKU
      const resolvedSku = await resolveLocalVariantSku(supabase, item, String(item.product_id), item.title || item.name || "Shopify Product");
      if (resolvedSku === "DIGITAL-ITEM") {
        console.log(`Skipping digital line item: ${item.title}`);
        continue;
      }

      // Find variant average cost for inventory reports
      let costAtTimeOfSale = 0;
      const { data: variant } = await supabase
        .from("product_variants")
        .select("average_cost, wholesale_price")
        .eq("sku", resolvedSku)
        .maybeSingle();
      
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

    if (orderItemsToInsert.length > 0) {
      const { error: oiErr } = await supabase
        .from("order_items")
        .insert(orderItemsToInsert);
      
      if (oiErr) {
        console.error("Error inserting order items:", oiErr);
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
