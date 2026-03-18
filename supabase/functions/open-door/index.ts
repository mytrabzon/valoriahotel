// Valoria Hotel - Kapı açma isteği (yetki kontrolü + log). Kilit donanımı API'si ileride bağlanır.
// POST { "door_id": "uuid" } veya { "room_number": "101" }
// Authorization: Bearer <user JWT> (misafir veya personel)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = { door_id?: string; room_number?: string };

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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ success: false, result: "denied", message: "Yetkili değilsiniz." }),
      { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabase = createClient(supabaseUrl, supabaseService);

  const { data: { user } } = await userClient.auth.getUser();
  if (!user?.id) {
    return new Response(
      JSON.stringify({ success: false, result: "denied", message: "Oturum bulunamadı." }),
      { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(
      JSON.stringify({ success: false, result: "denied", message: "Geçersiz istek." }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const doorId = body.door_id?.trim();
  const roomNumber = body.room_number?.trim();
  if (!doorId && !roomNumber) {
    return new Response(
      JSON.stringify({ success: false, result: "denied", message: "door_id veya room_number gerekli." }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // Kapıyı bul
  let door: { id: string; room_id: string | null; name: string } | null = null;
  if (doorId) {
    const { data: d } = await supabase.from("doors").select("id, room_id, name").eq("id", doorId).eq("is_active", true).single();
    door = d as typeof door;
  }
  if (!door && roomNumber) {
    const { data: room } = await supabase.from("rooms").select("id").eq("room_number", roomNumber).single();
    if (room?.id) {
      const { data: d } = await supabase.from("doors").select("id, room_id, name").eq("room_id", (room as { id: string }).id).eq("is_active", true).single();
      door = d as typeof door;
    }
    if (!door) {
      const { data: d } = await supabase.from("doors").select("id, room_id, name").eq("is_active", true).ilike("name", roomNumber).limit(1).single();
      door = d as typeof door;
    }
  }

  if (!door?.id) {
    return new Response(
      JSON.stringify({ success: false, result: "denied", message: "Kapı bulunamadı." }),
      { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const now = new Date().toISOString();

  // Personel mi?
  const { data: staffRow } = await supabase.from("staff").select("id").eq("auth_id", user.id).eq("is_active", true).single();
  if (staffRow) {
    const staffId = (staffRow as { id: string }).id;
    const { data: perm } = await supabase
      .from("staff_door_permissions")
      .select("id")
      .eq("staff_id", staffId)
      .eq("door_id", door.id)
      .or(`valid_until.is.null,valid_until.gte.${now.slice(0, 10)}`)
      .single();
    const { data: cardRows } = await supabase
      .from("access_cards")
      .select("id")
      .eq("staff_id", staffId)
      .eq("is_active", true)
      .lte("valid_from", now)
      .or("valid_until.is.null,valid_until.gte." + now);
    let cardAllowed = false;
    if (cardRows?.length) {
      const cardIds = (cardRows as { id: string }[]).map((c) => c.id);
      const { data: allDoorsCard } = await supabase.from("access_cards").select("id").in("id", cardIds).eq("all_doors", true).limit(1).single();
      if (allDoorsCard) cardAllowed = true;
      if (!cardAllowed) {
        const { data: perms } = await supabase.from("card_door_permissions").select("door_id").in("card_id", cardIds).eq("door_id", door.id);
        if (perms?.length) cardAllowed = true;
      }
    }
    if (perm || cardAllowed) {
      await supabase.from("door_access_logs").insert({
        door_id: door.id,
        staff_id: staffId,
        result: "granted",
        serial_used: "app",
      });
      return new Response(
        JSON.stringify({ success: true, result: "granted", message: "Kapı açıldı.", door_id: door.id }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    await supabase.from("door_access_logs").insert({
      door_id: door.id,
      staff_id: staffId,
      result: "denied",
      denial_reason: "no_permission",
      serial_used: "app",
    });
    return new Response(
      JSON.stringify({ success: false, result: "denied", message: "Bu kapıya yetkiniz yok." }),
      { status: 403, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // Misafir: oda kapısı (guest.room_id = door.room_id) veya access_cards
  const email = (user.email ?? "").toLowerCase().trim();
  let guestRow: { id: string; room_id: string | null; status: string } | null = null;
  const { data: byAuth } = await supabase.from("guests").select("id, room_id, status").eq("auth_user_id", user.id).limit(1).single();
  if (byAuth) guestRow = byAuth as typeof guestRow;
  if (!guestRow && email) {
    const { data: byEmail } = await supabase.from("guests").select("id, room_id, status").ilike("email", email).limit(1).single();
    if (byEmail) guestRow = byEmail as typeof guestRow;
  }
  const guest = guestRow;

  if (!guest) {
    await supabase.from("door_access_logs").insert({
      door_id: door.id,
      result: "denied",
      denial_reason: "guest_not_found",
      serial_used: "app",
    });
    return new Response(
      JSON.stringify({ success: false, result: "denied", message: "Misafir kaydı bulunamadı." }),
      { status: 403, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  if (guest.status !== "checked_in") {
    await supabase.from("door_access_logs").insert({
      door_id: door.id,
      card_id: null,
      result: "denied",
      denial_reason: "not_checked_in",
      serial_used: "app",
    });
    return new Response(
      JSON.stringify({ success: false, result: "denied", message: "Check-in yapılmamış." }),
      { status: 403, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  let allowed = false;
  if (door.room_id && guest.room_id === door.room_id) allowed = true;
  if (!allowed) {
    const { data: cards } = await supabase
      .from("access_cards")
      .select("id, all_doors")
      .eq("guest_id", guest.id)
      .eq("is_active", true)
      .lte("valid_from", now)
      .or("valid_until.is.null,valid_until.gte." + now);
    if (cards?.length) {
      const cardIds = (cards as { id: string; all_doors: boolean }[]).map((c) => c.id);
      if ((cards as { all_doors: boolean }[]).some((c) => c.all_doors)) allowed = true;
      if (!allowed) {
        const { data: perms } = await supabase.from("card_door_permissions").select("door_id").in("card_id", cardIds).eq("door_id", door.id);
        if (perms?.length) allowed = true;
      }
    }
  }

  if (allowed) {
    await supabase.from("door_access_logs").insert({
      door_id: door.id,
      card_id: null,
      result: "granted",
      serial_used: "app",
    });
    return new Response(
      JSON.stringify({ success: true, result: "granted", message: "Kapı açıldı.", door_id: door.id }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  await supabase.from("door_access_logs").insert({
    door_id: door.id,
    result: "denied",
    denial_reason: "no_permission",
    serial_used: "app",
  });
  return new Response(
    JSON.stringify({ success: false, result: "denied", message: "Bu kapıya yetkiniz yok." }),
    { status: 403, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
