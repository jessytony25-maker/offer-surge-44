/**
 * Tipos centrais do sistema de integrações de marketplaces.
 *
 * Cada adapter implementa somente os métodos realmente suportados
 * pela plataforma e declara honestamente suas capacidades.
 */

export type MarketplaceSlug = "shopee" | "mercadolivre" | "amazon" | "shein";

/** Estados completos de uma integração */
export type IntegrationState =
  | "not_configured" // Sem credenciais
  | "connecting"     // Testando conexão
  | "connected"      // Credenciais validadas
  | "syncing"        // Sincronização em andamento
  | "synced"         // Última sincronização concluída com sucesso
  | "error"          // Erro na última operação
  | "expired";       // Credenciais expiradas

/** Nível de suporte de uma capacidade */
export type CapabilityLevel =
  | "full"        // Totalmente suportado
  | "partial"     // Suportado com limitações
  | "link_only"   // Apenas conversão de links, sem dados de catálogo
  | "manual"      // Requer ação manual do usuário
  | "unavailable"; // Não disponível para esta conta/plataforma

export interface CapabilityInfo {
  supported: boolean;
  level: CapabilityLevel;
  reason?: string; // Explicação quando não disponível ou parcial
}

export interface CredentialField {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  help?: string;
  placeholder?: string;
}

export interface NormalizedProduct {
  externalId: string;
  title: string;
  imageUrl?: string | null;
  url?: string | null;
  affiliateUrl?: string | null;
  affiliateStatus: "resolved" | "pending" | "failed";
  sku?: string | null;
  category?: string | null;
  source: MarketplaceSlug;
  price: number;
  previousPrice?: number | null;
  discountPct?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  reviewCount?: number | null;
  salesCount?: number | null;
  coupon?: string | null;
  commission?: number | null;
  commissionPct?: number | null;
  freeShipping?: boolean;
  available?: boolean;
  syncedAt?: string;
}

export type AdapterResult<T> =
  | { ok: true; data: T }
  | { ok: false; state: IntegrationState; message: string };

export interface SearchParams {
  keyword?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  page?: number;
}

export interface SyncReport {
  found: number;
  imported: number;
  skipped: number;
  errors: string[];
  products: NormalizedProduct[];
}

export interface MarketplaceCapabilities {
  searchProducts: CapabilityInfo;
  listOffers: CapabilityInfo;
  productDetails: CapabilityInfo;
  affiliateLinkGeneration: CapabilityInfo;
  priceData: CapabilityInfo;
  imageData: CapabilityInfo;
  availabilityData: CapabilityInfo;
  autoSync: CapabilityInfo;
}

export interface MarketplaceAdapter {
  slug: MarketplaceSlug;
  name: string;
  program: string;
  docsUrl?: string;
  credentialFields: CredentialField[];

  /**
   * Capacidades estáticas do adapter (declaradas pelo adapter, não dependem de credenciais).
   */
  capabilities: MarketplaceCapabilities;

  /**
   * Identifica URL como pertencente a este marketplace.
   */
  matchesUrl(url: string): boolean;

  /**
   * Testa a conexão REAL com o marketplace.
   */
  testConnection(
    credentials: Record<string, string>,
  ): Promise<AdapterResult<{ message: string; details?: string }>>;

  /**
   * Busca produtos por palavra-chave.
   */
  searchProducts(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<NormalizedProduct[]>>;

  /**
   * Lista ofertas em destaque / mais vendidos.
   */
  listOffers(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<NormalizedProduct[]>>;

  /**
   * Busca dados de um produto específico pelo ID externo.
   */
  getProduct(
    externalId: string,
    credentials: Record<string, string>,
  ): Promise<AdapterResult<NormalizedProduct>>;

  /**
   * Gera o link de afiliado REAL para uma URL de produto.
   */
  buildAffiliateLink(
    originalUrl: string,
    credentials: Record<string, string>,
    subId?: string,
  ): Promise<AdapterResult<string>>;

  /**
   * Sincroniza ofertas completo.
   */
  syncOffers(
    credentials: Record<string, string>,
    params?: SearchParams,
  ): Promise<AdapterResult<SyncReport>>;
}

// ─── Helpers ───────────────────────────────────────────────

export function notConfigured<T>(name: string, field?: string): AdapterResult<T> {
  return {
    ok: false,
    state: "not_configured",
    message: field
      ? `Integração ${name} aguardando configuração: campo "${field}" obrigatório.`
      : `Integração ${name} não configurada — preencha as credenciais obrigatórias.`,
  };
}

export function notSupported<T>(name: string, reason: string): AdapterResult<T> {
  return {
    ok: false,
    state: "error",
    message: `[${name}] Recurso não disponível: ${reason}`,
  };
}

export const CAP_UNAVAILABLE = (reason: string): CapabilityInfo => ({
  supported: false,
  level: "unavailable",
  reason,
});

export const CAP_FULL: CapabilityInfo = { supported: true, level: "full" };

export const CAP_LINK_ONLY = (reason?: string): CapabilityInfo => ({
  supported: true,
  level: "link_only",
  reason,
});

export const CAP_MANUAL = (reason?: string): CapabilityInfo => ({
  supported: true,
  level: "manual",
  reason,
});
