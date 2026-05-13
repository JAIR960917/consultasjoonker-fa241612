import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SaleAddressDialog, type AddressData, type EmpresaOption } from "@/components/SaleAddressDialog";
import { maskCpf, brl } from "@/lib/finance";
import { fillTemplate, valorExtenso, dataExtenso, dataExtensoTotal } from "@/lib/contract";

function formatCPF(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export default function PagamentoEntrega() {
  const nav = useNavigate();
  const { cidade: cidadeUsuario, role, empresaId } = useAuth();
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState<string | null>(null);
  const [valorTotal, setValorTotal] = useState("");
  const [valorEntrada, setValorEntrada] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [savingVenda, setSavingVenda] = useState(false);
  const [empresasDisponiveis, setEmpresasDisponiveis] = useState<EmpresaOption[]>([]);

  useEffect(() => {
    if (role !== "admin") return;
    supabase
      .from("empresas")
      .select("id, nome, cidade")
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        setEmpresasDisponiveis(data.map((e) => ({ id: e.id, nome: e.nome, cidade: e.cidade ?? "" })));
      });
  }, [role]);

  const total = parseFloat(valorTotal.replace(",", ".")) || 0;
  const entrada = parseFloat(valorEntrada.replace(",", ".")) || 0;
  const financiado = Math.max(total - entrada, 0);
  const podeRegistrar = !!nome && total > 0 && entrada >= 0 && entrada <= total;

  const handleConsultar = async () => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
      toast.error("Informe um CPF válido");
      return;
    }
    setLoading(true);
    setNome(null);
    setValorTotal("");
    setValorEntrada("");
    try {
      const { data, error } = await supabase.functions.invoke("apifull-consulta-cpf", {
        body: { cpf: digits },
      });
      if (error) throw error;
      if (data?.status && data.status !== "sucesso") {
        toast.error("CPF não encontrado");
        return;
      }
      const dados = data?.dados ?? data;
      if (!dados?.nome) {
        toast.error("Nome não retornado para este CPF");
        return;
      }
      setNome(dados.nome);
      toast.success("Cliente encontrado");
    } catch (e) {
      toast.error((e as Error).message || "Erro ao consultar");
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrar = () => {
    if (!podeRegistrar) return;
    setAddressOpen(true);
  };

  const confirmarVendaComEndereco = async (endereco: AddressData) => {
    if (!nome) return;
    setAddressOpen(false);
    setSavingVenda(true);
    try {
      const cpfDigits = cpf.replace(/\D/g, "");
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user!.id;

      const cidadeVenda = (endereco.cidade || cidadeUsuario || "").trim();
      const empresaIdVenda = endereco.empresaId ?? empresaId ?? null;

      // 1) Registra venda (pagamento na entrega = 1 parcela, sem juros)
      const { data: vendaIns, error: vendaErr } = await supabase
        .from("vendas")
        .insert({
          user_id: userId,
          cpf: cpfDigits,
          nome,
          valor_total: total,
          valor_entrada: entrada,
          parcelas: 1,
          taxa_juros: 0,
          valor_parcela: financiado,
          valor_financiado: financiado,
          status: "aprovado",
          cidade: cidadeVenda,
          empresa_id: empresaIdVenda,
          primeiro_vencimento: endereco.primeiroVencimento || null,
        })
        .select("id")
        .single();
      if (vendaErr) throw vendaErr;

      // 2) Modelo de contrato
      const { data: tpl, error: tplErr } = await supabase
        .from("contract_template")
        .select("content, company_name, company_cnpj, company_address")
        .limit(1)
        .maybeSingle();
      if (tplErr) throw tplErr;
      if (!tpl) throw new Error("Modelo de contrato não configurado.");

      const filled = fillTemplate(tpl.content, {
        nome,
        cpf: maskCpf(cpfDigits),
        endereco: endereco.endereco,
        telefone: endereco.telefone,
        empresa: tpl.company_name,
        empresa_cnpj: tpl.company_cnpj || "",
        empresa_endereco: tpl.company_address || "",
        valor_total: brl(total).replace("R$", "").trim(),
        valor_total_extenso: valorExtenso(total),
        valor_entrada: brl(entrada).replace("R$", "").trim(),
        valor_entrada_extenso: valorExtenso(entrada),
        valor_financiado: brl(financiado).replace("R$", "").trim(),
        valor_financiado_extenso: valorExtenso(financiado),
        valor_parcela: brl(financiado).replace("R$", "").trim(),
        valor_parcela_extenso: valorExtenso(financiado),
        parcelas: 1,
        taxa_juros: "0,00",
        valor_dividas: brl(0).replace("R$", "").trim(),
        valor_dividas_extenso: valorExtenso(0),
        data: new Date().toLocaleDateString("pt-BR"),
        data_extenso: dataExtenso(new Date()),
        data_extenso_total: dataExtensoTotal(new Date()),
        cidade: cidadeVenda,
        primeiro_vencimento: endereco.primeiroVencimento
          ? new Date(endereco.primeiroVencimento + "T00:00:00").toLocaleDateString("pt-BR")
          : "",
        primeiro_vencimento_extenso: endereco.primeiroVencimento
          ? dataExtenso(new Date(endereco.primeiroVencimento + "T00:00:00"))
          : "",
        primeiro_vencimento_extenso_total: endereco.primeiroVencimento
          ? dataExtensoTotal(new Date(endereco.primeiroVencimento + "T00:00:00"))
          : "",
      });

      // 3) Cria contrato
      const { data: contractIns, error: contractErr } = await supabase
        .from("contracts")
        .insert({
          user_id: userId,
          venda_id: vendaIns.id,
          cpf: cpfDigits,
          nome,
          endereco: endereco.endereco,
          telefone: endereco.telefone,
          content: filled,
          status: "pendente",
          cidade: cidadeVenda,
          empresa_id: empresaIdVenda,
        })
        .select("id")
        .single();
      if (contractErr) throw contractErr;

      toast.success("Venda registrada — promissória gerada");
      nav(`/contrato/${contractIns.id}`);
    } catch (e) {
      toast.error("Erro ao registrar venda", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSavingVenda(false);
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
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {loading ? "Consultando..." : "Consultar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {nome && (
        <Card className="mt-6 shadow-card">
          <CardContent className="p-6 space-y-5">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Cliente</p>
              <p className="text-lg font-semibold">{nome}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="valor-total">Valor da venda (R$)</Label>
                <Input
                  id="valor-total"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value.replace(/[^\d.,]/g, ""))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="valor-entrada">Valor da entrada (R$)</Label>
                <Input
                  id="valor-entrada"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valorEntrada}
                  onChange={(e) => setValorEntrada(e.target.value.replace(/[^\d.,]/g, ""))}
                  className="mt-1"
                />
              </div>
            </div>

            {total > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <span className="text-muted-foreground">Restante na entrega: </span>
                <span className="font-semibold">{brl(financiado)}</span>
              </div>
            )}

            {podeRegistrar && (
              <Button
                onClick={handleRegistrar}
                disabled={savingVenda}
                className="bg-success hover:bg-success/90 text-success-foreground"
              >
                {savingVenda ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Registrar venda aprovada
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <SaleAddressDialog
        open={addressOpen}
        onOpenChange={setAddressOpen}
        onConfirm={confirmarVendaComEndereco}
        clienteNome={nome ?? undefined}
        cidadePadrao={cidadeUsuario ?? undefined}
        empresaPadraoId={empresaId ?? null}
        empresasDisponiveis={role === "admin" ? empresasDisponiveis : undefined}
      />
    </AppLayout>
  );
}
