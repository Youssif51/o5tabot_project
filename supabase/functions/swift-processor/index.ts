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

function convertPlaintextToHtml(text: string): string {
  if (!text) return "";
  
  // If it's already HTML, don't convert it!
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }
  
  // Normalize line endings
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  // Split into lines
  const lines = normalized.split("\n");
  
  let html = "";
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // If the line is empty
    if (!line) {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      continue;
    }
    
    // Check if it is a list item (starts with - or * or bullet character)
    const isBullet = line.startsWith("-") || line.startsWith("*") || line.startsWith("•");
    
    if (isBullet) {
      if (!inList) {
        html += "<ul>\n";
        inList = true;
      }
      // Strip bullet character
      const content = line.replace(/^[\-\*•]\s*/, "");
      html += `  <li>${content}</li>\n`;
    } else {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      
      // Check if it is a header (like "Key Features" or "Specifications")
      const isHeader = line.toLowerCase().endsWith("features") || 
                       line.toLowerCase().endsWith("specifications") ||
                       line.startsWith("Key ") ||
                       line.length < 30 && (line.endsWith(":") || !line.endsWith("."));
      
      if (isHeader) {
        const cleanHeader = line.replace(/:$/, "");
        html += `<p><strong>${cleanHeader}</strong></p>\n`;
      } else {
        html += `<p>${line}</p>\n`;
      }
    }
  }
  
  if (inList) {
    html += "</ul>\n";
  }
  
  return html;
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const cleanUrl = url ? url.split('?')[0] : url;
    const res = await fetch(cleanUrl);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error("Failed to fetch image as base64:", url, e);
    return null;
  }
}

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

            let priceRuleId;
            if (!priceRuleRes.ok) {
                const errData = await priceRuleRes.json().catch(() => null) || await priceRuleRes.text();
                const errStr = JSON.stringify(errData);
                if (errStr.includes("must be unique") || errStr.includes("taken") || priceRuleRes.status === 422) {
                    // Find the existing price rule by title
                    const rulesRes = await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/price_rules.json?limit=250`, {
                        method: "GET",
                        headers: { "X-Shopify-Access-Token": accessToken }
                    });
                    if (rulesRes.ok) {
                        const rulesData = await rulesRes.json();
                        const existingRule = (rulesData.price_rules || []).find((r: any) => r.title.toUpperCase() === code.toUpperCase());
                        if (existingRule) {
                            priceRuleId = existingRule.id;
                        }
                    }
                }
                
                if (!priceRuleId) {
                    throw new Error(`Failed to create Price Rule: ${JSON.stringify(errData)}`);
                }
            } else {
                const priceRuleData = await priceRuleRes.json();
                priceRuleId = priceRuleData.price_rule.id;
            }

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
                const errStr = JSON.stringify(errData);
                if (errStr.includes("taken") || errStr.includes("must be unique")) {
                    return new Response(JSON.stringify({ success: true, message: "Discount code already exists and is active on Shopify" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
                }
                throw new Error(`Failed to create Discount Code: ${JSON.stringify(errData)}`);
            }

            return new Response(JSON.stringify({ success: true, message: "Discount code created successfully on Shopify" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        } catch (err: any) {
            return new Response(JSON.stringify({ error: "Failed to create discount on Shopify", details: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
      }

      // --- NEW ACTION: check_discount_usage ---
      if (action === 'check_discount_usage') {
        const { code } = body;
        if (!code) {
            return new Response(JSON.stringify({ error: "Missing required discount code" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        try {
            // 1. Fetch all price rules from Shopify to find the one with title === code
            const rulesRes = await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/price_rules.json?limit=250`, {
                method: "GET",
                headers: { "X-Shopify-Access-Token": accessToken }
            });

            if (!rulesRes.ok) {
                const errData = await rulesRes.json().catch(() => null) || await rulesRes.text();
                throw new Error(`Failed to fetch price rules: ${JSON.stringify(errData)}`);
            }

            const rulesData = await rulesRes.json();
            const matchingRule = (rulesData.price_rules || []).find((r: any) => r.title.toUpperCase() === code.toUpperCase());

            if (!matchingRule) {
                return new Response(JSON.stringify({ success: true, times_used: 0, exists: false }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
            }

            return new Response(JSON.stringify({ 
                success: true, 
                times_used: matchingRule.times_used || 0, 
                usage_limit: matchingRule.usage_limit || null,
                exists: true 
            }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        } catch (err: any) {
            return new Response(JSON.stringify({ error: "Failed to check discount usage on Shopify", details: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
      }

      // --- NEW ACTION: delete_discount ---
      if (action === 'delete_discount') {
        const { code } = body;
        if (!code) {
            return new Response(JSON.stringify({ error: "Missing required discount code" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        try {
            // 1. Fetch all price rules from Shopify to find the one with title === code
            const rulesRes = await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/price_rules.json?limit=250`, {
                method: "GET",
                headers: { "X-Shopify-Access-Token": accessToken }
            });

            if (!rulesRes.ok) {
                const errData = await rulesRes.json().catch(() => null) || await rulesRes.text();
                throw new Error(`Failed to fetch price rules: ${JSON.stringify(errData)}`);
            }

            const rulesData = await rulesRes.json();
            const matchingRule = (rulesData.price_rules || []).find((r: any) => r.title.toUpperCase() === code.toUpperCase());

            if (matchingRule) {
                // 2. Delete the Price Rule on Shopify (which automatically deletes any associated discount codes!)
                const deleteRes = await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/price_rules/${matchingRule.id}.json`, {
                    method: "DELETE",
                    headers: { "X-Shopify-Access-Token": accessToken }
                });

                if (!deleteRes.ok) {
                    const errData = await deleteRes.json().catch(() => null) || await deleteRes.text();
                    throw new Error(`Failed to delete price rule: ${JSON.stringify(errData)}`);
                }
            }

            return new Response(JSON.stringify({ success: true, message: "Discount code deleted successfully from Shopify" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        } catch (err: any) {
            return new Response(JSON.stringify({ error: "Failed to delete discount on Shopify", details: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
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
      const { shopify_variant_id, stock, price } = body;
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

        if (price !== undefined && price !== null && parseFloat(price) > 0) {
          await fetch(
            `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/variants/${shopify_variant_id}.json`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken
              },
              body: JSON.stringify({
                variant: {
                  id: shopify_variant_id,
                  price: String(price)
                }
              })
            }
          );
        }

        return new Response(JSON.stringify({ success: true, message: "Stock and price updated successfully on Shopify" }), {
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

    // معالجة إلغاء الطلب في شوبيفاي (Cancel Order in Shopify)
    if (action === 'cancel_order') {
      const { shopify_order_id, reason } = body;
      if (!shopify_order_id) {
        return new Response(JSON.stringify({ error: "Missing shopify_order_id" }), {
          status: 400,
          headers: corsHeaders
        });
      }
      try {
        console.log(`Cancelling order ${shopify_order_id} in Shopify Admin...`);
        const cancelRes = await fetch(
          `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/orders/${shopify_order_id}/cancel.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken
            },
            body: JSON.stringify({
              restock: false, // Prevent Shopify REST API's buggy native restocking. ERP will manually push the correct stock.
              reason: reason || "customer"
            })
          }
        );
        const cancelData = await cancelRes.json();
        if (!cancelRes.ok) {
          console.warn("Shopify cancel order warning/error:", cancelData);
          return new Response(JSON.stringify({ success: false, warning: "Failed or order already cancelled on Shopify", details: cancelData }), {
            status: 200,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Order cancelled successfully in Shopify", data: cancelData }), {
          status: 200,
          headers: corsHeaders
        });
      } catch (err: any) {
        console.error("Error cancelling order on Shopify:", err);
        return new Response(JSON.stringify({ error: "Error cancelling order on Shopify", details: err.message }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }

    // معالجة تنفيذ الشحن والطلب في شوبيفاي (Fulfill Order in Shopify to release Committed stock & update On Hand)
    if (action === 'fulfill_order') {
      const { shopify_order_id } = body;
      if (!shopify_order_id) {
        return new Response(JSON.stringify({ error: "Missing shopify_order_id" }), {
          status: 400,
          headers: corsHeaders
        });
      }
      try {
        console.log(`Fulfilling order ${shopify_order_id} in Shopify...`);
        // 1. Fetch fulfillment orders for this order
        const foRes = await fetch(
          `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/orders/${shopify_order_id}/fulfillment_orders.json`,
          {
            method: "GET",
            headers: { "X-Shopify-Access-Token": accessToken }
          }
        );
        
        let fulfillmentOrderId = null;
        if (foRes.ok) {
          const foData = await foRes.json();
          const openFo = (foData.fulfillment_orders || []).find((fo: any) => fo.status === 'open' || fo.status === 'in_progress');
          if (openFo) {
            fulfillmentOrderId = openFo.id;
          }
        }

        let fulfillData: any = null;
        let fulfillRes: any = null;

        if (fulfillmentOrderId) {
          // Use modern fulfillment_orders API
          fulfillRes = await fetch(
            `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/fulfillments.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken
              },
              body: JSON.stringify({
                fulfillment: {
                  line_items_by_fulfillment_order: [
                    {
                      fulfillment_order_id: fulfillmentOrderId
                    }
                  ]
                }
              })
            }
          );
          fulfillData = await fulfillRes.json();
        } else {
          // Fallback legacy fulfillment API
          fulfillRes = await fetch(
            `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/orders/${shopify_order_id}/fulfillments.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken
              },
              body: JSON.stringify({
                fulfillment: {
                  notify_customer: false
                }
              })
            }
          );
          fulfillData = await fulfillRes.json();
        }

        if (!fulfillRes || !fulfillRes.ok) {
          console.warn("Shopify fulfill order warning/error:", fulfillData);
          return new Response(JSON.stringify({ success: false, warning: "Order may already be fulfilled or unavailable for fulfillment", details: fulfillData }), {
            status: 200,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Order fulfilled successfully in Shopify", data: fulfillData }), {
          status: 200,
          headers: corsHeaders
        });
      } catch (err: any) {
        console.error("Error fulfilling order on Shopify:", err);
        return new Response(JSON.stringify({ error: "Error fulfilling order on Shopify", details: err.message }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }

    // معالجة تحديث حالة الدفع في شوبيفاي لـ Paid (Mark Payment Received in Shopify)
    if (action === 'mark_order_paid') {
      const { shopify_order_id, amount } = body;
      if (!shopify_order_id) {
        return new Response(JSON.stringify({ error: "Missing shopify_order_id" }), {
          status: 400,
          headers: corsHeaders
        });
      }
      try {
        console.log(`Marking order ${shopify_order_id} as Paid in Shopify...`);
        
        // 1. Fetch order details to get total price if amount not passed
        let targetAmount = amount;
        if (!targetAmount) {
          const ordRes = await fetch(
            `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/orders/${shopify_order_id}.json`,
            {
              method: "GET",
              headers: { "X-Shopify-Access-Token": accessToken }
            }
          );
          if (ordRes.ok) {
            const ordData = await ordRes.json();
            targetAmount = ordData?.order?.total_price || "0.00";
          }
        }

        // 2. Post a capture transaction
        const txRes = await fetch(
          `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/orders/${shopify_order_id}/transactions.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken
            },
            body: JSON.stringify({
              transaction: {
                kind: "capture",
                status: "success",
                amount: String(targetAmount)
              }
            })
          }
        );
        const txData = await txRes.json();

        if (!txRes.ok) {
          console.warn("Shopify mark order paid warning/error:", txData);
          return new Response(JSON.stringify({ success: false, warning: "Failed or order already paid on Shopify", details: txData }), {
            status: 200,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Order payment marked as Paid successfully in Shopify", data: txData }), {
          status: 200,
          headers: corsHeaders
        });
      } catch (err: any) {
        console.error("Error marking order paid on Shopify:", err);
        return new Response(JSON.stringify({ error: "Error marking order paid on Shopify", details: err.message }), {
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
      id: (v.shopify_id && String(v.shopify_id).trim() !== "" && String(v.shopify_id) !== "null" && String(v.shopify_id) !== "undefined") ? parseInt(v.shopify_id) : undefined,
      price: v.price || v.retailPrice || v.wholesalePrice || 0,
      sku: v.sku || "",
      option1: (variants.length === 1) ? "Default Title" : (v.name || "Default Title"),
      inventory_management: "shopify"
    }));

    // تجهيز خيارات البدائل (Options) إذا كان هناك أكثر من بديل أو بديل مخصص
    const shopifyOptions = (shopifyVariants.length > 1 || (shopifyVariants[0] && shopifyVariants[0].option1 !== "Default Title"))
      ? [{ name: "Options", values: shopifyVariants.map(v => v.option1) }]
      : [{ name: "Title", values: ["Default Title"] }];

    // تجهيز الصور (Images) - تحويل الروابط الخارجية إلى base64 attachments أو إرسال المرفوع مباشرة من الجهاز
    const shopifyImages = [];
    for (let idx = 0; idx < (images || []).length; idx++) {
      const img = images[idx];
      if (typeof img === 'string' && (img.startsWith("http://") || img.startsWith("https://"))) {
        const base64Data = await fetchImageAsBase64(img);
        if (base64Data) {
          shopifyImages.push({
            attachment: base64Data,
            filename: `product-image-${idx + 1}.jpg`,
            position: idx + 1
          });
        } else {
          shopifyImages.push({
            src: img,
            position: idx + 1
          });
        }
      } else if (typeof img === 'string') {
        const matches = img.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const base64Data = matches ? matches[2] : (img.includes("base64,") ? img.split("base64,")[1] : img);
        shopifyImages.push({
          attachment: base64Data,
          filename: `product-image-${idx + 1}.jpg`,
          position: idx + 1
        });
      }
    }

    // 3. تجهيز الـ Payload بالطريقة التي تفهمها شوبيفاي
    // تنبيه هام جداً: عند التعديل (update)، لا يتم وضع مصفوفة الصور داخل طلب الـ PUT الرئيسي لمنع شوبيفاي من مسح صور المنتج الحالية
    const shopifyPayload: any = {
      product: {
        title: name,
        body_html: convertPlaintextToHtml(description) || "منتج مضاف من نظام إدارة المخزون",
        vendor: vendor || "Octabot",
        product_type: category || "",
        tags: tags || "",
        status: status || "draft",
        published: status === "active",
        ...(shopifyVariants.length > 0 && { variants: shopifyVariants }),
        ...(shopifyOptions.length > 0 && { options: shopifyOptions })
      }
    };

    // يتم إضافة مصفوفة الصور فقط عند إنشاء منتج جديد لأول مرة (POST)
    if (action !== 'update') {
      if (shopifyImages.length > 0) {
        shopifyPayload.product.images = shopifyImages;
      }
    }

    // إذا كان إجراء تعديل لمواكبة رفع الصور الجديدة وإعادة ترتيب الصور الحالية في شوبيفاي
    if (action === 'update' && shopify_id && images && Array.isArray(images)) {
      try {
        // 1. جلب كافة الصور الحالية للمنتج من شوبيفاي مع الـ IDs والـ Positions
        const getImgsRes = await fetch(
          `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products/${shopify_id}/images.json`,
          {
            method: "GET",
            headers: { "X-Shopify-Access-Token": accessToken }
          }
        );
        
        let existingShopifyImages: any[] = [];
        if (getImgsRes.ok) {
          const imgsData = await getImgsRes.json();
          existingShopifyImages = imgsData.images || [];
        }

        // دالة مساعدة لاستخراج الجزء الأساسي من اسم ملف الصورة
        const getFilenameFromUrl = (urlStr: string) => {
          if (!urlStr || typeof urlStr !== 'string') return '';
          const cleanUrl = urlStr.split('?')[0];
          return cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1).toLowerCase();
        };

        // 2. المرور على قائمة الصور القادمة من الفرونت إند حسب الترتيب الجديد (index + 1)
        for (let idx = 0; idx < images.length; idx++) {
          const img = images[idx];
          const targetPosition = idx + 1;

          if (typeof img === 'string' && img.startsWith('data:')) {
            // صورة جديدة تماماً بـ base64 -> نقوم برفعها لشوبيفاي مع تعيين الترتيب مباشرة
            const matches = img.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            const base64Data = matches ? matches[2] : (img.includes("base64,") ? img.split("base64,")[1] : img);
            
            await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products/${shopify_id}/images.json`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken
              },
              body: JSON.stringify({
                image: {
                  attachment: base64Data,
                  filename: `product-image-${Date.now()}-${idx + 1}.jpg`,
                  position: targetPosition
                }
              })
            });
          } else if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
            // صورة موجودة مسبقاً برابط -> البحث عنها في صور شوبيفاي الحالية
            const targetFilename = getFilenameFromUrl(img);
            const matchedShopifyImg = existingShopifyImages.find(ex => {
              if (ex.src === img) return true;
              const exFilename = getFilenameFromUrl(ex.src);
              return exFilename && targetFilename && (exFilename === targetFilename || img.includes(exFilename) || ex.src.includes(targetFilename));
            });

            if (matchedShopifyImg) {
              // إذا كانت الصورة موجودة في شوبيفاي وتغير موقعها -> تحديث الترتيب عبر PUT
              if (matchedShopifyImg.position !== targetPosition) {
                await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products/${shopify_id}/images/${matchedShopifyImg.id}.json`, {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": accessToken
                  },
                  body: JSON.stringify({
                    image: {
                      id: matchedShopifyImg.id,
                      position: targetPosition
                    }
                  })
                });
              }
            } else {
              // إذا كانت الصورة غير موجودة إطلاقاً في شوبيفاي -> جلب ملف الصورة وتحويله لـ Base64 ورفعه كـ attachment
              const base64Data = await fetchImageAsBase64(img);
              if (base64Data) {
                await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products/${shopify_id}/images.json`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": accessToken
                  },
                  body: JSON.stringify({
                    image: {
                      attachment: base64Data,
                      filename: `product-image-${Date.now()}-${idx + 1}.jpg`,
                      position: targetPosition
                    }
                  })
                });
              } else {
                // Fallback to src
                await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products/${shopify_id}/images.json`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": accessToken
                  },
                  body: JSON.stringify({
                    image: {
                      src: img,
                      position: targetPosition
                    }
                  })
                });
              }
            }
          }
        }

        // 3. حذف الصور التي تمت إزالتها في الفرونت إند من شوبيفاي
        for (const exImg of existingShopifyImages) {
          const exFilename = getFilenameFromUrl(exImg.src);
          const stillExists = images.some(img => {
            if (typeof img !== 'string') return false;
            if (img.startsWith('data:')) return false; // الصور المرفوعة حديثاً لا تطابق الروابط القديمة
            if (exImg.src === img) return true;
            const targetFilename = getFilenameFromUrl(img);
            return exFilename && targetFilename && (exFilename === targetFilename || img.includes(exFilename) || exImg.src.includes(targetFilename));
          });

          if (!stillExists) {
            try {
              await fetch(`https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products/${shopify_id}/images/${exImg.id}.json`, {
                method: "DELETE",
                headers: { "X-Shopify-Access-Token": accessToken }
              });
            } catch (deleteErr) {
              console.error(`Failed to delete image ${exImg.id} from Shopify:`, deleteErr);
            }
          }
        }
      } catch (imgUpdateErr) {
        console.error("Failed to sync images order to Shopify:", imgUpdateErr);
      }
    }

    // Delete orphaned variants in Shopify if it's an update action
    if (action === 'update' && shopify_id) {
      try {
        console.log("Fetching existing variants from Shopify to check for orphans...");
        const getProdRes = await fetch(
          `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products/${shopify_id}.json`,
          {
            method: "GET",
            headers: { "X-Shopify-Access-Token": accessToken }
          }
        );
        
        if (getProdRes.ok) {
          const prodData = await getProdRes.json();
          const existingShopifyVariants = prodData?.product?.variants || [];
          
          // Map incoming variants IDs to compare
          const incomingVariantIds = (variants || [])
            .map((v: any) => v.shopify_id ? parseInt(v.shopify_id) : null)
            .filter((id: number | null) => id !== null);

          console.log("Existing Shopify variant IDs:", existingShopifyVariants.map((ev: any) => ev.id));
          console.log("Incoming active variant IDs:", incomingVariantIds);

          // We only delete if there will be at least one variant remaining
          if (incomingVariantIds.length > 0) {
            for (const ev of existingShopifyVariants) {
              if (!incomingVariantIds.includes(ev.id)) {
                console.log(`Deleting orphaned variant ${ev.id} on Shopify...`);
                try {
                  const delVarRes = await fetch(
                    `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/variants/${ev.id}.json`,
                    {
                      method: "DELETE",
                      headers: { "X-Shopify-Access-Token": accessToken }
                    }
                  );
                  console.log(`Deleted variant ${ev.id} response status:`, delVarRes.status);
                } catch (delVarErr) {
                  console.error(`Error deleting variant ${ev.id}:`, delVarErr);
                }
              }
            }
          }
        }
      } catch (errFetch) {
        console.error("Failed to cleanup orphaned variants from Shopify:", errFetch);
      }
    }

    // 4. إرسال الطلب إلى Shopify Admin API بناءً على الإجراء
    const apiUrl = (action === 'update' && shopify_id) 
      ? `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products/${shopify_id}.json`
      : `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products.json`;
      
    const apiMethod = (action === 'update' && shopify_id) ? "PUT" : "POST";

    let shopifyResponse = await fetch(apiUrl, {
        method: apiMethod,
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken
        },
        body: JSON.stringify(shopifyPayload)
      }
    );

    let shopifyData = await shopifyResponse.json();

    // إذا فشل الطلب في شوبيفاي، نقوم بمحاولة تصحيح معرّفات البدائل التالفة وإعادة المحاولة
    if (!shopifyResponse.ok) {
      const errorMsg = JSON.stringify(shopifyData.errors || shopifyData);
      const idMatch = errorMsg.match(/The following IDs do not exist or do not belong to the product:\s*\[([^\]]+)\]/i);
      if (idMatch && idMatch[1]) {
        const invalidIds = idMatch[1].split(',').map(id => id.trim()).filter(id => id && id !== 'nil' && id !== 'null');
        console.warn("Detected invalid/deleted variant IDs on Shopify:", invalidIds);
        if (invalidIds.length > 0) {
          console.log("Auto-recovering: Retrying update by removing invalid variant IDs from payload...");
          const retriedVariants = shopifyVariants.map(v => {
            if (v.id && invalidIds.includes(String(v.id))) {
              return { ...v, id: undefined }; // Reset to recreate
            }
            return v;
          });
          shopifyPayload.product.variants = retriedVariants;
          
          shopifyResponse = await fetch(apiUrl, {
            method: apiMethod,
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken
            },
            body: JSON.stringify(shopifyPayload)
          });
          shopifyData = await shopifyResponse.json();
          console.log("Retry finished. Status:", shopifyResponse.status);
        }
      }
    }

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

    // 5.4 جلب صور المنتج النهائية للحصول على روابط CDN الحديثة لشوبيفاي
    let finalImages = [];
    try {
      const finalImgsRes = await fetch(
        `https://${STORE_NAME}.myshopify.com/admin/api/${API_VERSION}/products/${shopify_product_id}/images.json`,
        {
          method: "GET",
          headers: { "X-Shopify-Access-Token": accessToken }
        }
      );
      if (finalImgsRes.ok) {
        const finalImgsData = await finalImgsRes.json();
        finalImages = (finalImgsData.images || []).map((img: any) => (img.src || '').split('?')[0]);
      }
    } catch (e) {
      console.error("Failed to fetch final product images from Shopify:", e);
    }

    // 6. الرد بالنجاح وإرجاع البيانات
      return new Response(
        JSON.stringify({
          success: true,
          message: "تم تنفيذ العملية بنجاح في شوبيفاي",
          shopify_product_id: shopifyData.product.id,
          variants_map: shopifyData.product.variants.map(v => ({ sku: v.sku, id: v.id })),
          images: finalImages,
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
