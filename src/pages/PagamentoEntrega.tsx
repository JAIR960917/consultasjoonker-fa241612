import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { toast } from "sonner";

function formatCPF(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export default function PagamentoEntrega() {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConsultar = async () => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
      toast.error("Informe um CPF válido");
      return;
    }
    setLoading(true);
    try {
      // TODO: integrar com APIFull assim que a documentação for fornecida
      toast.info("Consulta APIFull ainda não configurada");
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
    </AppLayout>
  );
}
