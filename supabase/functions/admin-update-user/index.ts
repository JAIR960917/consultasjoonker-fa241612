// Atualiza dados de um usuário (apenas admin)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: callerRoles } = await userClient
      .from("user_roles").select("role").eq("user_id", u.user.id);
    const isDev = !!callerRoles?.some((r) => r.role === "desenvolvedor");
    const isAdmin = !!callerRoles?.some((r) => r.role === "admin");
    if (!isAdmin && !isDev) return new Response(JSON.stringify({ error: "Apenas admin ou desenvolvedor" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const target_user_id = String(body.user_id || "");
    if (!target_user_id) return new Response(JSON.stringify({ error: "user_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (target_user_id === u.user.id) return new Response(JSON.stringify({ error: "Não é possível editar o próprio papel/empresa" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const cidade = String(body.cidade ?? "").trim();
    const empresa_id = body.empresa_id ? String(body.empresa_id) : null;
    const role = body.role === "admin" ? "admin" : body.role === "desenvolvedor" ? "desenvolvedor" : "gerente";

    if (role === "gerente" && !empresa_id) {
      return new Response(JSON.stringify({ error: "Gerente precisa estar vinculado a uma empresa" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (role === "desenvolvedor" && !isDev) {
      const { count } = await userClient
        .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "desenvolvedor");
      if ((count ?? 0) > 0) {
        return new Response(JSON.stringify({ error: "Já existe um desenvolvedor cadastrado. Apenas ele pode promover outro." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    // Apenas desenvolvedor pode editar/rebaixar outro desenvolvedor
    {
      const { data: targetRoles } = await userClient
        .from("user_roles").select("role").eq("user_id", target_user_id);
      const targetIsDev = !!targetRoles?.some((r) => r.role === "desenvolvedor");
      if (targetIsDev && !isDev) {
        return new Response(JSON.stringify({ error: "Apenas um desenvolvedor pode editar outro desenvolvedor" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await adminClient.from("profiles").update({ cidade, empresa_id }).eq("user_id", target_user_id);
    await adminClient.from("user_roles").delete().eq("user_id", target_user_id);
    await adminClient.from("user_roles").insert({ user_id: target_user_id, role });

    const newPassword = typeof body.password === "string" ? body.password : "";
    if (newPassword) {
      if (newPassword.length < 6) {
        return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 6 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error: pErr } = await adminClient.auth.admin.updateUserById(target_user_id, { password: newPassword });
      if (pErr) throw pErr;
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
