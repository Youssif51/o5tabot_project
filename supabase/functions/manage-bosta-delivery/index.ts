import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const body = await req.json();
    const { action, bostaDeliveryId, payload } = body;

    if (!action || !bostaDeliveryId) {
      return new Response(JSON.stringify({ error: "Missing required fields: action, bostaDeliveryId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const bostaApiKey = Deno.env.get('BOSTA_API_KEY');

    if (!bostaApiKey) {
      return new Response(JSON.stringify({ error: "Bosta API key not configured in environment variables." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (action === 'cancel') {
      console.log(`Cancelling delivery ${bostaDeliveryId}`);
      const bostaRes = await fetch(`https://api.bosta.co/api/v0/deliveries/${bostaDeliveryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': bostaApiKey
        }
      });

      let bostaData: any = {};
      let bostaText = "";
      try {
        bostaText = await bostaRes.text();
        bostaData = JSON.parse(bostaText);
      } catch (e) {
        bostaData = { rawText: bostaText };
      }
      
      console.log("Bosta Cancel Response:", JSON.stringify(bostaData));

      if (!bostaRes.ok) {
        return new Response(JSON.stringify({ error: bostaData.message || "Failed to cancel delivery.", bostaRaw: bostaData }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Delivery cancelled." }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    } 
    else if (action === 'update') {
      console.log(`Updating delivery ${bostaDeliveryId} with payload:`, JSON.stringify(payload));
      
      const bostaRes = await fetch(`https://api.bosta.co/api/v0/deliveries/${bostaDeliveryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': bostaApiKey
        },
        body: JSON.stringify(payload)
      });

      let bostaData: any = {};
      let bostaText = "";
      try {
        bostaText = await bostaRes.text();
        bostaData = JSON.parse(bostaText);
      } catch (e) {
        bostaData = { rawText: bostaText };
      }
      
      console.log("Bosta Update Response:", JSON.stringify(bostaData));

      if (!bostaRes.ok) {
        return new Response(JSON.stringify({ error: bostaData.message || "Failed to update delivery.", bostaRaw: bostaData }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Delivery updated.", data: bostaData }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    else {
      return new Response(JSON.stringify({ error: "Invalid action." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

  } catch (error: any) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
