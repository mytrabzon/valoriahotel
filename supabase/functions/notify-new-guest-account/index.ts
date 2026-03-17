// Valoria Hotel - Yeni misafir hesabı (uygulama misafir girişi) oluşturulduğunda admin'lere bildirim.
// Body: { guest_id: string }. Sadece is_guest_app_account ve welcome_email_sent_at null ise bildirim atar ve tarihi set eder.
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { guest_id } = (await req.json()) as { guest_id?: string };
    if (!guest_id?.trim()) {
      return new Response(JSON.stringify({ error: "guest_id gerekli" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: guest, error: guestErr } = await supabase
      .from("guests")
      .select("id, email, full_name, is_guest_app_account, welcome_email_sent_at")
      .eq("id", guest_id.trim())
      .maybeSingle();

    if (guestErr || !guest) {
      return new Response(JSON.stringify({ error: "Misafir bulunamadı" }), {
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const isGuestApp = !!guest.is_guest_app_account;
    const alreadySent = !!guest.welcome_email_sent_at;
    if (!isGuestApp || alreadySent) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: alreadySent ? "already_sent" : "not_guest_app" }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const title = "Yeni misafir hesabı";
    const body = `E-posta: ${guest.email ?? "-"}, Ad: ${guest.full_name ?? "Misafir"}`;
    const fnUrl = `${supabaseUrl}/functions/v1/notify-admins`;
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        title,
        body,
        data: { url: "/admin/guests", screen: "admin" },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: "Bildirim gönderilemedi: " + errText }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("guests")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", guest_id.trim());

    return new Response(
      JSON.stringify({ ok: true, notified: true }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
