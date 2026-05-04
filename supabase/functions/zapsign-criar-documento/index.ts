// Edge Function: zapsign-criar-documento
// Cria um documento na ZapSign a partir do contrato (gera PDF e envia em base64).
// Body: { contrato_id: string; telefone_envio?: string; enviar_whatsapp?: boolean }
//
// Salva em contracts:
//   signature_provider = "zapsign"
//   signature_external_id = doc.token
//   signature_url = signers[0].sign_url
//   signature_data = { doc_token, open_id, signer_token, original_file, signed_file?, ... }
//   status = "aguardando_assinatura"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function zapsignBase() {
  const env = (Deno.env.get("ZAPSIGN_ENV") || "sandbox").toLowerCase();
  return env.startsWith("prod")
    ? "https://api.zapsign.com.br"
    : "https://sandbox.api.zapsign.com.br";
}

interface BodyInput {
  contrato_id: string;
  telefone_envio?: string;
  enviar_whatsapp?: boolean;
  comprovante_base64?: string | null;
  comprovante_filename?: string | null;
  comprovante_mime?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ ok: false, error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = (await req.json().catch(() => ({}))) as Partial<BodyInput>;
    if (!body.contrato_id) return json({ ok: false, error: "contrato_id obrigatório" }, 400);

    const apiToken = Deno.env.get("ZAPSIGN_API_TOKEN");
    if (!apiToken) return json({ ok: false, error: "ZAPSIGN_API_TOKEN não configurado" }, 500);

    // ---------- Carrega contrato ----------
    const { data: contrato, error: contratoErr } = await admin
      .from("contracts")
      .select("id, user_id, nome, cpf, telefone, content, empresa_id, venda_id, status")
      .eq("id", body.contrato_id)
      .maybeSingle();
    if (contratoErr || !contrato) return json({ ok: false, error: "Contrato não encontrado" }, 404);

    if (contrato.user_id !== userId) {
      const { data: roleRow } = await admin
        .from("user_roles").select("role")
        .eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (!roleRow) return json({ ok: false, error: "Sem permissão" }, 403);
    }

    const telefoneParaEnvio = (body.telefone_envio?.trim() || contrato.telefone || "").trim();

    // ---------- Carrega venda + template para PDF ----------
    let vendaInfo: { valor_total: number; primeiro_vencimento: string | null } | null = null;
    if (contrato.venda_id) {
      const { data: v } = await admin
        .from("vendas")
        .select("valor_total, primeiro_vencimento")
        .eq("id", contrato.venda_id)
        .maybeSingle();
      if (v) vendaInfo = { valor_total: Number(v.valor_total), primeiro_vencimento: v.primeiro_vencimento };
    }
    const { data: tpl } = await admin
      .from("contract_template")
      .select("title")
      .limit(1).maybeSingle();
    const tplTitle = tpl?.title || "Nota Promissória";

    // ---------- Gera PDF ----------
    const vencimentoFmt = vendaInfo?.primeiro_vencimento ? formatDateBR(vendaInfo.primeiro_vencimento) : null;
    const valorFmt = vendaInfo?.valor_total != null ? formatBRL(vendaInfo.valor_total) : null;
    const pdfBytes = buildPdf({
      title: tplTitle,
      content: contrato.content,
      vencimento: vencimentoFmt,
      valorTotal: valorFmt,
      numero: "Nº 1 DE 1",
    });
    const pdfBase64 = bytesToBase64(pdfBytes);

    // ---------- Telefone formatado ----------
    const telDigits = telefoneParaEnvio.replace(/\D/g, "");
    // Remove DDI 55 se presente, ZapSign separa em phone_country e phone_number
    const phoneNumber = telDigits.startsWith("55") && telDigits.length > 11
      ? telDigits.slice(2)
      : telDigits;

    // ---------- Cria documento na ZapSign ----------
    const docPayload: Record<string, unknown> = {
      name: `${tplTitle} - ${contrato.nome}`.slice(0, 250),
      base64_pdf: pdfBase64,
      external_id: contrato.id,
      lang: "pt-br",
      disable_signer_emails: true,
      brand_logo: "",
      signers: [
        {
          name: contrato.nome,
          // ZapSign exige email OU phone; usamos phone+blank_email se sem email
          blank_email: true,
          phone_country: "55",
          phone_number: phoneNumber,
          auth_mode: "assinaturaTela",
          send_automatic_email: false,
          send_automatic_whatsapp: !!body.enviar_whatsapp && !!phoneNumber,
          require_selfie_photo: true,
          require_document_photo: true,
          selfie_validation_type: "none",
          qualification: "Emitente",
          external_id: contrato.id,
        },
      ],
    };

    const base = zapsignBase();
    const docResp = await fetch(`${base}/api/v1/docs/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(docPayload),
    });
    const docText = await docResp.text();
    const docJson = safeJson(docText);
    console.info("zapsign create doc status", docResp.status, "body", docText.slice(0, 1500));

    if (!docResp.ok) {
      const errMsg = docJson?.detail || docJson?.message ||
        (Array.isArray(docJson?.errors) ? JSON.stringify(docJson.errors) : null) ||
        `HTTP ${docResp.status}: ${docText.slice(0, 300)}`;
      return json({ ok: false, error: `ZapSign: ${errMsg}`, detail: docJson ?? docText.slice(0, 500) }, 502);
    }

    const docToken: string | null = docJson?.token ?? null;
    const openId: number | null = docJson?.open_id ?? null;
    const signer = Array.isArray(docJson?.signers) ? docJson.signers[0] : null;
    const signerToken: string | null = signer?.token ?? null;
    const signUrl: string | null = signer?.sign_url ?? null;

    if (!docToken || !signUrl) {
      return json({ ok: false, error: "ZapSign não retornou token/sign_url", detail: docJson }, 502);
    }

    // ---------- Anexa comprovante de residência como documento extra (opcional) ----------
    let extraDocResult: { ok: boolean; status?: number; detail?: unknown } | null = null;
    if (body.comprovante_base64 && body.comprovante_filename) {
      try {
        const mime = (body.comprovante_mime || "").toLowerCase();
        let extraBase64 = body.comprovante_base64;
        let extraFilename = body.comprovante_filename;

        if (mime.startsWith("image/")) {
          const imgFmt = mime.includes("png") ? "PNG" : "JPEG";
          const pdfDoc = new jsPDF({ unit: "pt", format: "a4" });
          const pageW = pdfDoc.internal.pageSize.getWidth();
          const pageH = pdfDoc.internal.pageSize.getHeight();
          const margin = 30;
          const maxW = pageW - margin * 2;
          const maxH = pageH - margin * 2 - 30;
          pdfDoc.setFont("helvetica", "bold");
          pdfDoc.setFontSize(12);
          pdfDoc.text("Comprovante de residência", pageW / 2, margin, { align: "center" });
          const dataUri = `data:${mime};base64,${body.comprovante_base64}`;
          pdfDoc.addImage(dataUri, imgFmt, margin, margin + 20, maxW, maxH, undefined, "FAST");
          const pdfBytes = new Uint8Array(pdfDoc.output("arraybuffer"));
          extraBase64 = bytesToBase64(pdfBytes);
          extraFilename = extraFilename.replace(/\.[^.]+$/, "") + ".pdf";
        }

        const extraResp = await fetch(`${base}/api/v1/docs/${docToken}/upload-extra-doc/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: `Comprovante de residência - ${contrato.nome}`.slice(0, 250),
            base64_pdf: extraBase64,
          }),
        });
        const extraText = await extraResp.text();
        const extraJson = safeJson(extraText);
        console.info("zapsign upload-extra-doc status", extraResp.status, "body", extraText.slice(0, 600));
        extraDocResult = { ok: extraResp.ok, status: extraResp.status, detail: extraJson ?? extraText.slice(0, 500) };
      } catch (e) {
        console.error("zapsign extra doc error", e);
        extraDocResult = { ok: false, detail: e instanceof Error ? e.message : String(e) };
      }
    }

    await admin.from("contracts").update({
      signature_provider: "zapsign",
      signature_external_id: docToken,
      signature_url: signUrl,
      signature_data: {
        doc_token: docToken,
        open_id: openId,
        signer_token: signerToken,
        original_file: docJson?.original_file ?? null,
        signed_file: docJson?.signed_file ?? null,
        env: (Deno.env.get("ZAPSIGN_ENV") || "sandbox"),
        raw: docJson,
        extra_doc: extraDocResult,
      },
      status: "aguardando_assinatura",
    }).eq("id", contrato.id);

    return json({
      ok: true,
      message: "Documento criado na ZapSign com sucesso",
      doc_token: docToken,
      open_id: openId,
      signer_token: signerToken,
      signature_url: signUrl,
      extra_doc: extraDocResult,
    });
  } catch (err) {
    console.error("zapsign-criar-documento error", err);
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function safeJson(text: string): any { try { return JSON.parse(text); } catch { return null; } }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

interface PdfArgs {
  title: string;
  content: string;
  vencimento: string | null;
  valorTotal: string | null;
  numero: string;
}

function buildPdf(d: PdfArgs): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableWidth = pageWidth - margin * 2;

  doc.setTextColor(0, 0, 0);
  const titleText = d.title.toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const titleWidth = doc.getTextWidth(titleText);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const numWidth = doc.getTextWidth(d.numero);
  const gap = 8;
  const groupWidth = titleWidth + gap + numWidth;
  const groupStart = (pageWidth - groupWidth) / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(titleText, groupStart, margin + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(d.numero, groupStart + titleWidth + gap, margin + 2);

  if (d.vencimento || d.valorTotal) {
    doc.setFontSize(9);
    const rightX = pageWidth - margin;
    let ry = margin - 4;
    if (d.vencimento) {
      doc.setFont("helvetica", "normal");
      doc.text(`Vencimento: `, rightX - doc.getTextWidth(d.vencimento) - 4, ry, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(d.vencimento, rightX, ry, { align: "right" });
      ry += 12;
    }
    if (d.valorTotal) {
      doc.setFont("helvetica", "normal");
      doc.text(`Valor: `, rightX - doc.getTextWidth(d.valorTotal) - 4, ry, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(d.valorTotal, rightX, ry, { align: "right" });
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  let y = margin + 50;
  const lineHeight = 16;

  for (const rawLine of d.content.split("\n")) {
    const paragraph = rawLine.trim();
    if (!paragraph) { y += 8; continue; }
    const lines = doc.splitTextToSize(paragraph, usableWidth);
    for (const line of lines) {
      if (y > pageHeight - margin - 120) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 6;
  }

  if (y > pageHeight - 140) { doc.addPage(); y = margin; }
  y += 50;
  const sigWidth = 280;
  const sigX = (pageWidth - sigWidth) / 2;
  doc.setDrawColor(0);
  doc.setLineWidth(0.6);
  doc.line(sigX, y, sigX + sigWidth, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Assinatura do emitente", pageWidth / 2, y + 14, { align: "center" });

  return new Uint8Array(doc.output("arraybuffer"));
}
