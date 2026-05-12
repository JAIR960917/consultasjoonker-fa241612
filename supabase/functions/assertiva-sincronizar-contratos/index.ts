import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = "https://api.assertivasolucoes.com.br";

async function getToken() {
  const id = Deno.env.get("ASSERTIVA_CLIENT_ID");
  const secret = Deno.env.get("ASSERTIVA_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Credenciais Assertiva não configuradas");
  const r = await fetch(`${BASE}/oauth2/v3/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`OAuth ${r.status}: ${txt}`);
  return JSON.parse(txt).access_token as string;
}

async function filtrar(token: string, index: number, size: number) {
  const url = `${BASE}/autentica-assinaturas/v1/envelopes/filtrar?status=finalizado&index=${index}&size=${size}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Filtrar ${r.status}: ${txt.substring(0, 300)}`);
  return JSON.parse(txt);
}

async function obterEnvelope(token: string, envelopeId: string) {
  const r = await fetch(`${BASE}/autentica-assinaturas/v1/envelopes/${envelopeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Obter ${envelopeId} ${r.status}: ${txt.substring(0, 200)}`);
  return JSON.parse(txt);
}

async function linksAssinados(token: string, envelopeId: string) {
  const r = await fetch(
    `${BASE}/autentica-assinaturas/v1/envelopes/${envelopeId}/links-documentos-assinados`,
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

    let index = 0;
    const size = 50;
    let importados = 0, ignorados = 0;
    const erros: string[] = [];
    const maxPaginas = 100;

    for (let p = 0; p < maxPaginas; p++) {
      const resp = await filtrar(token, index, size);
      const envelopes: any[] = resp?.data?.envelopes ?? [];
      if (!envelopes.length) break;

      for (const env of envelopes) {
        const envelopeId = String(env.envelope ?? "");
        if (!envelopeId) continue;

        const { data: existing } = await supa
          .from("contratos_assertiva")
          .select("id")
          .eq("envelope_id", envelopeId)
          .maybeSingle();
        if (existing) { ignorados++; continue; }

        let nome: string | null = env.nome ?? null;
        let cpf: string | null = null;

        try {
          const det = await obterEnvelope(token, envelopeId);
          const sig = det?.data?.signatarios?.[0];
          if (sig) {
            nome = sig.nome ?? nome;
            cpf = (sig.documento ?? "").replace(/\D/g, "") || null;
          }
        } catch (e) {
          erros.push(`detalhe ${envelopeId}: ${(e as Error).message}`);
          const sig = env.signatarios?.[0];
          if (sig?.documento) cpf = String(sig.documento).replace(/\D/g, "") || null;
        }

        let pdfPath: string | null = null;
        try {
          const links = await linksAssinados(token, envelopeId);
          const url = links?.data?.links?.[0]?.url;
          if (url) {
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
          erros.push(`pdf ${envelopeId}: ${(e as Error).message}`);
        }

        await supa.from("contratos_assertiva").insert({
          envelope_id: envelopeId,
          nome,
          cpf,
          status: env.status ?? "finalizado",
          data_assinatura: env.dataHora ?? null,
          pdf_path: pdfPath,
          raw: env,
        });
        importados++;
      }

      if (envelopes.length < size) break;
      index += size;
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
