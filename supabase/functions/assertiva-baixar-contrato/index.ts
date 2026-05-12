import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { path, filename: requested } = await req.json();
    if (!path) throw new Error("path obrigatório");
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const fallback = path.split("/").pop() ?? "contrato.pdf";
    const filename = String(requested || fallback).replace(/[^\w.\-]/g, "_");
    const { data, error } = await supa.storage
      .from("contratos-assertiva")
      .createSignedUrl(path, 300, { download: filename });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, url: data.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
