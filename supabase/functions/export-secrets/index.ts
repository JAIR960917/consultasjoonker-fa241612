import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SECRET_NAMES = [
  "SERASA_CLIENT_ID",
  "SERASA_CLIENT_SECRET",
  "SERASA_ENV",
  "SERASA_RETAILER_CNPJ",
  "ASSERTIVA_CLIENT_ID",
  "ASSERTIVA_CLIENT_SECRET",
  "ASSERTIVA_CLIENT_ID_OTICA_JOONKER_SOLEDADE",
  "ASSERTIVA_CLIENT_SECRET_OTICA_JOONKER_SOLEDADE",
  "ASSERTIVA_AUTH_TOKEN_soledade",
  "ZAPSIGN_API_TOKEN",
  "ZAPSIGN_TEMPLATE_ID",
  "ZAPSIGN_ENV",
  "ZAPSIGN_WEBHOOK_SECRET",
  "CORA_CLIENT_ID",
  "CORA_CERTIFICATE",
  "CORA_PRIVATE_KEY",
  "CORA_CLIENT_ID_OTICA_JOONKER_SOLEDADE",
  "CORA_CERTIFICATE_OTICA_JOONKER_SOLEDADE",
  "CORA_PRIVATE_KEY_OTICA_JOONKER_SOLEDADE",
  "APIFULL_TOKEN",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    const isDev = roles?.some((r: { role: string }) => r.role === "desenvolvedor");
    if (!isDev) return json({ error: "Forbidden" }, 403);

    const secrets: Record<string, string | null> = {};
    for (const name of SECRET_NAMES) {
      secrets[name] = Deno.env.get(name) ?? null;
    }

    return json({ secrets });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
