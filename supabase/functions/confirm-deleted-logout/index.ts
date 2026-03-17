// Valoria Hotel - Silinmiş hesap: auth kullanıcısını kaldır, lobiye dönüş tamamlansın
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim() ?? null;
  if (!token) {
    return new Response(JSON.stringify({ error: "Yetkisiz: Token gerekli" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return new Response(JSON.stringify({ error: "Sunucu yapılandırma hatası" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Oturum bulunamadı" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const uid = user.id;
  const { data: staffRow } = await supabaseAdmin.from("staff").select("id, deleted_at").eq("auth_id", uid).maybeSingle();
  if (staffRow?.deleted_at) {
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (deleteErr) {
      return new Response(JSON.stringify({ error: deleteErr.message || "Hesap kaldırılamadı" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let guestDeleted = false;
  const { data: gByAuth } = await supabaseAdmin.from("guests").select("id, deleted_at").eq("auth_user_id", uid).maybeSingle();
  guestDeleted = !!gByAuth?.deleted_at;
  if (!guestDeleted && user.email) {
    const email = lowerTrim(user.email);
    const { data: gByEmail } = await supabaseAdmin.from("guests").select("id, deleted_at").eq("email", email).maybeSingle();
    guestDeleted = !!gByEmail?.deleted_at;
  }
  if (guestDeleted) {
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (deleteErr) {
      return new Response(JSON.stringify({ error: deleteErr.message || "Hesap kaldırılamadı" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Hesap silinmiş değil" }), {
    status: 400,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

function lowerTrim(s: string): string {
  const t = s.trim();
  return t ? t.toLowerCase() : "";
}
