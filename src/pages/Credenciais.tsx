import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, KeyRound, Save, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Empresa { id: string; nome: string; slug: string; }
interface Cred {
  empresa_id: string;
  cora_client_id: string | null;
  cora_certificate: string | null;
  cora_private_key: string | null;
}

export default function Credenciais() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [form, setForm] = useState({ cora_client_id: "", cora_certificate: "", cora_private_key: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("empresas").select("id, nome, slug").order("nome");
      setEmpresas((data ?? []) as Empresa[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!empresaId) {
      setForm({ cora_client_id: "", cora_certificate: "", cora_private_key: "" });
      setHasRecord(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("empresa_credenciais")
        .select("*")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (data) {
        const c = data as Cred;
        setForm({
          cora_client_id: c.cora_client_id ?? "",
          cora_certificate: c.cora_certificate ?? "",
          cora_private_key: c.cora_private_key ?? "",
        });
        setHasRecord(true);
      } else {
        setForm({ cora_client_id: "", cora_certificate: "", cora_private_key: "" });
        setHasRecord(false);
      }
    })();
  }, [empresaId]);

  const save = async () => {
    if (!empresaId) return;
    setSaving(true);
    const payload = {
      empresa_id: empresaId,
      cora_client_id: form.cora_client_id.trim() || null,
      cora_certificate: form.cora_certificate.trim() || null,
      cora_private_key: form.cora_private_key.trim() || null,
    };
    const { error } = hasRecord
      ? await supabase.from("empresa_credenciais").update(payload).eq("empresa_id", empresaId)
      : await supabase.from("empresa_credenciais").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Credenciais salvas");
    setHasRecord(true);
  };

  const remove = async () => {
    if (!empresaId || !hasRecord) return;
    if (!confirm("Remover credenciais desta empresa? O sistema voltará a usar os secrets padrão.")) return;
    setSaving(true);
    const { error } = await supabase.from("empresa_credenciais").delete().eq("empresa_id", empresaId);
    setSaving(false);
    if (error) { toast.error("Erro ao remover", { description: error.message }); return; }
    toast.success("Credenciais removidas");
    setForm({ cora_client_id: "", cora_certificate: "", cora_private_key: "" });
    setHasRecord(false);
  };

  return (
    <AppLayout>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <KeyRound className="h-7 w-7 text-primary" /> Credenciais Cora
        </h1>
        <p className="text-muted-foreground">Cadastre as credenciais Cora de cada empresa diretamente pelo sistema.</p>
      </header>

      <Card className="shadow-card">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Empresa</Label>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma empresa…" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome} — {e.slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {empresaId && (
            <>
              <div className="space-y-1.5">
                <Label>Client ID</Label>
                <Input
                  value={form.cora_client_id}
                  onChange={(e) => setForm({ ...form, cora_client_id: e.target.value })}
                  placeholder="int-..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Certificado (PEM)</Label>
                <Textarea
                  rows={6}
                  className="font-mono text-xs"
                  value={form.cora_certificate}
                  onChange={(e) => setForm({ ...form, cora_certificate: e.target.value })}
                  placeholder="-----BEGIN CERTIFICATE-----..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Private Key (PEM)</Label>
                <Textarea
                  rows={6}
                  className="font-mono text-xs"
                  value={form.cora_private_key}
                  onChange={(e) => setForm({ ...form, cora_private_key: e.target.value })}
                  placeholder="-----BEGIN PRIVATE KEY-----..."
                />
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <Button variant="outline" onClick={remove} disabled={!hasRecord || saving} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Remover
                </Button>
                <Button onClick={save} disabled={saving} className="bg-gradient-primary">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Salvar</>}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground border-t pt-3">
                As credenciais salvas aqui têm prioridade sobre os secrets do servidor. Se algum campo ficar em branco, o sistema usa o secret correspondente como fallback.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
