import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Bot, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.name} — Central de ofertas e afiliados` },
      { name: "description", content: BRAND.description },
      { property: "og:title", content: `${BRAND.name} — Central de ofertas e afiliados` },
      { property: "og:description", content: BRAND.description },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Sparkles,
    title: "Oferta Score",
    text: "Nota de 0 a 100 calculada só com dados reais: desconto, histórico, avaliação, vendas e comissão.",
  },
  {
    icon: Bot,
    title: "Copy automática",
    text: "Mensagens prontas por estilo e tamanho, com variáveis que somem quando não há dado.",
  },
  {
    icon: Zap,
    title: "Automações",
    text: "Regras por grupo, filtros por score, categoria e preço, com fila e agendamento.",
  },
  {
    icon: BarChart3,
    title: "Relatórios",
    text: "Cliques, vendas e comissões por grupo, marketplace e categoria.",
  },
  {
    icon: ShieldCheck,
    title: "Só canais oficiais",
    text: "WhatsApp Cloud API e Telegram Bot API. Nada de automação não autorizada.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            {BRAND.shortName}
          </span>
          <span className="text-sm font-semibold text-foreground">{BRAND.name}</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-5 pt-10 pb-14 text-center sm:pt-16">
        <span className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          Central de ofertas e afiliados
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          Encontre, pontue e publique as melhores ofertas em minutos
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          {BRAND.description} Multi-marketplace, com dados reais e integrações oficiais.
        </p>
        <div className="mt-7 flex justify-center">
          <Button asChild size="lg">
            <Link to="/auth">Criar conta grátis</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-5 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-5">
            <Icon className="size-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
