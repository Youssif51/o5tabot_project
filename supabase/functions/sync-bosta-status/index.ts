import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map Bosta State Codes to Arabic friendly names
const bostaStateNames: Record<number, string> = {
  10: "طلب بيك أب جديد",
  11: "بانتظار خط السير",
  20: "تم تحديد المندوب",
  21: "تم الاستلام من التاجر",
  22: "جاري الاستلام من العميل",
  23: "تم الاستلام من المشتري",
  24: "وصلت شحنة المستودع",
  25: "مكتمل في بوسطة",
  30: "في الطريق بين المخازن",
  40: "جاري الاستلام",
  41: "خرج للتوصيل / المرتجع",
  45: "تم التسليم للعميل بنجاح",
  46: "تم الاسترجاع للتاجر (مرتجع)",
  47: "تعذر التوصيل (مشكلة/تأجيل)",
  48: "فشل التوصيل نهائياً",
  49: "ملغي في بوسطة",
  60: "تمت إعادته للمخزن",
  100: "مفقودة لدى الشحن",
  101: "تالفة لدى الشحن",
  102: "شحنة تحت التحقيق",
  103: "بانتظار إجراء من التاجر",
  104: "أرشيف",
  105: "قيد الانتظار"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate calling user
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

    // 2. Read tracking number from request
    const { trackingNumber, orderId } = await req.json();
    if (!trackingNumber || !orderId) {
      return new Response(JSON.stringify({ error: "Missing required parameters: trackingNumber or orderId." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 3. Get Bosta API Key
    const bostaApiKey = Deno.env.get('BOSTA_API_KEY');
    if (!bostaApiKey) {
      return new Response(JSON.stringify({ error: "Bosta API Key is not configured." }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 4. Fetch delivery status from Bosta API
    console.log(`Fetching delivery status for tracking number: ${trackingNumber}`);
    const bostaRes = await fetch(`https://api.bosta.co/api/v1/deliveries/${trackingNumber}`, {
      headers: { 'Authorization': bostaApiKey }
    });

    let bostaStateCode = 10;
    let stateName = "طلب بيك أب جديد";
    let exceptionReason = "";
    let isNotFoundError = false;

    if (!bostaRes.ok) {
      const errText = await bostaRes.text();
      console.error("Bosta tracking fetch failed:", errText);
      
      try {
        const parsedErr = JSON.parse(errText);
        if (bostaRes.status === 404 || (bostaRes.status === 400 && parsedErr.message?.toLowerCase().includes("not found"))) {
          isNotFoundError = true;
        }
      } catch(e) {
        if (bostaRes.status === 404) isNotFoundError = true;
      }

      if (!isNotFoundError) {
        return new Response(JSON.stringify({ error: `Failed to fetch from Bosta API: ${errText}` }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // If it is a not found error, treat it as Cancelled/Deleted
      bostaStateCode = 49;
      stateName = "ملغي في بوسطة (تم الحذف)";
      console.log(`Tracking number ${trackingNumber} not found/deleted in Bosta. Marking as cancelled.`);
    } else {
      const bostaData = await bostaRes.json();
      console.log("Bosta Tracking Response:", JSON.stringify(bostaData, null, 2));

      // 5. Extract state from response
      const delivery = bostaData.data || bostaData;
      let currentState = null;
      if (delivery.state && typeof delivery.state === 'object') {
        currentState = delivery.state.code !== undefined ? delivery.state.code : (delivery.state.value || null);
      } else {
        currentState = delivery.state || delivery.currentStatus?.state || null;
      }
      exceptionReason = delivery.state?.exceptionReason || "";

      if (currentState === null) {
        return new Response(JSON.stringify({ error: "Could not determine delivery state from Bosta response.", raw: bostaData }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      bostaStateCode = typeof currentState === 'number' ? currentState : parseInt(currentState);
      stateName = bostaStateNames[bostaStateCode] || `حالة رقم ${bostaStateCode}`;
    }

    // 6. Update order in DB
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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

    // Parse existing address
    let addressObj: Record<string, any> = {};
    if (order.address && order.address.startsWith('{')) {
      try { addressObj = JSON.parse(order.address); } catch(e) {}
    } else {
      addressObj = { detailAddress: order.address || "" };
    }

    addressObj.bostaStateCode = bostaStateCode;
    addressObj.bostaStateName = stateName;
    if (exceptionReason) addressObj.bostaExceptionReason = exceptionReason;

    // Decide if order status should change
    const previousStatus = order.status;
    let newStatus = previousStatus;

    if (isNotFoundError) {
      newStatus = 'Cancelled';
    } else if (bostaStateCode === 45) {
      newStatus = 'Completed';
    } else if ([46, 48, 49].includes(bostaStateCode)) {
      newStatus = 'Cancelled';
    }

    // Handle stock if status transition requires it
    const wasDeducted = ['Completed', 'Partially Delivered', 'Shipped'].includes(previousStatus);
    const isDeducted = ['Completed', 'Partially Delivered', 'Shipped'].includes(newStatus);
    const isCancelled = newStatus === 'Cancelled';
    const wasCancelled = previousStatus === 'Cancelled';

    if (isCancelled && !wasCancelled) {
      console.log(`Order ${orderId} cancelled. Reverting stock on Shopify...`);
      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (items) {
        for (const item of items) {
          const { data: vData } = await supabaseAdmin
            .from('product_variants')
            .select('stock_sulur, product_id, shopify_id')
            .eq('sku', item.variant_sku)
            .single();

          if (vData) {
            // 1. Shopify Restock (always, since Shopify deducts on order creation)
            if (vData.shopify_id) {
               await supabaseAdmin.functions.invoke('swift-processor', {
                   body: { action: 'adjust_stock', shopify_variant_id: vData.shopify_id, adjustment: item.quantity }
               });
            }

            // 2. Local Restock (only if it was previously deducted locally)
            if (wasDeducted) {
              const newStock = (vData.stock_sulur || 0) + (item.quantity || 0);
              await supabaseAdmin
                .from('product_variants')
                .update({ stock_sulur: newStock })
                .eq('sku', item.variant_sku);

              await supabaseAdmin
                .from('stock_ledger')
                .insert([{
                  date: new Date().toISOString().split('T')[0],
                  product_id: vData.product_id,
                  variant_sku: item.variant_sku,
                  warehouse: order.warehouse || 'Sulur',
                  type: 'Return',
                  quantity: item.quantity,
                  balance_after: newStock
                }]);
            }
          }
        }
      }
    }

    // Update DB
    const dbUpdate: Record<string, any> = {
      address: JSON.stringify(addressObj),
      status: newStatus
    };
    if (newStatus === 'Completed') {
      dbUpdate.deposit = order.total_value;
    }
    await supabaseAdmin
      .from('orders')
      .update(dbUpdate)
      .eq('id', orderId);

    // Update customer stats if needed
    if (previousStatus !== 'Completed' && newStatus === 'Completed' && order.customer_id) {
      const { data: customer } = await supabaseAdmin.from('customers').select('total_purchases, orders_count').eq('id', order.customer_id).single();
      if (customer) {
        await supabaseAdmin.from('customers').update({
          total_purchases: (parseFloat(customer.total_purchases) || 0) + (parseFloat(order.total_value) || 0),
          orders_count: (customer.orders_count || 0) + 1
        }).eq('id', order.customer_id);
      }
    } else if (previousStatus === 'Completed' && newStatus !== 'Completed' && order.customer_id) {
      const { data: customer } = await supabaseAdmin.from('customers').select('total_purchases, orders_count').eq('id', order.customer_id).single();
      if (customer) {
        await supabaseAdmin.from('customers').update({
          total_purchases: Math.max(0, (parseFloat(customer.total_purchases) || 0) - (parseFloat(order.total_value) || 0)),
          orders_count: Math.max(0, (customer.orders_count || 0) - 1)
        }).eq('id', order.customer_id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      newStateCode: bostaStateCode,
      newStateName: stateName,
      newStatus: newStatus,
      previousStatus: previousStatus,
      updatedAddress: JSON.stringify(addressObj)
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (err) {
    console.error("Unhandled error in sync-bosta-status:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
