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
    
    const customerName = shipping.name || `${shipping.first_name || ""} ${shipping.last_name || ""}`.trim() || customerObj.name || "Shopify Customer";
    const rawPhone = shipping.phone || customerObj.phone || payload.phone || "";
    const phone = normalizePhone(rawPhone) || "00000000000";
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
        client: customerName,
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
      // Find variant average cost for inventory reports
      let costAtTimeOfSale = 0;
      if (item.sku) {
        const { data: variant } = await supabase
          .from("product_variants")
          .select("average_cost, wholesale_price")
          .eq("sku", item.sku)
          .maybeSingle();
        
        if (variant) {
          costAtTimeOfSale = parseFloat(variant.average_cost) || parseFloat(variant.wholesale_price) || 0;
        }
      }

      orderItemsToInsert.push({
        order_id: orderId,
        variant_sku: item.sku || "UNKNOWN-SKU",
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
