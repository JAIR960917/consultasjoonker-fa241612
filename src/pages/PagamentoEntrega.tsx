import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function formatCPF(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

interface DadosCPF {
  cpf?: string;
  nome?: string;
  sexo?: string;
  dataNascimento?: string;
  nomeMae?: string;
  nomePai?: string | null;
  situacaoRFB?: string;
  [k: string]: unknown;
}

export default function PagamentoEntrega() {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<DadosCPF | null>(null);

  const handleConsultar = async () => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
      toast.error("Informe um CPF válido");
      return;
    }
    setLoading(true);
    setDados(null);
    try {
      const { data, error } = await supabase.functions.invoke("apifull-consulta-cpf", {
        body: { cpf: digits },
      });
      if (error) throw error;
      if (data?.status && data.status !== "sucesso") {
        toast.error("CPF não encontrado");
        return;
      }
      setDados(data?.dados ?? data);
      toast.success("Consulta realizada");
    } catch (e) {
      toast.error((e as Error).message || "Erro ao consultar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Pagamento na Entrega</h1>
        <p className="text-sm text-muted-foreground">
          Consulte o CPF do cliente para gerar a promissória.
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="flex-1">
              <Label htmlFor="cpf" className="text-primary font-semibold">CPF</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleConsultar()}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleConsultar}
              disabled={loading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 md:w-auto"
            >
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Consultando..." : "Consultar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {dados && (
        <Card className="mt-6 shadow-card">
          <CardContent className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Dados do cliente</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome" value={dados.nome} />
              <Field label="CPF" value={dados.cpf} />
              <Field label="Data de nascimento" value={dados.dataNascimento} />
              <Field label="Sexo" value={dados.sexo} />
              <Field label="Nome da mãe" value={dados.nomeMae} />
              <Field label="Nome do pai" value={dados.nomePai ?? "—"} />
              <Field label="Situação RFB" value={dados.situacaoRFB} />
            </dl>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}
