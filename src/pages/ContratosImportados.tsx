import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Download, FileSignature } from "lucide-react";
import { maskCpf } from "@/lib/finance";

interface Row {
  id: string;
  envelope_id: string;
  nome: string | null;
  cpf: string | null;
  data_assinatura: string | null;
  pdf_path: string | null;
}

export default function ContratosImportados() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contratos_assertiva" as any)
      .select("id, envelope_id, nome, cpf, data_assinatura, pdf_path")
      .order("data_assinatura", { ascending: false })
      .limit(1000);
    setRows(((data ?? []) as unknown) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    setLastError(null);
    const { data, error } = await supabase.functions.invoke("assertiva-sincronizar-contratos", { body: {} });
    setSyncing(false);
    if (error || !data?.ok) {
      const msg = data?.error ?? error?.message ?? "Erro desconhecido";
      setLastError(typeof msg === "string" ? msg : JSON.stringify(msg));
      toast.error("Erro ao sincronizar");
      return;
    }
    toast.success(`Importados: ${data.importados} · Já existentes: ${data.ignorados}`);
    load();
  };

  const baixar = async (path: string) => {
    const { data, error } = await supabase.functions.invoke("assertiva-baixar-contrato", { body: { path } });
    if (error || !data?.ok) {
      toast.error("Erro ao gerar link", { description: data?.error ?? error?.message });
      return;
    }
    window.open(data.url, "_blank");
  };

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.replace(/\D/g, "");
    return (
      (r.nome ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s && (r.cpf ?? "").includes(s))
    );
  });

  return (
    <AppLayout>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileSignature className="h-7 w-7" /> Contratos Assertiva
          </h1>
          <p className="text-muted-foreground">Contratos assinados importados da Assertiva Autentica.</p>
        </div>
        <Button onClick={sync} disabled={syncing} className="bg-gradient-primary">
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Sincronizar
        </Button>
      </header>

      {lastError && (
        <Card className="mb-4 border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Erro retornado pela Assertiva</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap break-all bg-muted p-3 rounded select-all">
{lastError}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => { navigator.clipboard.writeText(lastError); toast.success("Copiado"); }}
            >
              Copiar erro
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? "Carregando..." : `${filtered.length} contrato(s)`}
          </CardTitle>
          <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Data assinatura</TableHead>
                <TableHead className="text-right">Contrato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome ?? "—"}</TableCell>
                  <TableCell>{r.cpf ? maskCpf(r.cpf) : "—"}</TableCell>
                  <TableCell>
                    {r.data_assinatura ? new Date(r.data_assinatura).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.pdf_path ? (
                      <Button size="sm" variant="outline" onClick={() => baixar(r.pdf_path!)}>
                        <Download className="mr-2 h-4 w-4" /> Baixar PDF
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">sem PDF</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum contrato importado. Clique em "Sincronizar".
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
