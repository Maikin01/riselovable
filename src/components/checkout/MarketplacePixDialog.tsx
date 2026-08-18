import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2, QrCode, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { translateError } from "@/lib/translate-error";
import { formatPrice } from "@/lib/license-utils";
import {
  createMarketplacePixCheckout,
  getMarketplaceOrderStatus,
  type MarketplacePixResponse,
  type MarketplaceProduct,
} from "@/lib/api/marketplace-api";

type Step = "form" | "pix" | "success";

export function MarketplacePixDialog({
  product,
  open,
  onOpenChange,
  onPaid,
}: {
  product: MarketplaceProduct | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPaid?: () => void;
}) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [wpp, setWpp] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<MarketplacePixResponse | null>(null);
  const [delivered, setDelivered] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);
  const idemRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) return;
    setStep("form");
    setName("");
    setWpp("");
    setCpf("");
    setPix(null);
    setDelivered(null);
    setInstructions(null);
    setCopied(false);
    setLoading(false);
    idemRef.current = null;
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
  }, [open]);

  useEffect(() => {
    if (step !== "pix" || !pix) return;
    const tick = async () => {
      try {
        const res = await getMarketplaceOrderStatus(pix.order_id);
        if (res.status === "delivered" || res.status === "paid") {
          setDelivered(res.delivered_content);
          setInstructions(res.delivery_instructions);
          setStep("success");
          onPaid?.();
          if (pollRef.current) window.clearInterval(pollRef.current);
        } else if (res.status === "cancelled") {
          toast.error("Pagamento cancelado. Tente novamente.");
          if (pollRef.current) window.clearInterval(pollRef.current);
        }
      } catch (e) {
        console.warn("poll marketplace", e);
      }
    };
    void tick();
    pollRef.current = window.setInterval(tick, 3000) as unknown as number;
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [step, pix, onPaid]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    const cleanWpp = wpp.replace(/\D+/g, "");
    const cleanCpf = cpf.replace(/\D+/g, "");
    if (name.trim().length < 2) return toast.error("Informe seu nome.");
    if (cleanWpp.length < 10) return toast.error("Informe um WhatsApp válido (com DDD).");
    if (cleanCpf && ![11, 14].includes(cleanCpf.length)) {
      return toast.error("Informe um CPF ou CNPJ válido.");
    }
    setLoading(true);
    try {
      idemRef.current ??= crypto.randomUUID();
      const res = await createMarketplacePixCheckout({
        product_id: product.id,
        buyer_name: name.trim(),
        buyer_whatsapp: cleanWpp,
        buyer_cpf: cleanCpf || undefined,
        idempotency_key: idemRef.current,
      });
      setPix(res);
      setStep("pix");
    } catch (err) {
      toast.error(translateError(err) || "Falha ao gerar Pix.");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/10 bg-[#0a0a0a] text-white">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{product.name}</DialogTitle>
              <DialogDescription className="text-white/60">
                Pagamento via Pix —{" "}
                <span className="font-bold text-white">{formatPrice(product.price_cents)}</span>.
                Preencha os dados abaixo para gerar o QR Code.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="mkt-name">Nome completo</Label>
                <Input
                  id="mkt-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="bg-white/5"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mkt-wpp">WhatsApp (com DDD)</Label>
                <Input
                  id="mkt-wpp"
                  value={wpp}
                  onChange={(e) => setWpp(e.target.value)}
                  placeholder="(61) 99999-9999"
                  className="bg-white/5"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mkt-cpf">CPF (recomendado)</Label>
                <Input
                  id="mkt-cpf"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="bg-white/5"
                  inputMode="numeric"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="btn-neon h-12 w-full text-sm font-bold uppercase tracking-widest"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando Pix…
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" /> Gerar Pix de{" "}
                    {formatPrice(product.price_cents)}
                  </>
                )}
              </Button>
            </form>
          </>
        )}

        {step === "pix" && pix && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Pague com Pix</DialogTitle>
              <DialogDescription className="text-white/60">
                Escaneie o QR Code ou copie o código. Assim que o pagamento for confirmado, o
                entregável aparece aqui.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-2xl border border-white/10 bg-white p-2">
                {pix.qr_code_base64 ? (
                  <img
                    src={`data:image/png;base64,${pix.qr_code_base64}`}
                    alt="QR Code Pix"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-black" />
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/50">
                  Copia e cola
                </div>
                <div className="mb-2 max-h-16 overflow-y-auto break-all font-mono text-[11px] text-white/70">
                  {pix.qr_code}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-white/10 bg-white/5 text-xs"
                  onClick={() => copyToClipboard(pix.qr_code ?? "")}
                >
                  {copied ? (
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {copied ? "Copiado" : "Copiar código Pix"}
                </Button>
              </div>
              <div className="flex items-center justify-center gap-2 text-[11px] text-white/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Aguardando pagamento…
              </div>
            </div>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Pagamento confirmado! 🎉</DialogTitle>
              <DialogDescription className="text-white/60">
                {delivered
                  ? "Seu entregável está liberado abaixo."
                  : "Recebemos seu pagamento. A entrega deste produto é manual e será liberada em instantes no histórico de compras."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {delivered && (
                <div className="ring-glow space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                    <PackageCheck className="h-3.5 w-3.5" /> Entregável
                  </div>
                  <div className="break-all font-mono text-sm font-bold text-white">
                    {delivered}
                  </div>
                </div>
              )}
              {instructions && <p className="text-[11px] text-white/50">{instructions}</p>}
              {delivered && (
                <Button
                  type="button"
                  className="btn-neon h-12 w-full text-sm font-bold uppercase tracking-widest"
                  onClick={() => copyToClipboard(delivered)}
                >
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar entregável"}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full border-white/10 bg-white/5"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
