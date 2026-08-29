import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { BRAND } from "@/lib/branding";
import { MARKETPLACE_ADAPTERS } from "@/integrations/marketplaces";
import { CHANNEL_CONNECTORS } from "@/integrations/channels";
import {
  listIntegrations,
  saveIntegration,
  disconnectIntegration,
} from "@/lib/integrations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title: `Integrações — ${BRAND.name}` },
      { name: "description", content: "Conecte marketplaces e canais oficiais de publicação." },
      { property: "og:title", content: `Integrações — ${BRAND.name}` },
      { property: "og:description", content: "Conecte marketplaces e canais oficiais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Integracoes,
});

type Kind = "marketplace" | "channel";

type Field = {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  help?: string;
};

/** Extrai matt_word / matt_tool de um link de afiliado do Mercado Livre. */
function extractMeliCredentials(raw: string): { matt_word?: string; matt_tool?: string } | null {
  try {
    const url = new URL(raw.trim());
    const word = url.searchParams.get("matt_word") ?? undefined;
    const tool = url.searchParams.get("matt_tool") ?? undefined;
    if (!word && !tool) return null;
    return { ...(word ? { matt_word: word } : {}), ...(tool ? { matt_tool: tool } : {}) };
  } catch {
    return null;
  }
}

type StatusRow = {
  provider: string;
  status: string;
  lastError: string | null;
  lastEventAt: string | null;
  filledKeys: string[];
};

const STATUS_LABEL: Record<string, string> = {
  not_configured: "Aguardando configuração",
  pending: "Credenciais salvas — em validação",
  connected: "Conectado",
  error: "Erro na conexão",
  disabled: "Desativado",
};

const STATUS_CLASS: Record<string, string> = {
  connected: "border-primary/40 bg-primary/10 text-primary",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  pending: "border-border bg-accent text-accent-foreground",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] ${
        STATUS_CLASS[status] ?? "border-border bg-muted text-muted-foreground"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function IntegrationCard({
  name,
  description,
  row,
  fields,
  docsUrl,
  onConfigure,
  onDisconnect,
}: {
  name: string;
  description: string;
  row?: StatusRow | undefined;
  fields: Field[];
  docsUrl?: string | undefined;
  onConfigure: () => void;
  onDisconnect: () => void;
}) {
  const status = row?.status ?? "not_configured";
  const missing = fields.filter((f) => f.required && !row?.filledKeys?.includes(f.key));
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{name}</h3>
        <StatusPill status={status} />
      </div>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{description}</p>

      {status !== "connected" && missing.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Falta informar: {missing.map((f) => f.label).join(", ")}.
        </p>
      )}
      {row?.lastError && <p className="mt-2 text-xs text-destructive">{row.lastError}</p>}
      {docsUrl && (
        <a
          href={docsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 text-xs text-primary underline underline-offset-2"
        >
          Onde obter as credenciais
        </a>
      )}

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={onConfigure}>
          {status === "not_configured" ? "Configurar" : "Editar credenciais"}
        </Button>
        {status !== "not_configured" && (
          <Button size="sm" variant="ghost" onClick={onDisconnect}>
            Desconectar
          </Button>
        )}
      </div>
    </div>
  );
}

function Integracoes() {
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listIntegrations);
  const save = useServerFn(saveIntegration);
  const remove = useServerFn(disconnectIntegration);

  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => fetchList(),
  });

  const [target, setTarget] = useState<{
    kind: Kind;
    provider: string;
    name: string;
    fields: Field[];
    filled: string[];
  } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [meliLink, setMeliLink] = useState("");

  const saveMutation = useMutation({
    mutationFn: (input: { kind: Kind; provider: string; credentials: Record<string, string> }) =>
      save({ data: input }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      setTarget(null);
      if (result.status === "connected") toast.success(result.message);
      else if (result.status === "error") toast.error(result.message);
      else toast.info(result.message);
    },
    onError: () => toast.error("Não consegui salvar as credenciais."),
  });

  const removeMutation = useMutation({
    mutationFn: (input: { kind: Kind; provider: string }) => remove({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integração desconectada.");
    },
  });

  const marketplaceRows = useMemo(
    () => new Map((data?.marketplaces ?? []).map((r) => [r.provider, r as StatusRow])),
    [data],
  );
  const channelRows = useMemo(
    () => new Map((data?.channels ?? []).map((r) => [r.provider, r as StatusRow])),
    [data],
  );

  const openDialog = (kind: Kind, provider: string, name: string, fields: Field[]) => {
    const row = kind === "marketplace" ? marketplaceRows.get(provider) : channelRows.get(provider);
    setValues({});
    setMeliLink("");
    setTarget({ kind, provider, name, fields, filled: row?.filledKeys ?? [] });
  };

  return (
    <AppShell title="Integrações" description="Marketplaces e canais oficiais">
      <p className="text-sm text-muted-foreground">
        Cada integração fica em “aguardando configuração” até você informar as credenciais oficiais
        do programa de afiliados ou da API do canal. As chaves ficam guardadas no backend e nunca
        são exibidas novamente.
      </p>

      <h2 className="mt-6 text-sm font-semibold text-foreground">Marketplaces</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.values(MARKETPLACE_ADAPTERS).map((a) => (
          <IntegrationCard
            key={a.slug}
            name={a.name}
            description={a.program}
            docsUrl={a.docsUrl}
            fields={a.credentialFields}
            row={marketplaceRows.get(a.slug)}
            onConfigure={() => openDialog("marketplace", a.slug, a.name, a.credentialFields)}
            onDisconnect={() =>
              removeMutation.mutate({ kind: "marketplace", provider: a.slug })
            }
          />
        ))}
      </div>

      <h2 className="mt-6 text-sm font-semibold text-foreground">Canais de publicação</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.values(CHANNEL_CONNECTORS)
          .filter((c) => c.platform !== "other")
          .map((c) => (
            <IntegrationCard
              key={c.platform}
              name={c.name}
              description={`${c.transport} — ${c.policyNote}`}
              fields={c.credentialFields}
              row={channelRows.get(c.platform)}
              onConfigure={() => openDialog("channel", c.platform, c.name, c.credentialFields)}
              onDisconnect={() =>
                removeMutation.mutate({ kind: "channel", provider: c.platform })
              }
            />
          ))}
      </div>

      {isLoading && <p className="mt-4 text-xs text-muted-foreground">Carregando status…</p>}

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar {target?.name}</DialogTitle>
            <DialogDescription>
              Informe as credenciais oficiais. Campos já salvos podem ficar em branco para manter o
              valor atual.
            </DialogDescription>
          </DialogHeader>

          {target?.provider === "mercadolivre" && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-[11px] text-muted-foreground">
                Cole aqui um link de afiliado que você gerou no Mercado Livre que o sistema extrai a
                Etiqueta e o ID da Ferramenta automaticamente.
              </p>
              <Input
                placeholder="Link completo de divulgação (…?matt_word=…&matt_tool=…)"
                value={meliLink}
                onChange={(e) => setMeliLink(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  const parsed = extractMeliCredentials(meliLink);
                  if (!parsed) {
                    toast.error(
                      "Não encontrei matt_word/matt_tool nesse link. Links curtos (meli.la) precisam ser abertos antes — use o link completo de divulgação.",
                    );
                    return;
                  }
                  setValues((prev) => ({
                    ...prev,
                    ...(parsed.matt_word ? { affiliate_id: parsed.matt_word } : {}),
                    ...(parsed.matt_tool ? { tracking_id: parsed.matt_tool } : {}),
                  }));
                  toast.success("Credenciais extraídas do link. Confira e salve.");
                }}
              >
                Extrair credenciais do link
              </Button>
            </div>
          )}

          <div className="space-y-3">
            {target?.fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={field.key} className="text-xs">
                  {field.label}
                  {target.filled.includes(field.key) && (
                    <span className="ml-2 text-[11px] text-muted-foreground">(já salvo)</span>
                  )}
                </Label>
                <Input
                  id={field.key}
                  type={field.secret ? "password" : "text"}
                  autoComplete="off"
                  maxLength={4096}
                  placeholder={target.filled.includes(field.key) ? "••••••••" : field.label}
                  value={values[field.key] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
                {field.help && (
                  <p className="text-[11px] text-muted-foreground">{field.help}</p>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={saveMutation.isPending}
              onClick={() =>
                target &&
                saveMutation.mutate({
                  kind: target.kind,
                  provider: target.provider,
                  credentials: values,
                })
              }
            >
              {saveMutation.isPending ? "Testando…" : "Salvar e testar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
