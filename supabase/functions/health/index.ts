// Valoria Hotel - Edge Function: health check
Deno.serve((_req: Request) => {
  return new Response(
    JSON.stringify({ ok: true, service: "valoria-hotel", ts: new Date().toISOString() }),
    { headers: { "Content-Type": "application/json" }, status: 200 }
  );
});
