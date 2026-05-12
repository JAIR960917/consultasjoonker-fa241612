import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ASSERTIVA_BASE = "https://api.assertivasolucoes.com.br";

async function getToken() {
  const id = Deno.env.get("ASSERTIVA_CLIENT_ID");
  const secret = Deno.env.get("ASSERTIVA_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Credenciais Assertiva não configuradas");
  const basic = btoa(`${id}:${secret}`);
  const r = await fetch(`${ASSERTIVA_BASE}/oauth2/v3/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`OAuth Assertiva ${r.status}: ${txt}`);
  const j = JSON.parse(txt);
  return j.access_token as string;
}

async function filtrarEnvelopes(token: string, pagina: number) {
  const r = await fetch(`${ASSERTIVA_BASE}/autentica-assinaturas/v1/envelopes/filtrar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: ["FINALIZADO"],
      pagina,
      tamanho: 50,
    }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Filtrar ${r.status}: ${txt.substring(0, 300)}`);
  return JSON.parse(txt);
}

async function linksAssinados(token: string, envelopeId: string) {
  const r = await fetch(
    `${ASSERTIVA_BASE}/autentica-assinaturas/v1/envelopes/${envelopeId}/links-documentos-assinados`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const txt = await r.text();
  if (!r.ok) throw new Error(`Links ${envelopeId} ${r.status}: ${txt.substring(0, 200)}`);
  return JSON.parse(txt);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = await getToken();

    let pagina = 1;
    let importados = 0;
    let ignorados = 0;
    let erros: string[] = [];
    const maxPaginas = 50;

    while (pagina <= maxPaginas) {
      const data = await filtrarEnvelopes(token, pagina);
      const envelopes: any[] =
        data?.envelopes ?? data?.content ?? data?.data ?? data?.resposta?.envelopes ?? [];
      if (!envelopes.length) break;

      for (const env of envelopes) {
        const envelopeId = String(env.id ?? env.idEnvelope ?? env.envelope_id);
        if (!envelopeId || envelopeId === "undefined") continue;

        // skip já importados
        const { data: existing } = await supa
          .from("contratos_assertiva")
          .select("id")
          .eq("envelope_id", envelopeId)
          .maybeSingle();
        if (existing) { ignorados++; continue; }

        const signatarios: any[] = env.signatarios ?? env.participantes ?? [];
        const primeiro = signatarios[0] ?? {};
        const nome = primeiro.nome ?? env.nome ?? null;
        const cpf = (primeiro.cpf ?? primeiro.documento ?? "").replace(/\D/g, "") || null;
        const dataAss =
          env.dataFinalizacao ?? env.dataAssinatura ?? env.dataAtualizacao ?? null;

        let pdfPath: string | null = null;
        try {
          const links = await linksAssinados(token, envelopeId);
          const docs: any[] = links?.documentos ?? links?.links ?? links ?? [];
          const url = docs[0]?.url ?? docs[0]?.link ?? docs[0];
          if (typeof url === "string") {
            const pdfRes = await fetch(url);
            if (pdfRes.ok) {
              const buf = new Uint8Array(await pdfRes.arrayBuffer());
              const path = `${envelopeId}.pdf`;
              const up = await supa.storage
                .from("contratos-assertiva")
                .upload(path, buf, { contentType: "application/pdf", upsert: true });
              if (!up.error) pdfPath = path;
            }
          }
        } catch (e) {
          erros.push(`${envelopeId}: ${(e as Error).message}`);
        }

        await supa.from("contratos_assertiva").insert({
          envelope_id: envelopeId,
          nome, cpf,
          status: env.status ?? "FINALIZADO",
          data_assinatura: dataAss,
          pdf_path: pdfPath,
          raw: env,
        });
        importados++;
      }

      if (envelopes.length < 50) break;
      pagina++;
    }

    return new Response(
      JSON.stringify({ ok: true, importados, ignorados, erros: erros.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
