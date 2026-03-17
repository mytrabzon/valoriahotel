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
    const raw = body as Record<string, unknown>;
    const app_token = typeof raw.app_token === "string" ? raw.app_token.trim() : undefined;
    const conversation_id = typeof raw.conversation_id === "string" ? raw.conversation_id.trim() : undefined;
    const audio_base64 = raw.audio_base64;
    const image_base64 = raw.image_base64;
    const mime_type = (raw.mime_type as string) || "audio/m4a";
    const isImage = Boolean(image_base64);
    console.log("[upload-message-media] isImage=", isImage, "conversation_id=", conversation_id, "base64Len=", (isImage ? image_base64 : audio_base64)?.length);
    if (!app_token || !conversation_id || (!audio_base64 && !image_base64)) {
      console.warn("[upload-message-media] Eksik parametre:", { hasToken: !!app_token, hasConv: !!conversation_id, hasAudio: !!audio_base64, hasImage: !!image_base64 });
      return new Response(
        JSON.stringify({ error: "app_token, conversation_id ve audio_base64 veya image_base64 gerekli" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    const { data: guest } = await supabase
      .from("guests")
      .select("id")
      .eq("app_token", app_token)
      .single();
    if (!guest) {
      console.warn("[upload-message-media] Geçersiz app_token");
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
      console.warn("[upload-message-media] Konuşmaya katılım yok, conversation_id=", conversation_id);
      return new Response(JSON.stringify({ error: "Bu sohbete erişim yok" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const base64 = isImage ? image_base64 : audio_base64;
    const contentType = isImage ? (mime_type || "image/jpeg") : mime_type;
    let path: string;
    if (isImage) {
      const ext = contentType.includes("png") ? "png" : "jpg";
      path = `images/${crypto.randomUUID()}.${ext}`;
    } else {
      const ext = contentType.includes("mpeg") || contentType.includes("mp3") ? "mp3" : "m4a";
      path = `voice/${crypto.randomUUID()}.${ext}`;
    }
    let binary: Uint8Array;
    try {
      binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    } catch (e) {
      console.error("[upload-message-media] atob hatası:", e instanceof Error ? e.message : e);
      return new Response(
        JSON.stringify({ error: "Geçersiz base64" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, binary, {
      contentType,
      upsert: false,
    });
    if (uploadErr) {
      console.error("[upload-message-media] Storage upload hatası:", uploadErr.message);
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
    console.error("[upload-message-media] Beklenmeyen hata:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Sunucu hatası" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
