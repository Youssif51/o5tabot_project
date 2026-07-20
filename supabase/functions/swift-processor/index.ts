// Deno.serve is a built-in API in modern Deno, no need to import from std library.
// @ts-ignore - Supress VS Code errors since Deno is available globally in Supabase
declare const Deno: any;

const envStoreName = Deno.env.get("SHOPIFY_STORE_NAME") || "c04z0k-00";
const STORE_NAME = envStoreName.replace(/\.myshopify\.com/i, "").trim();
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

    // 2. استخراج المتغيرات من الطلب وتجهيز المتغيرات
    const body = await req.json();
    const { action, shopify_id, name, variants, images, vendor, tags, category, description, status, collection_ids } = body;

    if (action === 'fetch_all_products') {
      try {
        let allProducts = [];
        let url = `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products.json?limit=250`;
        
        while (url) {
          const res = await fetch(url, {
            method: "GET",
            headers: { "X-Shopify-Access-Token": accessToken }
          });
          
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Failed to fetch products from Shopify: ${errText}`);
          }
          
          const data = await res.json();
          if (data.products) {
            allProducts = allProducts.concat(data.products);
          }
          
          // Check for pagination link
          const linkHeader = res.headers.get('link');
          let nextUrl = null;
          if (linkHeader) {
            const links = linkHeader.split(',').map(part => part.trim());
            const nextLink = links.find(link => link.includes('rel="next"'));
            if (nextLink) {
              const match = nextLink.match(/<([^>]+)>/);
              if (match) {
                nextUrl = match[1];
              }
            }
          }
          url = nextUrl;
        }

        return new Response(JSON.stringify({ success: true, products: allProducts }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: "Failed to fetch products from Shopify", details: err.message }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // معالجة جلب المجموعات (Fetch Collections)
      // جلب الكوليكشنز (Fetch Collections)
      if (action === 'fetch_collects') {
        try {
          let allCollects = [];
          let url = `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/collects.json?limit=250`;
          
          while (url) {
            const res = await fetch(url, {
              method: "GET",
              headers: { "X-Shopify-Access-Token": accessToken }
            });
            if (!res.ok) throw new Error("Failed to fetch collects");
            
            const data = await res.json();
            if (data.collects) allCollects = allCollects.concat(data.collects);
            
            const linkHeader = res.headers.get("link");
            let nextUrl = null;
            if (linkHeader) {
              const links = linkHeader.split(",").map(part => part.trim());
              const nextLink = links.find(link => link.includes('rel="next"'));
              if (nextLink) {
                const match = nextLink.match(/<([^>]+)>/);
                if (match) nextUrl = match[1];
              }
            }
            url = nextUrl;
          }
          return new Response(JSON.stringify({ success: true, collects: allCollects }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: "Failed to fetch collects", details: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
      }

      // --- NEW ACTION: create_discount ---
      if (action === 'create_discount') {
        const { code, value, type, endDate, usageLimit, minOrderValue, oncePerCustomer } = body;
        if (!code || !value || !type) {
            return new Response(JSON.stringify({ error: "Missing required fields for discount creation" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        try {
            // 1. Create Price Rule
            const priceRulePayload = {
                title: code,
                target_type: "line_item",
                target_selection: "all",
                allocation_method: "across",
                value_type: type, // "percentage" or "fixed_amount"
                value: `-${value}`, // Must be negative
                customer_selection: "all",
                starts_at: new Date().toISOString()
            };

            // Add optional constraints if provided
            if (endDate) {
                priceRulePayload.ends_at = new Date(endDate).toISOString();
            }
            if (usageLimit && parseInt(usageLimit) > 0) {
                priceRulePayload.usage_limit = parseInt(usageLimit);
            }
            if (minOrderValue && parseFloat(minOrderValue) > 0) {
                priceRulePayload.prerequisite_subtotal_range = {
                    greater_than_or_equal_to: parseFloat(minOrderValue).toString()
                };
            }
            if (oncePerCustomer) {
                priceRulePayload.once_per_customer = true;
            }

            const priceRuleRes = await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/price_rules.json`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": accessToken
                },
                body: JSON.stringify({
                    price_rule: priceRulePayload
                })
            });

            if (!priceRuleRes.ok) {
                const errData = await priceRuleRes.json().catch(() => null) || await priceRuleRes.text();
                throw new Error(`Failed to create Price Rule: ${JSON.stringify(errData)}`);
            }

            const priceRuleData = await priceRuleRes.json();
            const priceRuleId = priceRuleData.price_rule.id;

            // 2. Create Discount Code
            const discountRes = await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/price_rules/${priceRuleId}/discount_codes.json`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": accessToken
                },
                body: JSON.stringify({
                    discount_code: {
                        code: code
                    }
                })
            });

            if (!discountRes.ok) {
                const errData = await discountRes.json().catch(() => null) || await discountRes.text();
                throw new Error(`Failed to create Discount Code: ${JSON.stringify(errData)}`);
            }

            return new Response(JSON.stringify({ success: true, message: "Discount code created successfully on Shopify" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        } catch (err: any) {
            return new Response(JSON.stringify({ error: "Failed to create discount on Shopify", details: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
      }

      if (action === 'fetch_collections') {
      try {
        const customRes = await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/custom_collections.json`, {
          method: "GET",
          headers: { "X-Shopify-Access-Token": accessToken }
        });
        const smartRes = await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/smart_collections.json`, {
          method: "GET",
          headers: { "X-Shopify-Access-Token": accessToken }
        });

        const customData = customRes.ok ? await customRes.json() : { custom_collections: [] };
        const smartData = smartRes.ok ? await smartRes.json() : { smart_collections: [] };

        const collections = [
          ...(customData.custom_collections || []).map((c: any) => ({ id: String(c.id), title: c.title, handle: c.handle, type: 'custom' })),
          ...(smartData.smart_collections || []).map((c: any) => ({ id: String(c.id), title: c.title, handle: c.handle, type: 'smart' }))
        ];

        return new Response(JSON.stringify({ success: true, collections }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: "فشل جلب المجموعات من شوبيفاي", details: err.message }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // معالجة تحديث المخزون فقط (Update Stock Only)
    if (action === 'update_stock') {
      const { shopify_variant_id, stock } = body;
      if (!shopify_variant_id) {
        return new Response(JSON.stringify({ error: "Missing shopify_variant_id" }), {
          status: 400,
          headers: corsHeaders
        });
      }
      try {
        const variantRes = await fetch(
          `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/variants/${shopify_variant_id}.json`,
          {
            method: "GET",
            headers: { "X-Shopify-Access-Token": accessToken }
          }
        );
        if (!variantRes.ok) {
          const err = await variantRes.json();
          return new Response(JSON.stringify({ error: "Failed to fetch variant details from Shopify", details: err }), {
            status: 400,
            headers: corsHeaders
          });
        }
        const variantData = await variantRes.json();
        const inventoryItemId = variantData?.variant?.inventory_item_id;

        if (!inventoryItemId) {
          return new Response(JSON.stringify({ error: "No inventory_item_id found for variant" }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const locationRes = await fetch(
          `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/locations.json`,
          {
            method: "GET",
            headers: { "X-Shopify-Access-Token": accessToken }
          }
        );
        const locationData = await locationRes.json();
        const primaryLocationId = locationData?.locations?.[0]?.id;

        if (!primaryLocationId) {
          return new Response(JSON.stringify({ error: "No primary location found on Shopify" }), {
            status: 400,
            headers: corsHeaders
          });
        }

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
              inventory_item_id: inventoryItemId,
              available: parseInt(stock)
            })
          }
        );
        const invData = await inventoryRes.json();
        if (!inventoryRes.ok) {
          return new Response(JSON.stringify({ error: "Failed to set inventory level on Shopify", details: invData }), {
            status: 400,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Stock updated successfully on Shopify" }), {
          status: 200,
          headers: corsHeaders
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: "Error updating stock on Shopify", details: err.message }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
 
    // معالجة تعديل المخزون نسبياً (Adjust Stock relatively)
    if (action === 'adjust_stock') {
      const { shopify_variant_id, adjustment } = body;
      if (!shopify_variant_id) {
        return new Response(JSON.stringify({ error: "Missing shopify_variant_id" }), {
          status: 400,
          headers: corsHeaders
        });
      }
      try {
        const variantRes = await fetch(
          `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/variants/${shopify_variant_id}.json`,
          {
            method: "GET",
            headers: { "X-Shopify-Access-Token": accessToken }
          }
        );
        if (!variantRes.ok) {
          const err = await variantRes.json();
          return new Response(JSON.stringify({ error: "Failed to fetch variant details from Shopify", details: err }), {
            status: 400,
            headers: corsHeaders
          });
        }
        const variantData = await variantRes.json();
        const inventoryItemId = variantData?.variant?.inventory_item_id;
 
        if (!inventoryItemId) {
          return new Response(JSON.stringify({ error: "No inventory_item_id found for variant" }), {
            status: 400,
            headers: corsHeaders
          });
        }
 
        const locationRes = await fetch(
          `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/locations.json`,
          {
            method: "GET",
            headers: { "X-Shopify-Access-Token": accessToken }
          }
        );
        const locationData = await locationRes.json();
        const primaryLocationId = locationData?.locations?.[0]?.id;
 
        if (!primaryLocationId) {
          return new Response(JSON.stringify({ error: "No primary location found on Shopify" }), {
            status: 400,
            headers: corsHeaders
          });
        }
 
        const inventoryRes = await fetch(
          `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/inventory_levels/adjust.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken
            },
            body: JSON.stringify({
              location_id: primaryLocationId,
              inventory_item_id: inventoryItemId,
              available_adjustment: parseInt(adjustment)
            })
          }
        );
        const invData = await inventoryRes.json();
        if (!inventoryRes.ok) {
          return new Response(JSON.stringify({ error: "Failed to adjust inventory level on Shopify", details: invData }), {
            status: 400,
            headers: corsHeaders
          });
        }
 
        return new Response(JSON.stringify({ success: true, message: "Stock adjusted successfully on Shopify" }), {
          status: 200,
          headers: corsHeaders
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: "Error adjusting stock on Shopify", details: err.message }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }

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
      price: v.price || v.retailPrice || v.wholesalePrice || 0,
      sku: v.sku || "",
      option1: (variants.length === 1) ? "Default Title" : (v.name || "Default Title"),
      inventory_management: "shopify"
    }));

    // تجهيز خيارات البدائل (Options) إذا كان هناك أكثر من بديل أو بديل مخصص
    const shopifyOptions = (shopifyVariants.length > 1 || (shopifyVariants[0] && shopifyVariants[0].option1 !== "Default Title"))
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
        published: status === "active",
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
            const stockValue = (typeof frontVariant.stock === 'object' ? (frontVariant.stock?.Sulur ?? 0) : (frontVariant.stock ?? 0)) || frontVariant.stockSulur || 0;
            
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

    // ==========================================
    // 5.3 ربط المنتج بالمجموعات (Collection Sync)
    // ==========================================
    const shopify_product_id = shopifyData?.product?.id;
    if (shopify_product_id && (action === 'update' || (collection_ids && collection_ids.length > 0))) {
      try {
        // جلب الروابط الحالية للمنتج وحذفها لتجنب التكرار
        const checkCollectsRes = await fetch(
          `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/collects.json?product_id=${shopify_product_id}`,
          {
            method: "GET",
            headers: { "X-Shopify-Access-Token": accessToken }
          }
        );
        
        if (checkCollectsRes.ok) {
          const collectsData = await checkCollectsRes.json();
          const collects = collectsData.collects || [];
          for (const col of collects) {
            await fetch(
              `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/collects/${col.id}.json`,
              {
                method: "DELETE",
                headers: { "X-Shopify-Access-Token": accessToken }
              }
            );
          }
        }

        // إضافة إلى كل المجموعات المحددة
        if (collection_ids && collection_ids.length > 0) {
          for (const c_id of collection_ids) {
            const createCollectRes = await fetch(
              `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/collects.json`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Shopify-Access-Token": accessToken
                },
                body: JSON.stringify({
                  collect: {
                    product_id: shopify_product_id,
                    collection_id: parseInt(c_id)
                  }
                })
              }
            );
            if (!createCollectRes.ok) {
              const errData = await createCollectRes.json();
              inventoryWarnings.push(`Failed to link product to collection ${c_id}: ${JSON.stringify(errData)}`);
            }
          }
        }
      } catch (colErr: any) {
        console.error("خطأ أثناء ربط المجموعات:", colErr);
        inventoryWarnings.push("حدث خطأ أثناء ربط المنتج بالمجموعات: " + colErr.message);
      }
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
