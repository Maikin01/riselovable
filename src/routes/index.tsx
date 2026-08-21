import { createFileRoute, Link } from "@tanstack/react-router"; tst
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site/Header";
import { BrowserCompatibility } from "@/components/site/BrowserCompatibility";
import { Card } from "@/components/ui/card";
import { useBranding } from "@/lib/branding";
import {
  ChevronRight,
  Sparkles,
  Gift,
  Cpu,
  Mic,
  Infinity as InfinityIcon,
  Shield,
  Wand2,
  BrainCircuit,
  MousePointerClick,
  UploadCloud,
  Zap,
  Eraser,
  MessageSquare,
  Bot,
  Puzzle,
  StickyNote,
  Boxes,
  Check,
  Download,
  CheckCircle2,
  LifeBuoy,
} from "lucide-react";
import { getPublicPlans } from "@/lib/api/license-api";
import { useReveal } from "@/hooks/useReveal";
import { formatPrice } from "@/lib/license-utils";
import { PixCheckoutDialog } from "@/components/checkout/PixCheckoutDialog";
import { QueryErrorState } from "@/components/QueryErrorState";

const PENDING_CHECKOUT_KEY = "rise_lovable_pending_checkout";
const REFERRAL_KEY = "rise_lovable_referral_code";
const EMPTY_PLANS: never[] = [];

function savePendingCheckout(planSlug: string) {
  window.localStorage.setItem(PENDING_CHECKOUT_KEY, planSlug);
  window.sessionStorage.setItem(PENDING_CHECKOUT_KEY, planSlug);
}

function readPendingCheckout() {
  return (
    window.localStorage.getItem(PENDING_CHECKOUT_KEY) ??
    window.sessionStorage.getItem(PENDING_CHECKOUT_KEY)
  );
}

function clearPendingCheckout() {
  window.localStorage.removeItem(PENDING_CHECKOUT_KEY);
  window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
}

function captureReferralFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref && ref.length >= 4 && ref.length <= 16) {
    window.localStorage.setItem(REFERRAL_KEY, ref.toUpperCase());
  }
}

export function readReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFERRAL_KEY);
}

function getAuthHashParams() {
  const rawHash = window.location.hash.replace(/^#/, "");
  const authParamStart = rawHash.search(/(?:^|[#&?])(access_token|refresh_token|token_hash|type)=/);
  const paramsSource =
    authParamStart >= 0 ? rawHash.slice(authParamStart).replace(/^[#&?]/, "") : rawHash;
  return new URLSearchParams(paramsSource);
}

function readEmailConfirmationParams() {
  const url = new URL(window.location.href);
  const hash = getAuthHashParams();
  const tokenHash = url.searchParams.get("token_hash") ?? hash.get("token_hash");
  const type = url.searchParams.get("type") ?? hash.get("type") ?? "signup";
  return {
    code: url.searchParams.get("code"),
    tokenHash,
    type,
    accessToken: hash.get("access_token"),
    refreshToken: hash.get("refresh_token"),
  };
}

function hasEmailConfirmationParams() {
  const url = new URL(window.location.href);
  const hash = getAuthHashParams();
  return (
    url.searchParams.has("code") ||
    url.searchParams.has("token_hash") ||
    window.location.hash.includes("access_token=") ||
    window.location.hash.includes("refresh_token=") ||
    hash.has("access_token") ||
    hash.has("refresh_token")
  );
}

async function finishEmailConfirmationFromUrl() {
  const authUrl = readEmailConfirmationParams();

  if (authUrl.tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: authUrl.tokenHash,
      type: authUrl.type as any,
    });
    if (error) console.warn("[checkout] Falha ao confirmar token do email", error);
  }

  if (authUrl.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(authUrl.code);
    if (error) console.warn("[checkout] Falha ao concluir confirmação por código", error);
  }

  if (authUrl.accessToken && authUrl.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: authUrl.accessToken,
      refresh_token: authUrl.refreshToken,
    });
    if (error) console.warn("[checkout] Falha ao restaurar sessão da confirmação", error);
  }
}

async function waitForVerifiedCheckoutUser(attempts: number) {
  for (let i = 0; i < attempts; i++) {
    // getSession é local (lê do storage) — instantâneo, sem round-trip de rede.
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return data.session.user;
    await new Promise((resolve) => window.setTimeout(resolve, 60));
  }
  return null;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rise Lovable — Domine o Lovable em outro nível" },
      {
        name: "description",
        content:
          "A extensão definitiva para power-users do Lovable.dev. Sidebar IA, prompt por voz, uso ilimitado e licenças validadas em tempo real.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://www.youtube-nocookie.com" },
      { rel: "preconnect", href: "https://www.youtube.com" },
      { rel: "preconnect", href: "https://i.ytimg.com" },
      { rel: "preconnect", href: "https://s.ytimg.com" },
      { rel: "dns-prefetch", href: "https://googlevideo.com" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const brand = useBranding();
  useEffect(() => {
    if (brand.code && typeof document !== "undefined") {
      document.title = `${brand.name} — Domine o Lovable em outro nível`;
    }
  }, [brand]);
  useEffect(() => {
    captureReferralFromUrl();
  }, []);
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <SiteHeader />
      <main>
        <Hero />
        <BrowserCompatibility />
        <HowItWorks />
        <Features />
        <Plans />
        <FinalCTA />
        <SupportCTA />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. HERO                                                             */
/* ------------------------------------------------------------------ */

function Hero() {
  const brand = useBranding();
  return (
    <section className="rise-bg overflow-hidden border-b border-white/5">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
        <div className="chip-neon mb-8 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
          <Sparkles className="h-3 w-3" />
          Ferramenta secreta dos usuários avançados de IA
        </div>

        <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
          USE O LOVABLE
          <br />
          EM <span className="text-gradient-red">OUTRO NÍVEL.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60">
          A extensão definitiva para{" "}
          <span className="font-medium text-white">produtividade com IA</span>, automação e uso
          avançado do Lovable.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#plans"
            className="btn-neon group inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-bold uppercase tracking-wider text-white"
          >
            Obter acesso
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          <Link
            to="/auth"
            search={{ claim: "trial" } as any}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10"
          >
            <Gift className="h-4 w-4 text-primary" />
            Testar grátis
          </Link>
        </div>

        {/* Video showcase */}
        <div className="relative mx-auto mt-16 w-full max-w-4xl">
          <div className="pointer-events-none absolute -inset-8 -z-0 rounded-[40px] bg-primary/20 blur-[90px]" />
          <div className="ring-glow relative aspect-video overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]">
            <iframe
              className="absolute left-1/2 top-1/2 h-[calc(100%+2px)] w-[calc(100%+2px)] -translate-x-1/2 -translate-y-1/2 scale-[1.02]"
              src="https://www.youtube-nocookie.com/embed/1qOVa4HY48c?rel=0&modestbranding=1&playsinline=1&controls=1"
              title={`${brand.name} — Demo`}
              loading="eager"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. COMO FUNCIONA                                                    */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: Download,
      title: "Baixe o instalador",
      desc: "Um clique no botão, download imediato. Sem cadastro, sem espera, sem loja de extensões.",
    },
    {
      n: "02",
      icon: Puzzle,
      title: "Instale no navegador",
      desc: "Ative o modo desenvolvedor, arraste o ZIP e pronto. Funciona em Chrome, Edge, Brave, Opera, Arc.",
    },
    {
      n: "03",
      icon: Zap,
      title: "Pronto pra usar",
      desc: "Abra o Lovable, ative a extensão com sua Key e envie quantos comandos quiser. Sem gastar créditos.",
    },
  ];

  return (
    <section className="bg-panel-alt border-b border-white/5 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-primary">
            Como funciona
          </div>
          <h2 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Instale, ative e domine em
            <br />
            menos de <span className="text-gradient-red">60 segundos.</span>
          </h2>
        </div>

        <div className="relative grid gap-6 md:grid-cols-3">
          {/* linha conectora LED neon */}
          <div className="led-line pointer-events-none absolute left-[10%] right-[10%] top-[92px] hidden md:block">
            <span className="led-line-runner" />
          </div>

          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.n}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-7 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_20px_60px_-20px_rgba(239,68,68,0.35)]"
              >
                {/* accent gradient no topo */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                {/* número em marca d'água */}
                <span className="pointer-events-none absolute -right-2 -top-4 select-none font-display text-[110px] font-black leading-none text-white/[0.04] transition-colors duration-300 group-hover:text-primary/10">
                  {s.n}
                </span>

                {/* ícone + badge */}
                <div className="relative mb-6 flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 to-primary/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 group-hover:border-primary/60 group-hover:shadow-[0_0_30px_-5px_rgba(239,68,68,0.5)]">
                    <Icon className="h-6 w-6 text-primary" strokeWidth={2} />
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-white/50">
                    PASSO {s.n}
                  </span>
                </div>

                <h3 className="relative font-display text-xl font-bold tracking-tight text-white">
                  {s.title}
                </h3>
                <p className="relative mt-2.5 text-[13.5px] leading-relaxed text-white/55">
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-white/40">
            Comece agora mesmo
          </div>
          <a
            href="#plans"
            className="btn-glossy-red inline-flex h-14 items-center gap-3 rounded-full px-10 text-sm font-bold uppercase tracking-wider text-white"
          >
            <Download className="h-5 w-5" />
            Baixar extensão grátis
          </a>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-white/50">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" /> Grátis para baixar
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" /> Última versão v20.5.2
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" /> Chrome · Edge · Brave · Opera · Arc
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. RECURSOS CORE (bento grid 12)                                    */
/* ------------------------------------------------------------------ */

function Features() {
  const brand = useBranding();
  const items = [
    {
      icon: Wand2,
      title: "Reescrever",
      desc: "Refine seus prompts com IA antes de enviar. Transforme ideias soltas em comandos cirúrgicos que geram resultados perfeitos na primeira tentativa.",
    },
    {
      icon: BrainCircuit,
      title: "Modo Pensar",
      desc: "Ative o raciocínio profundo da IA com um clique. Ideal para arquiteturas complexas, debugging avançado e decisões técnicas críticas.",
    },
    {
      icon: UploadCloud,
      title: "Upload de Arquivos & Imagens",
      desc: "Envie imagens, PDFs e referências de design direto no chat. A IA usa esses arquivos para construir interfaces fiéis ao seu desejo.",
    },
    {
      icon: Zap,
      title: "Funções Especiais",
      desc: "Atalhos, automações e ações rápidas integradas ao Lovable. Acelere tarefas repetitivas e mantenha o foco no que importa: criar.",
    },
    {
      icon: Eraser,
      title: "Remoção de Marca D'água",
      desc: "Entregue projetos 100% limpos para seus clientes. Sem branding externo, sem identificação de terceiros — apenas a sua marca.",
    },
    {
      icon: MessageSquare,
      title: "Chat Ao Vivo (Anti-Créditos)",
      desc: "Envie comandos diretamente pelo chat oficial do Lovable. Nossa tecnologia intercepta as mensagens e processa tudo sem tocar nos créditos.",
    },
    {
      icon: Puzzle,
      title: "Sistema de Skills",
      desc: "Ative skills especialistas (SEO, Performance, UI/UX, Copy) ou crie as suas próprias. Transforme a IA num especialista em segundos.",
    },
  ];

  return (
    <section className="bg-deep border-b border-white/5 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 grid gap-6 md:grid-cols-2 md:items-end">
          <div>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-primary">
              Recursos Core
            </div>
            <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
              Tecnologia de elite para
              <br />
              performance absoluta.
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-white/50 md:text-right">
            Desenvolvemos a {brand.name} para ser o núcleo operacional
            <br className="hidden md:block" />
            do seu fluxo no Lovable. Sem ruído, apenas resultados.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => {
            const num = String(i + 1).padStart(2, "0");
            return (
              <FeatureCard
                key={it.title}
                icon={it.icon}
                title={it.title}
                desc={it.desc}
                num={num}
                index={i}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  num,
  index,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  num: string;
  index: number;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      style={{ ["--reveal-delay" as never]: `${index * 90}ms` }}
      className={`feature-card reveal-rise ${visible ? "is-visible" : ""} group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.015] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-white/[0.03] hover:shadow-[0_24px_60px_-24px_rgba(239,68,68,0.35)]`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative mb-6 flex items-start justify-between">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-[0_0_20px_oklch(0.63_0.245_25/0.2)] transition-transform duration-300 group-hover:scale-110">
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-display text-2xl font-black text-white/10 transition-colors duration-300 group-hover:text-primary/30">
          {num}
        </span>
      </div>
      <h3 className="relative font-display text-lg font-bold">{title}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-white/55">{desc}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. PLANOS                                                           */
/* ------------------------------------------------------------------ */

function Plans() {
  const getPlans = getPublicPlans;
  const plansQuery = useQuery({
    queryKey: ["plans", "public"],
    queryFn: () => getPlans(),
    retry: 1,
  });
  const plans = plansQuery.data ?? EMPTY_PLANS;

  const [checkoutPlan, setCheckoutPlan] = useState<{
    slug: string;
    name: string;
    price_cents: number;
  } | null>(null);

  function sendToSignup(planSlug: string) {
    if (typeof window !== "undefined") {
      savePendingCheckout(planSlug);
    }
    const search = new URLSearchParams({
      next: `/?checkout=${planSlug}#plans`,
      plan: planSlug,
      tab: "signup",
    });
    window.location.assign(`/auth?${search.toString()}`);
  }

  async function handleSubscribe(plan: { slug: string; name: string; price_cents: number }) {
    try {
      // getSession é local (sem rede) — evita falsos negativos que mandavam o
      // usuário logado para /auth e faziam o ping-pong de volta para os planos.
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) {
        setCheckoutPlan(plan);
        return;
      }
      toast.info("Crie sua conta para comprar — sua chave fica salva no painel.");
      sendToSignup(plan.slug);
    } catch {
      sendToSignup(plan.slug);
    }
  }

  // Auto-abre o checkout ao voltar da verificação de email (?checkout=<slug>)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let processing = false;
    let opened = false;
    const params = new URLSearchParams(window.location.search);
    const urlSlug = params.get("checkout");
    const hasAuthCallback = hasEmailConfirmationParams();
    // Só considera storage se houve intenção explícita, para o link puro abrir no topo.
    const hasIntent = !!urlSlug || window.location.hash === "#plans" || hasAuthCallback;
    const slug = urlSlug ?? (hasIntent ? readPendingCheckout() : null);
    if (!slug) {
      // limpa storage stale para não afetar futuras aberturas puras do site
      clearPendingCheckout();
      return;
    }
    if (!plans) return;
    const plan = plans.find((p) => p.slug === slug);
    if (!plan || plan.price_cents === 0) return;
    const openCheckout = async () => {
      if (processing || opened || cancelled) return;
      processing = true;
      const user = await waitForVerifiedCheckoutUser(urlSlug || hasAuthCallback ? 28 : 2);
      processing = false;
      if (!user || cancelled || opened) return;
      opened = true;
      clearPendingCheckout();
      // limpa o query param sem recarregar
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      url.searchParams.delete("code");
      url.searchParams.delete("token_hash");
      url.searchParams.delete("type");
      // Se veio do fluxo de verificação, força a seção de planos e remove tokens do endereço.
      window.history.replaceState({}, "", url.pathname + url.search + "#plans");
      requestAnimationFrame(() => {
        document.getElementById("plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
        setCheckoutPlan({ slug: plan.slug, name: plan.name, price_cents: plan.price_cents });
      });
    };

    finishEmailConfirmationFromUrl().then(openCheckout);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || cancelled) return;
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        openCheckout();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [plans]);

  const highlightSlug = "monthly";

  return (
    <section id="plans" className="bg-panel scroll-mt-20 border-b border-white/5 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-primary">
            Planos
          </div>
          <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            Escolha o plano que combina
            <br />
            com <span className="text-gradient-red">seu ritmo.</span>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plansQuery.isLoading ? (
            <Card className="p-8 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
              Carregando planos…
            </Card>
          ) : plansQuery.isError ? (
            <QueryErrorState
              error={plansQuery.error}
              title="Não foi possível carregar os planos"
              onRetry={() => void plansQuery.refetch()}
              isRetrying={plansQuery.isFetching}
              className="md:col-span-2 lg:col-span-3"
            />
          ) : plans.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
              Nenhum plano está disponível no momento.
            </Card>
          ) : (
            plans.slice(0, 6).map((plan, idx) => {
              const highlight = plan.slug === highlightSlug;
              const features = (plan.features as string[]) ?? [];
              const isLifetime = plan.slug === "lifetime";
              const durationLabel = plan.duration_minutes
                ? `${plan.duration_minutes} min`
                : isLifetime
                  ? "Vitalício"
                  : `${plan.duration_days} ${plan.duration_days === 1 ? "dia" : "dias"}`;
              return (
                <PlanCard
                  key={plan.id}
                  index={idx}
                  highlight={highlight}
                  durationLabel={durationLabel}
                  maxDevices={plan.max_devices}
                  name={plan.name}
                  priceCents={plan.price_cents}
                  description={plan.description}
                  features={features}
                  actionSlot={
                    plan.slug === "trial" ? (
                      <Link
                        to="/auth"
                        search={{ claim: "trial" } as any}
                        className={`${highlight ? "btn-glossy-red" : "btn-glossy-dark"} inline-flex h-12 w-full items-center justify-center rounded-full text-xs font-bold uppercase tracking-widest text-white transition`}
                      >
                        Testar grátis
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleSubscribe({
                            slug: plan.slug,
                            name: plan.name,
                            price_cents: plan.price_cents,
                          })
                        }
                        className={`${highlight ? "btn-glossy-red" : "btn-glossy-dark"} inline-flex h-12 w-full items-center justify-center rounded-full text-xs font-bold uppercase tracking-widest text-white transition`}
                      >
                        Assinar com Pix
                      </button>
                    )
                  }
                />
              );
            })
          )}
        </div>
      </div>

      <PixCheckoutDialog
        plan={checkoutPlan}
        open={!!checkoutPlan}
        onOpenChange={(v) => !v && setCheckoutPlan(null)}
      />
    </section>
  );
}

function PlanCard({
  index,
  highlight,
  durationLabel,
  maxDevices,
  name,
  priceCents,
  description,
  features,
  actionSlot,
}: {
  index: number;
  highlight: boolean;
  durationLabel: string;
  maxDevices: number;
  name: string;
  priceCents: number;
  description: string | null;
  features: string[];
  actionSlot: React.ReactNode;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      style={{ ["--reveal-delay" as never]: `${index * 80}ms` }}
      className={`plan-card reveal-rise ${visible ? "is-visible" : ""} ${highlight ? "plan-card--highlight" : ""} flex flex-col p-8`}
    >
      <span className="plan-top-glow" />
      {highlight && <span className="plan-ribbon">Mais popular</span>}

      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
        {durationLabel}
        {" · "}
        {maxDevices} disp.
      </div>
      <h3 className="font-display text-2xl font-extrabold">{name}</h3>

      <div className="my-6 flex items-baseline gap-1">
        {priceCents === 0 ? (
          <span className="font-display text-5xl font-black">Grátis</span>
        ) : (
          <>
            <span className="text-sm font-bold text-white/60">R$</span>
            <span className="font-display text-5xl font-black tracking-tight">
              {formatPrice(priceCents).replace(/^R\$\s?/, "")}
            </span>
          </>
        )}
      </div>

      {description && <p className="mb-6 text-sm text-white/55">{description}</p>}

      <ul className="mb-8 flex-1 space-y-2.5 text-sm">
        <li className="flex items-center gap-2.5">
          <span className="plan-check">
            <Check className="h-3 w-3" />
          </span>
          Acesso ilimitado
        </li>
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2.5">
            <span className="plan-check">
              <Check className="h-3 w-3" />
            </span>
            {FEATURE_LABEL[f] ?? f}
          </li>
        ))}
      </ul>

      {actionSlot}
    </div>
  );
}

const FEATURE_LABEL: Record<string, string> = {
  unlimited: "Recursos ilimitados",
  key_daily: "Chaves diárias",
  key_weekly: "Chaves semanais",
  key_monthly: "Chaves mensais",
};

/* ------------------------------------------------------------------ */
/* 5. CTA FINAL                                                        */
/* ------------------------------------------------------------------ */

function FinalCTA() {
  const brand = useBranding();
  return (
    <section className="bg-band py-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="cta-card text-center">
          <span className="cta-led-top" />
          <span className="cta-led-bottom" />
          <span className="cta-corner cta-corner-tl" />
          <span className="cta-corner cta-corner-br" />

          <div className="chip-neon mb-8 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-primary dot-pulse" />
            Última chamada
          </div>

          <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Pare de queimar créditos.
            <br />
            <span className="text-gradient-red">Comece a dominar.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-white/60 md:text-base">
            Chega de ver seus créditos acabarem no meio de um projeto. Instale a extensão, escolha
            seu plano e continue criando sem se preocupar com limites.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#plans"
              className="btn-neon group inline-flex h-14 items-center gap-2 rounded-2xl px-8 text-sm font-bold uppercase tracking-wider text-white"
            >
              Ativar {brand.name} agora
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#plans"
              className="inline-flex h-14 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10"
            >
              Ver todos os planos
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] font-bold uppercase tracking-widest text-white/50">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary dot-pulse" />
              Suporte humano
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary dot-pulse" />
              Fácil de instalar
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary dot-pulse" />
              Acesso imediato
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FOOTER                                                              */
/* ------------------------------------------------------------------ */

function SupportCTA() {
  const href =
    "https://wa.me/5561992039398?text=Ol%C3%A1%21%20Tudo%20bem%3F%20Tenho%20algumas%20d%C3%BAvidas%20sobre%20a%20extens%C3%A3o.%20Pode%20me%20ajudar%2C%20por%20favor%3F";
  return (
    <section className="border-t border-white/5 bg-gradient-to-b from-black to-black/60 py-16">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-[0_0_40px_oklch(0.63_0.245_25/0.35)]">
          <LifeBuoy className="h-7 w-7" />
        </span>
        <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Ficou com <span className="text-gradient-red">dúvidas?</span>
        </h2>
        <p className="max-w-xl text-sm text-white/60 md:text-base">
          Fale direto com o nosso suporte no WhatsApp. Respondemos rápido e ajudamos você a
          instalar, ativar e tirar o máximo da extensão.
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-neon inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-sm font-bold text-white"
        >
          <LifeBuoy className="h-4 w-4" />
          Falar com o Suporte
        </a>
      </div>
    </section>
  );
}

function Footer() {
  const brand = useBranding();
  return (
    <footer className="border-t border-white/5 bg-black py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-white/40 md:flex-row">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary to-primary/60 shadow-[0_0_24px_oklch(0.63_0.245_25/0.55)]">
            <img src={brand.logoUrl} alt={brand.logoAlt} className="h-full w-full object-cover" />
          </span>
          <span className="font-display text-sm font-semibold tracking-tight text-white">
            {brand.displayFirst} <span className="text-gradient-red">{brand.displaySecond}</span>
          </span>
          <span className="ml-2">© {new Date().getFullYear()}</span>
        </Link>
        <div className="flex items-center gap-6">
          <a href="/#plans" className="hover:text-white">
            Planos
          </a>
          <Link to="/auth" className="hover:text-white">
            Entrar
          </Link>
        </div>
      </div>
    </footer>
  );
}
