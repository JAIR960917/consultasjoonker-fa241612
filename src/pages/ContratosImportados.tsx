import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Download, FileSignature, FolderInput } from "lucide-react";
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
  const [importingDrive, setImportingDrive] = useState(false);
  const [driveFolder, setDriveFolder] = useState("");
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
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `https://vtiimbbrxsfqgmscqdnl.supabase.co/functions/v1/assertiva-sincronizar-contratos`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: "{}",
      });
      const txt = await res.text();
      let data: any = null;
      try { data = JSON.parse(txt); } catch { /* keep raw */ }
      if (!res.ok || !data?.ok) {
        const msg = data?.error ?? txt ?? `HTTP ${res.status}`;
        setLastError(typeof msg === "string" ? msg : JSON.stringify(msg, null, 2));
        toast.error("Erro ao sincronizar");
        return;
      }
      toast.success(`Importados: ${data.importados} · Já existentes: ${data.ignorados}`);
      load();
    } catch (e: any) {
      setLastError(e?.message ?? String(e));
      toast.error("Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const baixar = async (path: string) => {
    const { data, error } = await supabase.functions.invoke("assertiva-baixar-contrato", { body: { path } });
    if (error || !data?.ok) {
      toast.error("Erro ao gerar link", { description: data?.error ?? error?.message });
      return;
    }
    window.open(data.url, "_blank");
  };

  const importarDrive = async () => {
    if (!driveFolder.trim()) {
      toast.error("Cole a URL ou ID da pasta do Google Drive");
      return;
    }
    setImportingDrive(true);
    setLastError(null);
    try {
      const { data, error } = await supabase.functions.invoke("gdrive-importar-contratos", {
        body: { folder: driveFolder.trim() },
      });
      if (error || !data?.ok) {
        const msg = data?.error ?? error?.message ?? "Erro desconhecido";
        setLastError(typeof msg === "string" ? msg : JSON.stringify(msg, null, 2));
        toast.error("Erro ao importar do Drive");
        return;
      }
      toast.success(`Drive: ${data.importados} importados · ${data.ignorados} já existiam`);
      load();
    } catch (e: any) {
      setLastError(e?.message ?? String(e));
      toast.error("Erro ao importar do Drive");
    } finally {
      setImportingDrive(false);
    }
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
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileSignature className="h-7 w-7" /> Contratos Assertiva
          </h1>
          <p className="text-muted-foreground">Contratos assinados importados da Assertiva Autentica ou Google Drive.</p>
        </div>
        <Button onClick={sync} disabled={syncing} className="bg-gradient-primary">
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Sincronizar Assertiva
        </Button>
      </header>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderInput className="h-4 w-4" /> Importar do Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Cole a URL da pasta (ex: https://drive.google.com/drive/folders/...)"
              value={driveFolder}
              onChange={(e) => setDriveFolder(e.target.value)}
              className="flex-1 min-w-[280px]"
            />
            <Button onClick={importarDrive} disabled={importingDrive}>
              {importingDrive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderInput className="mr-2 h-4 w-4" />}
              Importar PDFs
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Os PDFs devem estar nomeados como <code>NOME - CPF.pdf</code> para extração automática.
          </p>
        </CardContent>
      </Card>

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
