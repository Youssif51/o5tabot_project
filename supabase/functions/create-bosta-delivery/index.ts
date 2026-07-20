import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize phone helper
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate calling user using Supabase auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabaseClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized access." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 2. Read Request Parameters
    const { orderId, bostaMetadata, depositAmount } = await req.json();
    if (!orderId || !bostaMetadata) {
      return new Response(JSON.stringify({ error: "Missing required parameters: orderId or bostaMetadata." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch order details
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: `Order ${orderId} not found.` }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Fetch order items
    const { data: orderItems, error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsErr || !orderItems || orderItems.length === 0) {
      return new Response(JSON.stringify({ error: "Order contains no line items to ship." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Get Bosta API Key from environment
    const bostaApiKey = Deno.env.get('BOSTA_API_KEY');
    if (!bostaApiKey) {
      return new Response(JSON.stringify({ error: "Bosta API Key is not set in Supabase environment secrets." }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 3. Fetch default pickup location from Bosta
    console.log("Fetching pickup locations from Bosta...");
    const pickupRes = await fetch('https://api.bosta.co/api/v2/pickup-locations', {
      headers: { 'Authorization': bostaApiKey }
    });
    
    if (!pickupRes.ok) {
      const errText = await pickupRes.text();
      console.error("Bosta pickup locations fetch failed:", errText);
      return new Response(JSON.stringify({ error: "Failed to fetch merchant pickup location from Bosta." }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const pickupData = await pickupRes.json();
    let pickupAddress = null;
    if (pickupData.success && pickupData.data && pickupData.data.list && pickupData.data.list.length > 0) {
      const defaultLoc = pickupData.data.list.find((l: any) => l.isDefault) || pickupData.data.list[0];
      if (defaultLoc && defaultLoc.address) {
        pickupAddress = {
          city: defaultLoc.address.city.name,
          zoneId: defaultLoc.address.zone?._id,
          districtId: defaultLoc.address.district?._id,
          firstLine: defaultLoc.address.firstLine,
          secondLine: defaultLoc.address.secondLine,
          buildingNumber: defaultLoc.address.buildingNumber,
          floor: defaultLoc.address.floor,
          apartment: defaultLoc.address.apartment,
          contactPerson: {
            name: "INV",
            phone: defaultLoc.contactPerson?.phone || "+201204819621"
          }
        };
      }
    }

    if (!pickupAddress) {
      return new Response(JSON.stringify({ error: "No active pickup locations found in your Bosta merchant account. Please add one in Bosta Dashboard first." }), {
        status: 412,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 4. Format Receiver Info
    const fullName = (order.client || "").trim();
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || "العميل";
    const lastName = nameParts.slice(1).join(" ") || ".";

    let phone = "";
    let secondPhone = "";
    let customerEmail = "";
    let detailAddress = "";
    if (order.address && order.address.startsWith('{')) {
      try {
        const parsed = JSON.parse(order.address);
        phone = parsed.phone || "";
        secondPhone = parsed.secondPhone || "";
        detailAddress = parsed.detailAddress || "";
      } catch (e) {}
    } else {
      detailAddress = order.address || "";
    }

    // Fallback phone from customer table if needed
    if (!phone && order.customer_id) {
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('phone, email')
        .eq('id', order.customer_id)
        .single();
      if (customer) {
        phone = customer.phone || "";
        customerEmail = customer.email || "";
      }
    }

    const normalizedPhone = normalizePhone(phone);
    const normalizedSecondPhone = normalizePhone(secondPhone);

    if (!normalizedPhone) {
      return new Response(JSON.stringify({ error: "Missing receiver phone number or invalid format." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 5. Fetch product names for all item SKUs
    const skus = orderItems.map(item => item.variant_sku);
    const { data: variantsData } = await supabaseAdmin
      .from('product_variants')
      .select('sku, name, product_id')
      .in('sku', skus);

    const productIds = (variantsData || []).map(v => v.product_id);
    const { data: productsData } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .in('id', productIds);

    const totalQty = orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const itemsDescription = orderItems.map(item => {
      const variant = (variantsData || []).find(v => v.sku === item.variant_sku);
      const product = variant ? (productsData || []).find(p => p.id === variant.product_id) : null;
      const prodName = product ? product.name : item.variant_sku;
      const optName = variant ? variant.name : '';
      const displayName = (optName && optName !== 'Standard Option' && optName !== 'Default Title')
        ? `${prodName} (${optName})`
        : prodName;
      return `${item.quantity}x ${displayName}`;
    }).join(", ");
    
    const orderTotal = parseFloat(order.total_value) || 0;
    const shippingFee = parseFloat(order.shipping_fee) || 0;
    const codAmount = Math.max(0, orderTotal - (parseFloat(depositAmount) || 0));
    
    // Goods Info Amount should be the net product total (without shipping)
    const netProductsTotal = Math.max(0, orderTotal - shippingFee);

    // Ensure address line 1 is at least 5 characters
    let firstLine = detailAddress.trim();
    if (firstLine.length < 5) {
      firstLine = `${firstLine} - المحافظة أو المنطقة`;
    }

    const productValueAmount = netProductsTotal < 1000 ? netProductsTotal + 100 : netProductsTotal;

    const bostaPayload = {
      type: 10, // Send / Deliver
      specs: {
        packageType: "Small",
        packageDetails: {
          itemsCount: totalQty,
          description: itemsDescription.substring(0, 120)
        }
      },
      goodsInfo: {
        amount: productValueAmount,
        notes: itemsDescription.substring(0, 120)
      },
      cod: codAmount,
      allowToOpenPackage: bostaMetadata.allowToOpenPackage !== undefined ? bostaMetadata.allowToOpenPackage : true,
      dropOffAddress: {
        city: bostaMetadata.bostaCityName, // Bosta English city name
        districtId: bostaMetadata.bostaDistrictId,
        zoneId: bostaMetadata.bostaZoneId,
        firstLine: firstLine,
        isWorkAddress: false
      },
      pickupAddress: pickupAddress,
      businessReference: order.id,
      receiver: {
        firstName: firstName,
        lastName: lastName,
        phone: normalizedPhone,
        ...(normalizedSecondPhone && { secondPhone: normalizedSecondPhone }),
        email: customerEmail || undefined
      }
    };

    console.log("Sending payload to Bosta API:", JSON.stringify(bostaPayload, null, 2));

    // 6. Send request to Bosta
    const bostaRes = await fetch('https://api.bosta.co/api/v2/deliveries?apiVersion=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': bostaApiKey
      },
      body: JSON.stringify(bostaPayload)
    });

    const bostaData = await bostaRes.json();
    console.log("Bosta Create Delivery Response:", JSON.stringify(bostaData, null, 2));

    if (!bostaRes.ok || !bostaData.success) {
      return new Response(JSON.stringify({ 
        error: bostaData.message || "Failed to create delivery in Bosta API.", 
        bostaRaw: bostaData 
      }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 7. Update orders address field with Bosta tracking info
    const updatedAddressObj = {
      detailAddress: firstLine,
      phone: normalizedPhone,
      bostaCityCode: bostaMetadata.bostaCityCode,
      bostaCityName: bostaMetadata.bostaCityName,
      bostaDistrictId: bostaMetadata.bostaDistrictId,
      bostaDistrictName: bostaMetadata.bostaDistrictName,
      bostaZoneId: bostaMetadata.bostaZoneId,
      bostaDeliveryId: bostaData.data._id,
      bostaTrackingNumber: bostaData.data.trackingNumber,
      bostaStateCode: 10,
      bostaStateName: "طلب بيك أب جديد"
    };

    // We only update the address in DB; the frontend will execute the status update to trigger WAC stock deduction, etc.
    const { error: dbErr } = await supabaseAdmin
      .from('orders')
      .update({
        address: JSON.stringify(updatedAddressObj),
        deposit: depositAmount
      })
      .eq('id', orderId);

    if (dbErr) {
      console.error("Failed to update order tracking details in DB:", dbErr);
    }

    return new Response(JSON.stringify({
      success: true,
      trackingNumber: bostaData.data.trackingNumber,
      deliveryId: bostaData.data._id,
      updatedAddress: JSON.stringify(updatedAddressObj)
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (err) {
    console.error("Unhandled error in create-bosta-delivery:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
