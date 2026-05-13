import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, KeyRound, Copy, Download, Eye, EyeOff } from "lucide-react";

export default function ExportSecrets() {
  const [loading, setLoading] = useState(false);
  const [secrets, setSecrets] = useState<Record<string, string | null> | null>(null);
  const [show, setShow] = useState(false);

  const fetchSecrets = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("export-secrets");
    setLoading(false);
    if (error || data?.error) {
      toast.error("Erro", { description: error?.message || data?.error });
      return;
    }
    setSecrets(data.secrets);
    setShow(true);
  };

  const envText = secrets
    ? Object.entries(secrets)
        .map(([k, v]) => {
          if (v === null) return `# ${k}=`;
          const needsQuotes = v.includes("\n") || v.includes(" ") || v.includes("#");
          const value = needsQuotes ? `"${v.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"` : v;
          return `${k}=${value}`;
        })
        .join("\n")
    : "";

  const masked = secrets
    ? Object.entries(secrets)
        .map(([k, v]) => `${k}=${v ? "•".repeat(Math.min(v.length, 20)) : "(vazio)"}`)
        .join("\n")
    : "";

  const copy = async () => {
    await navigator.clipboard.writeText(envText);
    toast.success(".env copiado");
  };

  const download = () => {
    const blob = new Blob([envText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <KeyRound className="h-7 w-7 text-primary" /> Exportar Secrets
        </h1>
        <p className="text-muted-foreground">
          Exporta as credenciais do Lovable Cloud em formato .env para uso na VPS.
          Acesso restrito a desenvolvedores.
        </p>
      </header>

      <Card className="shadow-card">
        <CardContent className="p-6 space-y-4">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            ⚠️ Os valores exibidos aqui são sensíveis. Não compartilhe esta tela e
            limpe a área de transferência depois de colar no servidor.
          </div>

          {!secrets ? (
            <Button onClick={fetchSecrets} disabled={loading} className="bg-gradient-primary">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Carregar secrets"}
            </Button>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setShow((s) => !s)}>
                  {show ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                  {show ? "Ocultar" : "Mostrar"}
                </Button>
                <Button variant="outline" onClick={copy}>
                  <Copy className="mr-2 h-4 w-4" /> Copiar .env
                </Button>
                <Button variant="outline" onClick={download}>
                  <Download className="mr-2 h-4 w-4" /> Baixar .env
                </Button>
                <Button variant="ghost" onClick={fetchSecrets} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Recarregar"}
                </Button>
              </div>

              <Textarea
                rows={20}
                readOnly
                className="font-mono text-xs"
                value={show ? envText : masked}
              />
            </>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
