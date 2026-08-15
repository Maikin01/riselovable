import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreditCard, Copy, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { adminListPayments } from "@/lib/api/license-api";
import { QueryErrorState } from "@/components/QueryErrorState";

type PaymentRow = {
  id: string;
  status: string;
  amount_cents: number;
  buyer_name: string | null;
  buyer_whatsapp: string | null;
  buyer_email: string | null;
  provider_payment_id: string | null;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
  plans: { name: string; slug: string } | null;
  licenses: { license_key: string } | null;
};

const money = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

const fmtPhone = (raw: string | null) => {
  if (!raw) return "—";
  const d = raw.replace(/\D+/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

const statusInfo = (
  s: string,
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
  switch (s) {
    case "approved":
      return { label: "Pago", variant: "default" };
    case "pending":
    case "in_process":
      return { label: "Pendente", variant: "secondary" };
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":
    case "error":
      return { label: s === "error" ? "Erro" : "Recusado", variant: "destructive" };
    default:
      return { label: s, variant: "outline" };
  }
};

export function PaymentsTab() {
  const listFn = adminListPayments;
  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: () => listFn(),
    refetchInterval: 15_000,
    retry: 1,
  });
  const [filter, setFilter] = useState<"all" | "approved" | "pending" | "failed">("all");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const payments = (data ?? []) as PaymentRow[];

  const totals = useMemo(() => {
    const approved = payments.filter((p) => p.status === "approved");
    const pending = payments.filter((p) => p.status === "pending" || p.status === "in_process");
    const failed = payments.filter((p) =>
      ["rejected", "cancelled", "refunded", "charged_back", "error"].includes(p.status),
    );
    const revenueCents = approved.reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
    return { approved, pending, failed, revenueCents };
  }, [payments]);

  const filtered = useMemo(() => {
    let rows = payments;
    // Tira as duas últimas recusadas (cancelled/rejected/error) a pedido do usuário
    // Identificadas como as duas mais recentes com status de falha no banco
    const failedIdsToRemove = [
      "4fb10f6d-68f8-4985-95fc-f8677e5cd5d0",
      "260e2c20-e1f7-4421-b35e-064755c30fc0",
    ];
    rows = rows.filter((r) => !failedIdsToRemove.includes(r.id));

    if (filter === "approved") rows = rows.filter((r) => r.status === "approved");
    else if (filter === "pending")
      rows = rows.filter((r) => r.status === "pending" || r.status === "in_process");
    else if (filter === "failed")
      rows = rows.filter((r) =>
        ["rejected", "cancelled", "refunded", "charged_back", "error"].includes(r.status),
      );

    const term = q.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (r) =>
          r.buyer_name?.toLowerCase().includes(term) ||
          r.buyer_email?.toLowerCase().includes(term) ||
          r.buyer_whatsapp?.replace(/\D+/g, "").includes(term.replace(/\D+/g, "")) ||
          r.plans?.name.toLowerCase().includes(term) ||
          r.provider_payment_id?.includes(term),
      );
    }
    return rows;
  }, [payments, filter, q]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado!");
    setTimeout(() => setCopied(null), 1500);
  };

  if (error) {
    return (
      <QueryErrorState
        error={error}
        title="Não foi possível carregar os pagamentos"
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" /> Total
          </div>
          <div className="mt-2 text-2xl font-bold">{payments.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pagos</div>
          <div className="mt-2 text-2xl font-bold text-emerald-500">{totals.approved.length}</div>
          <div className="text-xs text-muted-foreground">
            {money(totals.revenueCents)} arrecadados
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pendentes</div>
          <div className="mt-2 text-2xl font-bold text-yellow-500">{totals.pending.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Recusados / Erro</div>
          <div className="mt-2 text-2xl font-bold text-destructive">{totals.failed.length}</div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["all", "approved", "pending", "failed"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f === "all"
                  ? "Todos"
                  : f === "approved"
                    ? "Pagos"
                    : f === "pending"
                      ? "Pendentes"
                      : "Recusados"}
              </Button>
            ))}
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, email, telefone, plano..."
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      {/* Lista */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Carregando pagamentos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum pagamento encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const s = statusInfo(p.status);
                  const phone = fmtPhone(p.buyer_whatsapp);
                  const rawPhone = (p.buyer_whatsapp ?? "").replace(/\D+/g, "");
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.buyer_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.buyer_email ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        {rawPhone ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{phone}</span>
                            <button
                              onClick={() => copy(rawPhone, `phone-${p.id}`)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Copiar número"
                            >
                              {copied === `phone-${p.id}` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">{p.plans?.name ?? "—"}</td>
                      <td className="px-4 py-3 font-medium">{money(p.amount_cents ?? 0)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {fmtDate(p.paid_at ?? p.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
