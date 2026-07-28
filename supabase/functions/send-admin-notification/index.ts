// Deno Edge Function: send-admin-notification
// @ts-ignore - Supress VS Code errors since Deno is available globally in Supabase
declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY secret in Supabase");
    }

    const body = await req.json();
    const { action, recipientEmail, data } = body;

    if (!action || !recipientEmail) {
      return new Response(JSON.stringify({ error: "Missing required fields: action, recipientEmail" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    let subject = "";
    let htmlContent = "";

    const systemUrl = "https://dashboard.a5store.com/dashboard"; // Live ERP URL
    const sender = Deno.env.get("SENDER_EMAIL") || "no-reply@dashboard.a5store.com";

    // Common style wrapper with Cairo font import
    const cairoStyles = `
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
      body, table, td, a {
        font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }
    `;

    // 1. Welcome Admin Template
    if (action === "welcome_admin") {
      const { name, role } = data;
      subject = "مرحباً بك في عائلة A5 Store! 🎉";
      htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>مرحباً بك في A5 Store</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            ${cairoStyles}
          </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0b0d10; font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc; text-align: right; direction: rtl;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0d10; padding: 40px 10px; direction: rtl;">
            <tr>
              <td align="center">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #12141c; border: 1px solid #d4af37; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); direction: rtl;">
                  <!-- Header with A5 Store Branding -->
                  <tr>
                    <td align="center" style="background: linear-gradient(135deg, #1a1c24 0%, #111217 100%); border-bottom: 2px solid #d4af37; padding: 35px 20px;">
                      <table border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" style="font-size: 26px; font-weight: bold; color: #d4af37; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; letter-spacing: 1px;">
                            A5 Store
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 35px; text-align: right;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="direction: rtl;">
                        <tr>
                          <td style="font-size: 20px; font-weight: bold; color: #ffffff; padding-bottom: 15px; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                            مرحباً بك يا ${name}،
                          </td>
                        </tr>
                        <tr>
                          <td style="font-size: 15px; line-height: 1.8; color: #cbd5e1; padding-bottom: 20px; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                            يسعدنا جداً انضمامك إلى فريق إدارة <strong>A5 Store</strong> بصفتك <strong>(${role === 'SuperAdmin' ? 'سوبر أدمن' : 'أدمن تشغيل'})</strong>.
                          </td>
                        </tr>
                        <tr>
                          <td style="font-size: 15px; line-height: 1.8; color: #cbd5e1; padding-bottom: 25px; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                            تم إنشاء وتفعيل حسابك بنجاح في لوحة التحكم الإدارية. يمكنك الآن تسجيل الدخول للبدء في إدارة الطلبات، ومتابعة المخزون والعهدة المالية.
                          </td>
                        </tr>
                        <!-- Details Card -->
                        <tr>
                          <td>
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1a1d26; border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 12px; padding: 25px; direction: rtl;">
                              <tr>
                                <td style="padding-bottom: 6px; font-size: 13px; color: #94a3b8; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                                  <strong>البريد الإلكتروني للحساب:</strong>
                                </td>
                              </tr>
                              <tr>
                                <td dir="ltr" style="padding-bottom: 18px; font-size: 16px; font-weight: bold; color: #ffffff; font-family: monospace; letter-spacing: 0.5px; text-align: right;">
                                  ${recipientEmail}
                                </td>
                              </tr>
                              <tr>
                                <td style="padding-bottom: 6px; font-size: 13px; color: #94a3b8; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                                  <strong>الدور والصلاحيات:</strong>
                                </td>
                              </tr>
                              <tr>
                                <td style="font-size: 16px; font-weight: bold; color: #d4af37; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                                  ${role === 'SuperAdmin' ? 'سوبر أدمن (تحكم كامل)' : 'أدمن تشغيل (مستودع ومبيعات)'}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <!-- CTA Button -->
                        <tr>
                          <td align="center" style="padding-top: 35px;">
                            <table border="0" cellspacing="0" cellpadding="0">
                              <tr>
                                <td align="center" style="background-color: #d4af37; border-radius: 8px;">
                                  <a href="${systemUrl}" target="_blank" style="display: inline-block; font-size: 16px; font-weight: bold; color: #000000; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;">
                                    الدخول إلى لوحة التحكم
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td align="center" style="background-color: #0b0d10; border-top: 1px solid rgba(255,255,255,0.05); padding: 25px; font-size: 12px; color: #64748b; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; text-align: center;">
                      هذه الرسالة تم إنشاؤها تلقائياً من خادم A5 Store.<br>يرجى عدم الرد على هذا البريد.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    }

    // 2. Deposit Assignment Template
    else if (action === "deposit_assignment") {
      const { amount, clientName, orderId, creatorName } = data;
      subject = "⚠️ تنبيه عهدة: تم تعيين عربون معلق تحت حسابك";
      htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تنبيه عهدة جديدة معلقة</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            ${cairoStyles}
          </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0b0d10; font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc; text-align: right; direction: rtl;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0d10; padding: 40px 10px; direction: rtl;">
            <tr>
              <td align="center">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #12141c; border: 1px solid #ef4444; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); direction: rtl;">
                  <!-- Header with A5 Store Branding -->
                  <tr>
                    <td align="center" style="background: linear-gradient(135deg, #1a1c24 0%, #111217 100%); border-bottom: 2px solid #ef4444; padding: 35px 20px;">
                      <table border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" style="font-size: 26px; font-weight: bold; color: #ef4444; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; letter-spacing: 1px;">
                            A5 Store
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 35px; text-align: right;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="direction: rtl;">
                        <tr>
                          <td style="font-size: 18px; font-weight: bold; color: #ffffff; padding-bottom: 15px; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                            عزيزي مسؤول الحسابات،
                          </td>
                        </tr>
                        <tr>
                          <td style="font-size: 15px; line-height: 1.8; color: #cbd5e1; padding-bottom: 25px; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                            نود إشعارك بأن الأدمن <strong>(${creatorName})</strong> قام للتو بتسجيل طلب جديد في السيستم وعيّن مبلغ عربون تحت عهدتك الشخصية بانتظار مراجعتك وتأكيدك.
                          </td>
                        </tr>
                        <!-- Details Card -->
                        <tr>
                          <td>
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1a1415; border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 12px; padding: 25px; direction: rtl;">
                              <tr>
                                <td width="40%" style="padding-bottom: 15px; font-size: 14px; color: #fca5a5; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                                  <strong>رقم الطلب:</strong>
                                </td>
                                <td width="60%" dir="ltr" style="padding-bottom: 15px; font-size: 16px; font-weight: bold; color: #ffffff; font-family: monospace; text-align: right;">
                                  #${orderId}
                                </td>
                              </tr>
                              <tr>
                                <td style="padding-bottom: 15px; font-size: 14px; color: #fca5a5; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                                  <strong>مبلغ العربون:</strong>
                                </td>
                                <td style="padding-bottom: 15px; font-size: 18px; font-weight: bold; color: #ef4444; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                                  ${amount} ج.م
                                </td>
                              </tr>
                              <tr>
                                <td style="padding-bottom: 15px; font-size: 14px; color: #fca5a5; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                                  <strong>اسم العميل:</strong>
                                </td>
                                <td style="padding-bottom: 15px; font-size: 15px; color: #ffffff; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                                  ${clientName}
                                </td>
                              </tr>
                              <tr>
                                <td style="font-size: 14px; color: #fca5a5; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                                  <strong>مسجل الطلب:</strong>
                                </td>
                                <td style="font-size: 15px; color: #ffffff; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                                  ${creatorName}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="font-size: 14px; line-height: 1.8; color: #94a3b8; padding-top: 25px; padding-bottom: 10px; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; text-align: right; direction: rtl;">
                            يرجى مراجعة محفظتك الإلكترونية أو حساب الاستلام الفعلي لتأكيد وصول المبلغ، ثم الانتقال للسيستم لتأكيده وتصفير عهدة الطلب.
                          </td>
                        </tr>
                        <!-- CTA Button -->
                        <tr>
                          <td align="center" style="padding-top: 25px;">
                            <table border="0" cellspacing="0" cellpadding="0">
                              <tr>
                                <td align="center" style="background-color: #ef4444; border-radius: 8px;">
                                  <a href="${systemUrl}" target="_blank" style="display: inline-block; font-size: 15px; font-weight: bold; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;">
                                    الانتقال لتأكيد العربون
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td align="center" style="background-color: #0b0d10; border-top: 1px solid rgba(255,255,255,0.05); padding: 25px; font-size: 12px; color: #64748b; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; text-align: center;">
                      هذه الرسالة تم إنشاؤها تلقائياً من خادم A5 Store.<br>يرجى عدم الرد على هذا البريد.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    } else {
      throw new Error(`Unsupported notification action: ${action}`);
    }

    // Call Resend API
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `A5 Store <${sender}>`,
        to: [recipientEmail],
        subject: subject,
        html: htmlContent
      })
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      console.error("Resend API Failure Response:", resendData);
      throw new Error(resendData?.message || "Failed to deliver email through Resend");
    }

    return new Response(JSON.stringify({ success: true, message: "Email notification delivered successfully", data: resendData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (err: any) {
    console.error("send-admin-notification error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
