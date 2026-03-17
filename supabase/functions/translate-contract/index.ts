// Valoria Hotel - Türkçe sözleşme metnini diğer dillere çevirir (MyMemory API, API key gerekmez)
// Kullanım: POST { "sourceTitle": "...", "sourceContent": "..." }
// Döner: { "translations": { "en": { "title", "content" }, "ar": {...}, ... } }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGET_LANGS = ["en", "ar", "de", "fr", "ru", "es"] as const;
const LANGPAIR: Record<string, string> = {
  en: "tr|en",
  ar: "tr|ar",
  de: "tr|de",
  fr: "tr|fr",
  ru: "tr|ru",
  es: "tr|es",
};

const CHUNK_SIZE = 450;

function chunkText(text: string): string[] {
  if (!text?.trim()) return [];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    if (rest.length <= CHUNK_SIZE) {
      parts.push(rest);
      break;
    }
    const slice = rest.slice(0, CHUNK_SIZE);
    const lastBreak = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf("\n"), slice.lastIndexOf(". "));
    const cut = lastBreak > CHUNK_SIZE / 2 ? lastBreak + 1 : CHUNK_SIZE;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return parts.filter(Boolean);
}

async function translateChunk(q: string, langPair: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${langPair}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory ${res.status}`);
  const data = (await res.json()) as { responseData?: { translatedText?: string }; responseStatus?: number };
  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error("Çeviri yanıtı geçersiz");
  }
  return data.responseData.translatedText;
}

async function translateText(sourceText: string, targetLang: string): Promise<string> {
  const langPair = LANGPAIR[targetLang];
  if (!langPair) return sourceText;
  const chunks = chunkText(sourceText);
  if (chunks.length === 0) return "";
  const results = await Promise.all(chunks.map((c) => translateChunk(c, langPair)));
  return results.join("\n\n");
}

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

  try {
    const body = (await req.json()) as { sourceTitle?: string; sourceContent?: string };
    const sourceTitle = (body.sourceTitle ?? "").trim() || "Konaklama Sözleşmesi ve Otel Kuralları";
    const sourceContent = (body.sourceContent ?? "").trim();

    const translations: Record<string, { title: string; content: string }> = {};

    for (const lang of TARGET_LANGS) {
      try {
        const [title, content] = await Promise.all([
          translateText(sourceTitle, lang),
          sourceContent ? translateText(sourceContent, lang) : Promise.resolve(""),
        ]);
        translations[lang] = { title, content };
      } catch (e) {
        console.error(`Translate ${lang} failed`, e);
        translations[lang] = { title: sourceTitle, content: sourceContent };
      }
    }

    return new Response(
      JSON.stringify({ translations }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("translate-contract", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Çeviri hatası" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
