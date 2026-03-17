// Valoria Hotel - Admin panelden çalışan oluşturma (Yöntem 1)
// Auth kullanıcısı + staff satırı oluşturur. Çağıranın admin olduğu kontrol edilir.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAFF_ROLES = ["admin", "reception_chief", "receptionist", "housekeeping", "technical", "security"] as const;

type CreateStaffBody = {
  email: string;
  password: string;
  full_name: string;
  role: string;
  access_token?: string | null;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  id_number?: string | null;
  address?: string | null;
  hire_date?: string | null;
  personnel_no?: string | null;
  salary?: number | null;
  sgk_no?: string | null;
  profile_image?: string | null;
  app_permissions?: Record<string, boolean> | null;
  work_days?: number[] | null;
  shift_type?: string | null;
  notes?: string | null;
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

  let body: CreateStaffBody;
  try {
    body = (await req.json()) as CreateStaffBody;
  } catch {
    return new Response(JSON.stringify({ error: "Geçersiz JSON" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  const tokenFromHeader = authHeader?.replace(/^Bearer\s+/i, "").trim();
  const token = tokenFromHeader || (body.access_token && String(body.access_token).trim()) || null;
  if (!token) {
    return new Response(JSON.stringify({ error: "Yetkisiz: Token gönderilmedi" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const bearerHeader = tokenFromHeader && authHeader?.startsWith("Bearer ") ? authHeader : `Bearer ${token}`;

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
    global: { headers: { Authorization: bearerHeader } },
  });
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    const msg = userError?.message ?? "Geçersiz veya süresi dolmuş oturum. Lütfen tekrar giriş yapın.";
    return new Response(JSON.stringify({ error: msg }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const runCallerQuery = () =>
    supabaseAdmin
      .from("staff")
      .select("id, role")
      .eq("auth_id", user.id)
      .eq("is_active", true)
      .single();

  let result = await runCallerQuery();
  if (result.error && /PGRST00[0-3]|connection|timeout/i.test(result.error.message || "")) {
    await new Promise((r) => setTimeout(r, 1500));
    result = await runCallerQuery();
  }

  const { data: caller, error: callerError } = result;
  if (callerError) {
    const msg = callerError.message || "Veritabanı hatası";
    const isConnectionError = /PGRST00[0-3]|connection|timeout/i.test(msg);
    return new Response(
      JSON.stringify({
        error: isConnectionError
          ? "Veritabanı bağlantı hatası. Lütfen kısa süre sonra tekrar deneyin."
          : "Yetki kontrolü başarısız: " + msg,
      }),
      {
        status: isConnectionError ? 503 : 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  }
  if (!caller || caller.role !== "admin") {
    return new Response(JSON.stringify({ error: "Sadece admin çalışan ekleyebilir" }), {
      status: 403,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      email,
      password,
      full_name,
      role,
      department,
      position,
      phone,
      birth_date,
      id_number,
      address,
      hire_date,
      personnel_no,
      salary,
      sgk_no,
      profile_image,
      app_permissions,
      work_days,
      shift_type,
      notes,
    } = body;

    if (!email?.trim() || !password || !full_name?.trim()) {
      return new Response(
        JSON.stringify({ error: "email, password ve full_name gerekli" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    if (!STAFF_ROLES.includes(role as typeof STAFF_ROLES[number])) {
      return new Response(
        JSON.stringify({ error: "Geçersiz role" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    });
    if (createError) {
      const msg = createError.message.includes("already been registered") || createError.message.includes("already exists")
        ? "Bu e-posta adresi zaten kayıtlı."
        : createError.message;
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: "Kullanıcı oluşturulamadı" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const { error: insertError } = await supabaseAdmin.from("staff").insert({
      auth_id: newUser.user.id,
      email: newUser.user.email!,
      full_name: full_name.trim(),
      role,
      department: department?.trim() || null,
      position: position?.trim() || null,
      phone: phone?.trim() || null,
      birth_date: birth_date || null,
      id_number: id_number?.trim() || null,
      address: address?.trim() || null,
      hire_date: hire_date || null,
      personnel_no: personnel_no?.trim() || null,
      salary: salary ?? null,
      sgk_no: sgk_no?.trim() || null,
      profile_image: profile_image?.trim() || null,
      app_permissions: app_permissions ?? {},
      work_days: work_days ?? [1, 2, 3, 4, 5],
      shift_type: shift_type?.trim() || null,
      notes: notes?.trim() || null,
      is_active: true,
    });
    if (insertError) {
      const imsg = insertError.message || "";
      const isConn = /PGRST00[0-3]|connection|timeout/i.test(imsg);
      return new Response(
        JSON.stringify({
          error: isConn
            ? "Veritabanı bağlantı hatası. Lütfen kısa süre sonra tekrar deneyin."
            : "Staff kaydı eklenemedi: " + imsg,
        }),
        {
          status: isConn ? 503 : 500,
          headers: { ...CORS, "Content-Type": "application/json" },
        }
      );
    }

    const { data: inserted } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("auth_id", newUser.user.id)
      .single();

    return new Response(
      JSON.stringify({ staff_id: inserted?.id, email: newUser.user.email }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Sunucu hatası" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
