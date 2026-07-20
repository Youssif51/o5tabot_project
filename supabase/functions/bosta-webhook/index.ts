import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map Bosta State Codes to English/Arabic friendly names
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
    // Optional Webhook Security Check (Headers or Query Parameter)
    const url = new URL(req.url);
    const webhookKey = req.headers.get("X-Bosta-Webhook-Key") || req.headers.get("x-bosta-webhook-key") || url.searchParams.get("secret");
    const localSecret = Deno.env.get("BOSTA_WEBHOOK_SECRET");
    
    if (localSecret && webhookKey && webhookKey !== localSecret) {
      console.warn("Bosta Webhook secret verification failed (mismatch).");
      return new Response(JSON.stringify({ error: "Invalid webhook secret authorization." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    if (localSecret && !webhookKey) {
      console.warn("Bosta Webhook secret not provided in headers or query parameters. Allowing request for compatibility.");
    }

    const payload = await req.json();
    console.log("Received Bosta Webhook Payload:", JSON.stringify(payload, null, 2));

    const trackingNumber = payload.trackingNumber;
    const bostaStateCode = parseInt(payload.state);
    const orderId = payload.businessReference; // This is our internal ORD-ID
    const exceptionReason = payload.exceptionReason || "";

    if (!orderId) {
      return new Response(JSON.stringify({ error: "Missing businessReference (orderId)." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Initialize Supabase admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Fetch current order from DB
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      console.error(`Order ${orderId} not found in database.`);
      return new Response(JSON.stringify({ error: `Order ${orderId} not found.` }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Parse address JSON and merge state changes
    let addressObj: Record<string, any> = {};
    if (order.address && order.address.startsWith('{')) {
      try {
        addressObj = JSON.parse(order.address);
      } catch (e) {}
    } else {
      addressObj = { detailAddress: order.address || "" };
    }

    const stateName = bostaStateNames[bostaStateCode] || `حالة رقم ${bostaStateCode}`;
    addressObj.bostaStateCode = bostaStateCode;
    addressObj.bostaStateName = stateName;
    if (trackingNumber) addressObj.bostaTrackingNumber = String(trackingNumber);
    if (exceptionReason) addressObj.bostaExceptionReason = exceptionReason;

    const previousStatus = order.status;
    let newStatus = previousStatus;

    // 2. Decide if order status should change based on Bosta state code
    if (bostaStateCode === 45) {
      // Delivered
      newStatus = 'Completed';
    } else if ([46, 48, 49, 50].includes(bostaStateCode)) {
      // Returned/Failed/Cancelled/Terminated
      newStatus = 'Cancelled';
    }

    // 3. Handle stock restoration / deduction based on state changes
    const wasDeducted = previousStatus === 'Completed' || previousStatus === 'Partially Delivered' || previousStatus === 'Shipped';
    const isDeducted = newStatus === 'Completed' || newStatus === 'Partially Delivered' || newStatus === 'Shipped';
    const isCancelled = newStatus === 'Cancelled';

    const wasCancelled = previousStatus === 'Cancelled';

    if (isCancelled && !wasCancelled) {
      console.log(`Order ${orderId} returned/cancelled. Reverting stock levels...`);
      
      // Fetch order items to restock
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (items) {
        for (const item of items) {
          const { data: vData } = await supabase
            .from('product_variants')
            .select('stock_sulur, product_id, shopify_id')
            .eq('sku', item.variant_sku)
            .single();

          if (vData) {
            // 1. Shopify Restock
            if (vData.shopify_id) {
                 await supabase.functions.invoke('swift-processor', {
                    body: { action: 'adjust_stock', shopify_variant_id: vData.shopify_id, adjustment: item.quantity }
                 });
            }

            // 2. Local Restock
            if (wasDeducted) {
              const newStock = (vData.stock_sulur || 0) + (item.quantity || 0);
              
              // Revert stock
              await supabase
                .from('product_variants')
                .update({ stock_sulur: newStock })
                .eq('sku', item.variant_sku);

              // Log inside Stock Ledger
              await supabase
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
    } else if (!wasDeducted && isDeducted) {
      console.log(`Order ${orderId} marked as Completed/Shipped. Deducting stock levels...`);
      
      // Fetch order items to deduct
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (items) {
        for (const item of items) {
          const { data: vData } = await supabase
            .from('product_variants')
            .select('stock_sulur, product_id')
            .eq('sku', item.variant_sku)
            .single();

          if (vData) {
            const newStock = Math.max(0, (vData.stock_sulur || 0) - (item.quantity || 0));
            
            // Deduct stock
            await supabase
              .from('product_variants')
              .update({ stock_sulur: newStock })
              .eq('sku', item.variant_sku);

            // Log inside Stock Ledger
            await supabase
              .from('stock_ledger')
              .insert([{
                date: new Date().toISOString().split('T')[0],
                product_id: vData.product_id,
                variant_sku: item.variant_sku,
                warehouse: order.warehouse || 'Sulur',
                type: 'Sale',
                quantity: -item.quantity,
                balance_after: newStock
              }]);
          }
        }
      }
    }

    // 4. Update the order in Supabase
    const dbUpdate: Record<string, any> = {
      address: JSON.stringify(addressObj),
      status: newStatus
    };
    await supabase
      .from('orders')
      .update(dbUpdate)
      .eq('id', orderId);

    // 5. Update customer stats if transitioning to/from Completed
    if (previousStatus !== 'Completed' && newStatus === 'Completed' && order.customer_id) {
      // Add purchases
      const { data: customer } = await supabase.from('customers').select('total_purchases, orders_count').eq('id', order.customer_id).single();
      if (customer) {
        await supabase.from('customers').update({
          total_purchases: (parseFloat(customer.total_purchases) || 0) + (parseFloat(order.total_value) || 0),
          orders_count: (customer.orders_count || 0) + 1
        }).eq('id', order.customer_id);
      }
    } else if (previousStatus === 'Completed' && newStatus !== 'Completed' && order.customer_id) {
      // Subtract purchases
      const { data: customer } = await supabase.from('customers').select('total_purchases, orders_count').eq('id', order.customer_id).single();
      if (customer) {
        await supabase.from('customers').update({
          total_purchases: Math.max(0, (parseFloat(customer.total_purchases) || 0) - (parseFloat(order.total_value) || 0)),
          orders_count: Math.max(0, (customer.orders_count || 0) - 1)
        }).eq('id', order.customer_id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Order status synced. Current status: ${newStatus}, Bosta code: ${bostaStateCode}` 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (err) {
    console.error("Unhandled error in bosta-webhook:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
