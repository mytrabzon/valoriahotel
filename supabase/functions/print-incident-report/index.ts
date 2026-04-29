import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IncidentRecord = {
  id: string;
  organization_id?: string | null;
  report_no?: string | null;
  pdf_file_path?: string | null;
};

type PrinterSettings = {
  enabled: boolean;
  email: string;
};

function normalizeFrom(raw: string): string {
  const cleaned = raw.replace(/[\r\n]+/g, "").trim();
  const isValid = cleaned.includes("@") && cleaned.includes("<") && cleaned.includes(">");
  return isValid ? cleaned : "Valoria <noreply@localhost>";
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function resolvePrinterSettings(
  supabase: ReturnType<typeof createClient>,
): Promise<PrinterSettings> {
  let { data, error } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "printer")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error?.code === "42P01" || error?.code === "PGRST205" || error?.status === 404) {
    const fallback = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "printer")
      .order("updated_at", { ascending: false })
      .limit(1);
    data = fallback.data as typeof data;
    error = fallback.error as typeof error;
  }

  if (error) throw new Error(`Printer ayarlari okunamadi: ${error.message}`);
  const value = (data?.[0]?.value ?? {}) as Partial<PrinterSettings>;
  return {
    enabled: value.enabled !== false,
    email: String(value.email ?? "536w8897jy@hpeprint.com").trim(),
  };
}

async function sendPrinterMail(opts: {
  to: string;
  subject: string;
  fileName: string;
  contentBase64: string;
}) {
  const smtpHost = (Deno.env.get("SMTP_HOST") ?? "").trim();
  const smtpPortRaw = (Deno.env.get("SMTP_PORT") ?? "").trim();
  const smtpUser = (Deno.env.get("SMTP_USER") ?? "").trim();
  const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
  const smtpFrom = normalizeFrom(Deno.env.get("SMTP_FROM_EMAIL") ?? Deno.env.get("PRINTER_FROM_EMAIL") ?? "");

  if (!smtpHost || !smtpPortRaw || !smtpUser || !smtpPass) {
    throw new Error("SMTP secrets eksik: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS");
  }
  const smtpPort = Number(smtpPortRaw);
  if (!Number.isFinite(smtpPort) || smtpPort <= 0) throw new Error("SMTP_PORT sayisal olmali");

  const secureRaw = (Deno.env.get("SMTP_SECURE") ?? "").trim().toLowerCase();
  const smtpSecure = secureRaw ? ["1", "true", "yes", "on"].includes(secureRaw) : smtpPort === 465;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: opts.to,
    subject: opts.subject,
    html: "<p>Tutanak PDF dosyasi ektedir.</p>",
    attachments: [
      {
        filename: opts.fileName,
        content: opts.contentBase64,
        encoding: "base64",
      },
    ],
  });
}

async function logPrintResult(
  supabase: ReturnType<typeof createClient>,
  reportId: string,
  status: "success" | "failed" | "skipped",
  errorMessage?: string,
) {
  await supabase.from("incident_report_print_logs").insert({
    report_id: reportId,
    status,
    error_message: errorMessage ?? null,
  });
}

async function logAuditEvent(
  supabase: ReturnType<typeof createClient>,
  reportId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const { data: report } = await supabase
    .from("incident_reports")
    .select("organization_id")
    .eq("id", reportId)
    .maybeSingle();

  if (!report?.organization_id) return;
  await supabase.from("incident_report_audit_log").insert({
    organization_id: report.organization_id,
    report_id: reportId,
    event_type: eventType,
    event_payload: payload,
    actor_staff_id: null,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: { message: "Method not allowed" } }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const record = (body?.record ?? body) as IncidentRecord;
    const reportId = String(record?.id ?? "").trim();
    if (!reportId) throw new Error("record.id bulunamadi");

    const reportNo = String(record?.report_no ?? "").trim() || reportId;

    const reportRes = await supabase
      .from("incident_reports")
      .select("id, report_no, pdf_file_path")
      .eq("id", reportId)
      .maybeSingle();

    if (reportRes.error || !reportRes.data) {
      throw new Error(reportRes.error?.message ?? "Tutanak bulunamadi");
    }

    const pdfPath = String(reportRes.data.pdf_file_path ?? record?.pdf_file_path ?? "").trim();
    if (!pdfPath) throw new Error("pdf_file_path bulunamadi");

    const printer = await resolvePrinterSettings(supabase);
    if (!printer.enabled) {
      await logPrintResult(supabase, reportId, "skipped", "Yazdirma ayari kapali");
      await logAuditEvent(supabase, reportId, "printer_email_skipped", { reason: "printer_disabled" });
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const downloadRes = await supabase.storage.from("incident-reports").download(pdfPath);
    if (downloadRes.error || !downloadRes.data) {
      throw new Error(downloadRes.error?.message ?? "PDF storage dosyasi indirilemedi");
    }
    const bytes = new Uint8Array(await downloadRes.data.arrayBuffer());
    const contentBase64 = toBase64(bytes);

    const subject = `Valoria Tutanak - ${reportRes.data.report_no ?? reportNo}`;
    const fileName = `TUTANAK-${(reportRes.data.report_no ?? reportNo).replaceAll("/", "-")}.pdf`;
    await sendPrinterMail({
      to: printer.email,
      subject,
      fileName,
      contentBase64,
    });

    await logPrintResult(supabase, reportId, "success");
    await logAuditEvent(supabase, reportId, "printer_email_sent", {
      to: printer.email,
      file_name: fileName,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      const body = await req.clone().json().catch(() => ({}));
      const record = (body?.record ?? body) as IncidentRecord;
      const reportId = String(record?.id ?? "").trim();
      if (reportId) {
        await logPrintResult(supabase, reportId, "failed", message);
        await logAuditEvent(supabase, reportId, "printer_email_failed", { error: message });
      }
    } catch {
      // no-op
    }

    return new Response(JSON.stringify({ ok: false, error: { message } }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
