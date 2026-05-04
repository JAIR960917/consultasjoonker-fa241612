import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, ExternalLink, KeyRound, Webhook, ShieldCheck } from "lucide-react";

export function ZapsignTab() {
  const [env] = useState<string>(
    (import.meta.env.VITE_ZAPSIGN_ENV as string) || "sandbox",
  );
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapsign-webhook`;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="grid gap-6">
      <Card className="shadow-card">
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Integração ZapSign
            </h2>
            <p className="text-sm text-muted-foreground">
              Provedor de assinatura eletrônica das notas promissórias. As credenciais ficam armazenadas como
              secrets do backend e podem ser editadas no painel do Lovable Cloud.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">Secrets configurados</p>
            <SecretRow name="ZAPSIGN_API_TOKEN" hint="Token gerado no painel ZapSign (Configurações → Integrações → API ZapSign)" onCopy={() => copy("ZAPSIGN_API_TOKEN", "Nome do secret")} />
            <SecretRow name="ZAPSIGN_ENV" hint='Use "sandbox" para testes (sem cobrança) ou "production" para o ambiente real' onCopy={() => copy("ZAPSIGN_ENV", "Nome do secret")} />
            <SecretRow name="ZAPSIGN_WEBHOOK_SECRET" hint="String aleatória usada para validar webhooks (header x-zapsign-secret)" onCopy={() => copy("ZAPSIGN_WEBHOOK_SECRET", "Nome do secret")} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook
            </h2>
            <p className="text-sm text-muted-foreground">
              Cadastre essa URL no painel da ZapSign em <strong>Configurações → Integrações → API ZapSign → Webhooks</strong> para
              receber automaticamente os eventos de assinatura.
            </p>
          </div>

          <div className="space-y-2">
            <Label>URL do webhook</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(webhookUrl, "URL")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Header de validação (opcional, recomendado)</Label>
            <div className="flex gap-2">
              <Input value="x-zapsign-secret" readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy("x-zapsign-secret", "Nome do header")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cadastre o valor exato do secret <code>ZAPSIGN_WEBHOOK_SECRET</code> nesse header ao criar o webhook na ZapSign.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
            <p className="font-medium">Eventos a marcar:</p>
            <ul className="list-disc pl-4 text-muted-foreground">
              <li><code>doc_signed</code> — promissória assinada (marca contrato como assinado)</li>
              <li><code>doc_refused</code> — assinatura recusada</li>
              <li><code>doc_created</code> — opcional, apenas registro</li>
            </ul>
          </div>

          <Button asChild variant="outline">
            <a
              href={env.startsWith("prod")
                ? "https://app.zapsign.com.br/conta/configuracoes/integration?tab=api-zapsign"
                : "https://sandbox.app.zapsign.com.br/conta/configuracoes/integration?tab=api-zapsign"}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir painel ZapSign ({env})
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-6 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Como o cliente assina
          </h2>
          <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
            <li>Vendedor clica em <strong>Assinar contrato</strong> na tela do contrato.</li>
            <li>O sistema gera o PDF da promissória e envia para a ZapSign.</li>
            <li>É exibido um <strong>QR Code + link</strong> (para assinar na hora) e o link também é enviado por <strong>WhatsApp</strong>.</li>
            <li>O cliente assina na tela e tira uma <strong>selfie</strong> obrigatória.</li>
            <li>Quando assinado, o webhook da ZapSign atualiza o contrato e o PDF assinado fica disponível para download.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function SecretRow({ name, hint, onCopy }: { name: string; hint?: string; onCopy: () => void }) {
  return (
    <div className="rounded border bg-card px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <code className="text-xs sm:text-sm break-all">{name}</code>
        <Button variant="ghost" size="sm" onClick={onCopy}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
