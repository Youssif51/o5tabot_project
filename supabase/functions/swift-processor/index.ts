// Deno.serve is a built-in API in modern Deno, no need to import from std library.
// @ts-ignore - Supress VS Code errors since Deno is available globally in Supabase
declare const Deno: any;

const STORE_NAME = "c04z0k-00"; // استبدله بالاسم الفرعي للمتجر (بدون مسافات)
const API_VERSION = "2024-01"; // تم تحديث نسخة الـ API لنسخة صحيحة ومستقرة

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Caching variables (in-memory)
let cachedToken = null;
let tokenExpiryTime = 0; // Epoch timestamp in seconds

// Function to get or renew the access token
async function getAccessToken() {
  const currentTime = Math.floor(Date.now() / 1000);
  
  // Use cached token if valid and doesn't expire in the next 120 seconds
  if (cachedToken && tokenExpiryTime > currentTime + 120) {
    return cachedToken;
  }

  // Retrieve secrets from environment variables
  const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET");
  
  if (!clientId || !clientSecret) {
    throw new Error("Missing Shopify credentials (SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET) in environment variables.");
  }

  const response = await fetch(`https://${STORE_NAME}.myshopify.com/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials"
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => null) || await response.text();
    throw new Error(`Authentication failed with Shopify: ${JSON.stringify(errData)}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error(`Authentication succeeded but no access_token returned. Response: ${JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  // data.expires_in is usually returned in seconds
  tokenExpiryTime = currentTime + (data.expires_in || 86399);

  return cachedToken;
}

// @ts-ignore - Deno is available in Supabase Edge Functions runtime but may not be recognized by local TypeScript configurations.
Deno.serve(async (req) => {
  // التعامل مع طلبات الـ CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Get a valid Access Token (cached or renewed)
    let accessToken;
    try {
      accessToken = await getAccessToken();
    } catch (authError) {
      // إرجاع خطأ صريح في حالة فشل الـ Authentication
      return new Response(JSON.stringify({ error: "Shopify Authentication Error", details: authError.message }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 2. استقبال البيانات القادمة من الفرونت اند
    const body = await req.json();
    const { action, shopify_id, name, variants, images, vendor, tags, category, description, status } = body;

    // معالجة الحذف (Delete)
    if (action === 'delete' && shopify_id) {
      const deleteRes = await fetch(
        `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products/${shopify_id}.json`,
        {
          method: "DELETE",
          headers: { "X-Shopify-Access-Token": accessToken }
        }
      );
      if (!deleteRes.ok) {
        const err = await deleteRes.json();
        return new Response(JSON.stringify({ error: "فشل حذف المنتج من شوبيفاي", details: err }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      return new Response(JSON.stringify({ success: true, message: "تم حذف المنتج بنجاح من شوبيفاي" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // تجهيز البدائل (Variants)
    const shopifyVariants = (variants || []).map(v => ({
      id: v.shopify_id ? parseInt(v.shopify_id) : undefined,
      price: v.retailPrice || v.wholesalePrice || 0,
      sku: v.sku || "",
      option1: v.name || "Default Title",
      inventory_management: "shopify"
    }));

    // تجهيز خيارات البدائل (Options) إذا كان هناك أكثر من بديل أو بديل مخصص
    const shopifyOptions = (shopifyVariants.length > 1 || (shopifyVariants[0] && shopifyVariants[0].option1 !== "Default Title" && shopifyVariants[0].option1 !== "Standard Option"))
      ? [{ name: "Options", values: shopifyVariants.map(v => v.option1) }]
      : [];

    // تجهيز الصور (Images) - إزالة prefix (data:image/jpeg;base64,) إذا كان موجوداً
    // تجهيز الصور (Images) - إزالة prefix (data:image/jpeg;base64,) إذا كان موجوداً وإعطاء اسم
    const shopifyImages = (images || []).map((img, idx) => {
      const matches = img.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const base64Data = matches ? matches[2] : (img.includes("base64,") ? img.split("base64,")[1] : img);
      return { 
        attachment: base64Data,
        filename: `product-image-${idx + 1}.jpg`
      };
    });

    // 3. تجهيز الـ Payload بالطريقة التي تفهمها شوبيفاي
    const shopifyPayload = {
      product: {
        title: name,
        body_html: description || "منتج مضاف من نظام إدارة المخزون",
        vendor: vendor || "Octabot",
        product_type: category || "",
        tags: tags || "",
        status: status || "draft",
        variants: shopifyVariants,
        ...(shopifyOptions.length > 0 && { options: shopifyOptions }),
        ...(shopifyImages.length > 0 && { images: shopifyImages })
      }
    };

    // 4. إرسال الطلب إلى Shopify Admin API بناءً على الإجراء
    const apiUrl = (action === 'update' && shopify_id) 
      ? `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products/${shopify_id}.json`
      : `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products.json`;
      
    const apiMethod = (action === 'update' && shopify_id) ? "PUT" : "POST";

    const shopifyResponse = await fetch(apiUrl, {
        method: apiMethod,
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken
        },
        body: JSON.stringify(shopifyPayload)
      }
    );

    const shopifyData = await shopifyResponse.json();

    // إذا فشل الطلب في شوبيفاي، نرجع الخطأ
    if (!shopifyResponse.ok) {
      return new Response(JSON.stringify({ error: "فشل إنشاء المنتج في شوبيفاي", details: shopifyData }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // ==========================================
    // 5. ضبط المخزون (Stock Inventory Sync)
    // ==========================================
    let inventoryWarnings = [];
    try {
      // 5.1 جلب الـ Location ID الأساسي
      const locationRes = await fetch(
        `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/locations.json`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken
          }
        }
      );
      
      const locationData = await locationRes.json();
      if (!locationRes.ok) {
         inventoryWarnings.push(`Location API Error: ${JSON.stringify(locationData)}`);
      }
      
      const primaryLocationId = locationData?.locations?.[0]?.id;

      if (primaryLocationId) {
        // 5.2 تحديث المخزون لكل بديل (Variant)
        const createdVariants = shopifyData.product.variants; // البدائل التي أنشأتها شوبيفاي ومعها inventory_item_id
        
        for (let i = 0; i < createdVariants.length; i++) {
          const shopifyVariant = createdVariants[i];
          const frontVariant = (variants || [])[i]; // ربط كل بديل بما يقابله في الفرونت اند
          
          if (frontVariant && shopifyVariant.inventory_item_id) {
            const stockValue = frontVariant.stockSulur || frontVariant.stock?.Sulur || 0;
            
            const inventoryRes = await fetch(
              `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/inventory_levels/set.json`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Shopify-Access-Token": accessToken
                },
                body: JSON.stringify({
                  location_id: primaryLocationId,
                  inventory_item_id: shopifyVariant.inventory_item_id,
                  available: parseInt(stockValue)
                })
              }
            );
            const invData = await inventoryRes.json();
            if (!inventoryRes.ok) {
              inventoryWarnings.push(`Inventory API Error for variant ${i}: ${JSON.stringify(invData)}`);
            }
          }
        }
      } else {
        inventoryWarnings.push("لم يتم العثور على موقع (Location) في شوبيفاي لضبط المخزون.");
      }
    } catch (stockError) {
      console.error("خطأ أثناء مزامنة المخزون:", stockError);
      inventoryWarnings.push("حدث خطأ أثناء مزامنة المخزون: " + stockError.message);
    }

    // 6. الرد بالنجاح وإرجاع البيانات
      return new Response(
        JSON.stringify({
          success: true,
          message: "تم تنفيذ العملية بنجاح في شوبيفاي",
          shopify_product_id: shopifyData.product.id,
          variants_map: shopifyData.product.variants.map(v => ({ sku: v.sku, id: v.id })),
          warnings: inventoryWarnings
        }),
        {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
})