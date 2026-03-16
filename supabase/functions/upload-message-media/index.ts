// Valoria Hotel - Sesli mesaj / medya yükleme (misafir app_token ile)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "message-media";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { app_token, conversation_id, audio_base64, mime_type = "audio/m4a" } = body;
    if (!app_token || !conversation_id || !audio_base64) {
      return new Response(
        JSON.stringify({ error: "app_token, conversation_id, audio_base64 gerekli" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    const { data: guest } = await supabase
      .from("guests")
      .select("id")
      .eq("app_token", app_token)
      .single();
    if (!guest) {
      return new Response(JSON.stringify({ error: "Geçersiz token" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const { data: part } = await supabase
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", conversation_id)
      .eq("participant_id", guest.id)
      .eq("participant_type", "guest")
      .is("left_at", null)
      .single();
    if (!part) {
      return new Response(JSON.stringify({ error: "Bu sohbete erişim yok" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const ext = mime_type.includes("mpeg") || mime_type.includes("mp3") ? "mp3" : "m4a";
    const path = `voice/${crypto.randomUUID()}.${ext}`;
    const binary = Uint8Array.from(atob(audio_base64), (c) => c.charCodeAt(0));
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, binary, {
      contentType: mime_type,
      upsert: false,
    });
    if (uploadErr) {
      return new Response(
        JSON.stringify({ error: "Yükleme hatası: " + uploadErr.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return new Response(JSON.stringify({ url: urlData.publicUrl }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Sunucu hatası" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
