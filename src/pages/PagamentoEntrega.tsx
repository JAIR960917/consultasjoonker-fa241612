import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";

export default function PagamentoEntrega() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Pagamento na Entrega</h1>
        <p className="text-sm text-muted-foreground">
          Gere promissórias para vendas com pagamento na entrega.
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-6">
          <History className="h-7 w-7 text-primary" />
          <h3 className="mt-4 text-xl font-semibold">Gerar promissória</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Em breve: fluxo de geração de promissória para pagamento na entrega.
          </p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
