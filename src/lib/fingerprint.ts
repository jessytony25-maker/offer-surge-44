/**
 * Detecção de duplicidade — normalização de URL e impressão digital da oferta.
 */

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
  "af_siteid",
  "sub_id",
  "subid",
  "tag",
  "smtt",
  "ref",
];

export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    url.hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    TRACKING_PARAMS.forEach((p) => url.searchParams.delete(p));
    const path = url.pathname.replace(/\/+$/, "");
    const query = url.searchParams.toString();
    return `${url.hostname}${path}${query ? `?${query}` : ""}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

export interface FingerprintInput {
  marketplace: string;
  productId?: string | null;
  sku?: string | null;
  url?: string | null;
  title?: string | null;
}

export function offerFingerprint(input: FingerprintInput): string {
  const key =
    input.productId?.trim() ||
    input.sku?.trim() ||
    (input.url ? normalizeUrl(input.url) : null) ||
    slug(input.title ?? "");
  return `${input.marketplace}:${key}`.slice(0, 240);
}

export function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface DuplicateSettings {
  /** Janela em horas na qual o mesmo produto não pode voltar à fila. */
  windowHours: number;
  /** Similaridade de título (0..1) acima da qual a oferta é considerada repetida. */
  titleSimilarity: number;
}

export const DEFAULT_DUPLICATE_SETTINGS: DuplicateSettings = {
  windowHours: 24,
  titleSimilarity: 0.9,
};

/** Similaridade simples por tokens (Jaccard) — usada para ofertas "muito parecidas". */
export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(slug(a).split("-").filter(Boolean));
  const tb = new Set(slug(b).split("-").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter += 1;
  });
  return inter / (ta.size + tb.size - inter);
}

export interface DuplicateCandidate {
  fingerprint?: string | null;
  title: string;
  created_at: string;
}

export function isDuplicate(
  candidate: { fingerprint?: string | null; title: string },
  existing: DuplicateCandidate[],
  settings: DuplicateSettings = DEFAULT_DUPLICATE_SETTINGS,
): { duplicate: boolean; reason?: string } {
  const cutoff = Date.now() - settings.windowHours * 3600_000;
  for (const item of existing) {
    if (new Date(item.created_at).getTime() < cutoff) continue;
    if (candidate.fingerprint && item.fingerprint === candidate.fingerprint) {
      return { duplicate: true, reason: "Mesmo produto já publicado na janela configurada" };
    }
    if (titleSimilarity(candidate.title, item.title) >= settings.titleSimilarity) {
      return { duplicate: true, reason: "Oferta muito semelhante a uma recente" };
    }
  }
  return { duplicate: false };
}
