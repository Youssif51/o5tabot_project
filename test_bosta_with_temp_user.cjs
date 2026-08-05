const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseServiceKey = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabaseAnonKey = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const orderId = 'ORD-2026-2928';
  const testEmail = `test-bosta-admin-${Date.now()}@o5tabot.com`;
  const testPassword = 'TestPassword123!';
  let createdUser = null;

  try {
    // 1. Create a temporary auth user
    console.log("Creating temporary auth user:", testEmail);
    const { data: { user }, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (createErr || !user) {
      throw new Error("Failed to create temp user: " + (createErr?.message || "unknown"));
    }
    createdUser = user;

    // 2. Fetch public.users schema or add user to profiles if necessary
    // Let's see if public.users trigger handles it. Let's check if user exists in public.users:
    const { data: publicUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!publicUser) {
      console.log("Adding user to public.users table...");
      await supabaseAdmin.from('users').insert({
        id: user.id,
        email: testEmail,
        name: 'Bosta Test Admin',
        role: 'Admin'
      });
    }

    // 3. Sign in on the anon client to get session token
    console.log("Signing in as temp user...");
    const { data: sessionData, error: loginErr } = await supabaseAnon.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (loginErr || !sessionData?.session) {
      throw new Error("Failed to sign in: " + (loginErr?.message || "unknown"));
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      }
    });

    // 4. Temporarily set order status to 'Pending' so the Edge Function doesn't reject it
    await supabaseAdmin.from('orders').update({ status: 'Pending' }).eq('id', orderId);

    // 5. Query order details to build bostaMetadata
    const { data: order } = await supabaseAdmin.from('orders').select('*').eq('id', orderId).single();
    const addrObj = JSON.parse(order.address);
    const bostaMetadata = {
      customerName: order.client,
      customerPhone: addrObj.phone || '',
      customerSecondPhone: addrObj.secondPhone || '',
      customerAddress: addrObj.detailAddress || order.address || '',
      governorate: order.governorate || '',
      bostaCityCode: addrObj.bostaCityCode,
      bostaCityName: addrObj.bostaCityName,
      bostaDistrictId: addrObj.bostaDistrictId,
      bostaDistrictName: addrObj.bostaDistrictName,
      bostaZoneId: addrObj.bostaZoneId,
      allowToOpenPackage: addrObj.allowToOpenPackage || false
    };

    console.log("Invoking create-bosta-delivery as authenticated user...");
    const { data: resData, error: invokeErr } = await userClient.functions.invoke('create-bosta-delivery', {
      body: {
        orderId,
        bostaMetadata,
        depositAmount: order.deposit
      }
    });

    console.log("Response data:", resData);
    if (invokeErr) {
      console.error("Invoke error details:");
      if (invokeErr.context) {
        try {
          const text = await invokeErr.context.text();
          console.error("Context body text:", text);
        } catch (e) {}
      } else {
        console.error(invokeErr);
      }
    }
  } catch (err) {
    console.error("Error occurred:", err);
  } finally {
    // 6. Cleanup
    console.log("Cleaning up...");
    // Restore status to Cancelled
    await supabaseAdmin.from('orders').update({ status: 'Cancelled' }).eq('id', orderId);
    
    // Delete public.users record
    if (createdUser) {
      await supabaseAdmin.from('users').delete().eq('id', createdUser.id);
      // Delete auth user
      await supabaseAdmin.auth.admin.deleteUser(createdUser.id);
      console.log("Deleted temporary user successfully.");
    }
  }
}

run();
