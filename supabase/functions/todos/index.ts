import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    // RLS-scoped client is available at ctx.supabase
    // Admin client (bypasses RLS) is available at ctx.supabaseAdmin
    const { data, error } = await ctx.supabase.from("todos").select();
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }),
};
