/**
 * Mobil → Supabase Edge → Hetzner KBS gateway (tek dış KBS çıkışı).
 * Jandarma/KBS’ye doğrudan bağlanmaz; yalnızca VPS’teki Node gateway’e forward eder.
 *
 * Secrets (Dashboard → Edge Functions → Secrets):
 * - KBS_GATEWAY_URL = http://178.104.12.20:4000 (sonunda / yok, boşluk yok)
 * - KBS_GATEWAY_TOKEN = VPS’teki KBS_GATEWAY_TOKEN ile aynı (ops-proxy istek başlığında gider)
 *
 * Geriye dönük: OPS_VPS_URL hâlâ okunur (KBS_GATEWAY_URL yoksa).
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-kbs-gateway-token",
};

type ProxyBody = {
  method?: string;
  path?: string;
  payload?: unknown;
};

function gatewayBase(): string {
  const raw =
    (Deno.env.get("KBS_GATEWAY_URL") ?? Deno.env.get("OPS_VPS_URL") ?? "").trim();
  return raw.replace(/\/$/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const vpsBase = gatewayBase();
  if (!vpsBase) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "CONFIG",
          message:
            "KBS_GATEWAY_URL is not set (Hetzner KBS gateway base URL). Legacy OPS_VPS_URL is also empty.",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Upstream-Status": "0" } }
    );
  }

  try {
    const meta = (await req.json().catch(() => ({}))) as ProxyBody;
    const method = (meta.method ?? "POST").toUpperCase();
    // Boşluk / satır sonu path’ten sızarsa (ör. JSON kopya hatası) geçerli URL üretmek için temizle
    const path =
      typeof meta.path === "string" ? meta.path.replace(/[\s\u00a0]+/g, "") : "/";
    if (!path.startsWith("/")) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "BAD_REQUEST", message: "path must start with /" } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Upstream-Status": "0" } }
      );
    }

    const auth = req.headers.get("Authorization") ?? "";
    const url = `${vpsBase}${path}`;
    const gatewayToken = (Deno.env.get("KBS_GATEWAY_TOKEN") ?? "").trim();

    const headers: Record<string, string> = {
      Authorization: auth,
      "Content-Type": "application/json",
    };
    if (gatewayToken) {
      headers["x-kbs-gateway-token"] = gatewayToken;
    }

    const upstream = await fetch(url, {
      method: method === "GET" ? "GET" : "POST",
      headers,
      body: method === "GET" ? undefined : JSON.stringify(meta.payload ?? {}),
    });

    const text = await upstream.text();
    const ct = upstream.headers.get("content-type") ?? "application/json";
    return new Response(text, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": ct,
        "X-Upstream-Status": String(upstream.status),
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: "PROXY_ERROR", message: e instanceof Error ? e.message : String(e) },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Upstream-Status": "0" } }
    );
  }
});
