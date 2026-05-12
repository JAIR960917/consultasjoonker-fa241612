import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

function extractFolderId(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  const m1 = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
  return null;
}

function parseNomeCpf(filename: string): { nome: string | null; cpf: string | null } {
  const base = filename.replace(/\.pdf$/i, "").trim();
  // Pega o PRIMEIRO CPF que aparecer no nome do arquivo (com ou sem máscara).
  // Aceita formatos: 000.000.000-00, 00000000000, 000 000 000 00 etc.
  const cpfMatch = base.match(/(\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d{2})/);
  const cpf = cpfMatch ? cpfMatch[1].replace(/\D/g, "") : null;

  // Tenta extrair nome no padrão "NOME - CPF" (nome antes do primeiro CPF).
  let nome: string | null = null;
  if (cpfMatch) {
    const antes = base.slice(0, cpfMatch.index!).replace(/[-–_\s]+$/, "").trim();
    if (antes && !/^\d+$/.test(antes.replace(/\D/g, ""))) {
      nome = antes;
    } else {
      // Sem nome real no arquivo — usa o próprio nome do arquivo como referência.
      nome = base || null;
    }
  } else {
    nome = base || null;
  }

  return { nome, cpf: cpf && cpf.length === 11 ? cpf : null };
}

async function gdriveFetch(path: string, init: RequestInit = {}) {
  const LK = Deno.env.get("LOVABLE_API_KEY");
  const GK = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!LK) throw new Error("LOVABLE_API_KEY não configurada");
  if (!GK) throw new Error("GOOGLE_DRIVE_API_KEY não configurada");
  const r = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LK}`,
      "X-Connection-Api-Key": GK,
      ...(init.headers ?? {}),
    },
  });
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const folderId = extractFolderId(String(body.folder ?? ""));
    if (!folderId) throw new Error("Informe a URL ou ID da pasta do Google Drive");
    const pageToken: string | undefined = body.pageToken || undefined;
    const maxFiles: number = Math.min(Number(body.maxFiles) || 20, 30);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let importados = 0, ignorados = 0;
    const erros: string[] = [];
    const startedAt = Date.now();
    const TIME_BUDGET_MS = 60_000;

    let nextPageToken: string | undefined = pageToken;
    let processed = 0;
    let done = false;

    outer: while (true) {
      const q = encodeURIComponent(
        `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
      );
      const fields = encodeURIComponent("nextPageToken,files(id,name,modifiedTime,createdTime)");
      const url = `/files?q=${q}&fields=${fields}&pageSize=100${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`;
      const r = await gdriveFetch(url);
      const txt = await r.text();
      if (!r.ok) throw new Error(`Drive list ${r.status}: ${txt.substring(0, 300)}`);
      const data = JSON.parse(txt);
      const files: any[] = data.files ?? [];
      nextPageToken = data.nextPageToken;

      // Filtra os já importados em UMA query (em vez de uma por arquivo)
      const ids = files.map((f) => `gdrive:${f.id}`);
      const { data: existentes } = await supa
        .from("contratos_assertiva")
        .select("envelope_id")
        .in("envelope_id", ids);
      const jaTem = new Set((existentes ?? []).map((e: any) => e.envelope_id));

      const pendentes = files.filter((f) => {
        if (jaTem.has(`gdrive:${f.id}`)) { ignorados++; return false; }
        return true;
      });

      const CONCURRENCY = 3;
      for (let i = 0; i < pendentes.length; i += CONCURRENCY) {
        if (processed >= maxFiles || Date.now() - startedAt > TIME_BUDGET_MS) break outer;
        const chunk = pendentes.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(async (f) => {
          const { nome, cpf } = parseNomeCpf(f.name ?? "");
          try {
            const dl = await gdriveFetch(`/files/${f.id}?alt=media`);
            if (!dl.ok) throw new Error(`download ${dl.status}`);
            const buf = new Uint8Array(await dl.arrayBuffer());
            const path = `gdrive/${f.id}.pdf`;
            const up = await supa.storage
              .from("contratos-assertiva")
              .upload(path, buf, { contentType: "application/pdf", upsert: true });
            if (up.error) throw new Error(up.error.message);
            await supa.from("contratos_assertiva").insert({
              envelope_id: `gdrive:${f.id}`,
              nome, cpf,
              status: "gdrive",
              data_assinatura: f.modifiedTime ?? f.createdTime ?? null,
              pdf_path: path,
              raw: { source: "gdrive", file: f },
            });
            importados++;
            processed++;
          } catch (e) {
            erros.push(`${f.name}: ${(e as Error).message}`);
          }
        }));
      }

      if (!nextPageToken) { done = true; break; }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        importados,
        ignorados,
        erros: erros.slice(0, 20),
        nextPageToken: done ? null : nextPageToken,
        done,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
