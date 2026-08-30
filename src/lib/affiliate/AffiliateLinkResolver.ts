import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MARKETPLACE_ADAPTERS,
  detectMarketplace,
  type MarketplaceSlug,
  type MarketplaceAdapter,
} from "@/integrations/marketplaces";

export interface ResolveAffiliateLinkParams {
  userId: string;
  originalUrl: string;
  marketplace?: MarketplaceSlug | string | null;
  productId?: string | null;
  offerId?: string | null;
  productTitle?: string | null;
  subId?: string | null;
  forceRefresh?: boolean;
}

export type AffiliateResolutionResult =
  | {
      ok: true;
      affiliateUrl: string;
      originalUrl: string;
      marketplace: MarketplaceSlug;
      program: string;
      method: string;
      isCached: boolean;
      auditLog: string;
    }
  | {
      ok: false;
      originalUrl: string;
      marketplace?: MarketplaceSlug | null;
      error: string;
      auditLog: string;
    };

/**
 * AffiliateLinkResolver — Motor central de geração, resolução e persistência
 * de Links de Afiliados Oficiais.
 *
 * Garante que:
 * - Toda oferta/publicação use o link de afiliado REAL e nunca o link comum.
 * - Links já gerados sejam armazenados e reutilizados para performance.
 * - Registro de auditoria completo (produto -> original -> método -> final).
 * - Tratamento de erro rigoroso quando o link não puder ser gerado.
 */
export class AffiliateLinkResolver {
  /**
   * Resolve o link de afiliado para uma URL/Oferta.
   */
  static async resolve(
    supabase: SupabaseClient,
    params: ResolveAffiliateLinkParams,
  ): Promise<AffiliateResolutionResult> {
    const {
      userId,
      originalUrl,
      productId,
      offerId,
      productTitle = "Produto",
      subId,
      forceRefresh = false,
    } = params;

    const cleanUrl = originalUrl?.trim();
    if (!cleanUrl) {
      return {
        ok: false,
        originalUrl: "",
        error: "URL original não fornecida.",
        auditLog: `[AFFILIATE_RESOLVER ERROR] URL original vazia.`,
      };
    }

    // 1. Identifica o marketplace da URL ou do parâmetro
    let adapter: MarketplaceAdapter | null = null;
    let marketplaceSlug: MarketplaceSlug | null = null;

    if (params.marketplace && MARKETPLACE_ADAPTERS[params.marketplace as MarketplaceSlug]) {
      marketplaceSlug = params.marketplace as MarketplaceSlug;
      adapter = MARKETPLACE_ADAPTERS[marketplaceSlug];
    } else {
      adapter = detectMarketplace(cleanUrl);
      if (adapter) {
        marketplaceSlug = adapter.slug;
      }
    }

    if (!adapter || !marketplaceSlug) {
      return {
        ok: false,
        originalUrl: cleanUrl,
        error: `Marketplace da URL "${cleanUrl}" não é suportado pelo sistema.`,
        auditLog: `[AFFILIATE_RESOLVER ERROR] Marketplace não identificado para: ${cleanUrl}`,
      };
    }

    // 2. Verifica se já existe link de afiliado válido salvo no banco para este usuário
    if (!forceRefresh) {
      const query = supabase
        .from("affiliate_links")
        .select("*")
        .eq("user_id", userId)
        .eq("marketplace", marketplaceSlug)
        .eq("original_url", cleanUrl);

      const { data: cached } = subId
        ? await query.eq("sub_id", subId).maybeSingle()
        : await query.is("sub_id", null).maybeSingle();

      if (cached && cached.affiliate_url && cached.affiliate_url !== cleanUrl) {
        // Atualiza last_used_at
        await supabase
          .from("affiliate_links")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", cached.id);

        const auditLog = `[AFFILIATE_RESOLVER CACHE] Produto: "${productTitle}" -> Link Original: ${cleanUrl} -> Método: ${cached.affiliate_program} (reutilizado) -> Link Final: ${cached.affiliate_url}`;

        return {
          ok: true,
          affiliateUrl: cached.affiliate_url,
          originalUrl: cleanUrl,
          marketplace: marketplaceSlug,
          program: cached.affiliate_program,
          method: cached.method || "cached",
          isCached: true,
          auditLog,
        };
      }
    }

    // 3. Busca credenciais de afiliado do usuário para o marketplace
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("credentials")
      .eq("user_id", userId)
      .eq("kind", "marketplace")
      .eq("provider", marketplaceSlug)
      .maybeSingle();

    const creds = (credRow?.credentials ?? {}) as Record<string, string>;

    // 4. Executa a geração oficial via adaptador
    const buildResult = await adapter.buildAffiliateLink(cleanUrl, creds, subId || undefined);

    if (!buildResult.ok) {
      const errorMsg = `Produto encontrado, mas não foi possível gerar o link de afiliado: ${buildResult.message}`;
      const auditLog = `[AFFILIATE_RESOLVER FAILED] Produto: "${productTitle}" -> Link Original: ${cleanUrl} -> Marketplace: ${marketplaceSlug} -> Erro: ${buildResult.message}`;

      // Registra log de erro na auditoria
      await supabase.from("audit_logs").insert({
        user_id: userId,
        channel: "affiliate_resolver",
        action: `resolve_${marketplaceSlug}_failed`,
        entity: "affiliate_link",
        meta: {
          productTitle,
          originalUrl: cleanUrl,
          marketplace: marketplaceSlug,
          error: buildResult.message,
        },
      });

      if (offerId) {
        await supabase
          .from("offers")
          .update({
            affiliate_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", offerId)
          .eq("user_id", userId);
      }

      return {
        ok: false,
        originalUrl: cleanUrl,
        marketplace: marketplaceSlug,
        error: errorMsg,
        auditLog,
      };
    }

    const affiliateUrl = buildResult.data;

    // 5. Salva o link de afiliado resolvido na tabela affiliate_links
    const now = new Date().toISOString();
    await supabase.from("affiliate_links").upsert(
      {
        user_id: userId,
        product_id: productId || null,
        offer_id: offerId || null,
        marketplace: marketplaceSlug,
        original_url: cleanUrl,
        affiliate_url: affiliateUrl,
        affiliate_program: adapter.program,
        method: adapter.slug,
        tracking_id: creds["tracking_id"] || creds["affiliate_id"] || null,
        sub_id: subId || null,
        last_used_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,marketplace,original_url,sub_id" as any },
    );

    // 6. Atualiza a oferta no banco se o offerId foi fornecido
    if (offerId) {
      await supabase
        .from("offers")
        .update({
          affiliate_url: affiliateUrl,
          affiliate_status: "resolved",
          updated_at: now,
        })
        .eq("id", offerId)
        .eq("user_id", userId);
    }

    // 7. Registra log de auditoria detalhado
    const auditLog = `[AFFILIATE_RESOLVER SUCCESS] Produto: "${productTitle}" -> Link Original: ${cleanUrl} -> Método: ${adapter.program} -> Link Final: ${affiliateUrl}`;

    await supabase.from("audit_logs").insert({
      user_id: userId,
      channel: "affiliate_resolver",
      action: `resolve_${marketplaceSlug}_success`,
      entity: "affiliate_link",
      meta: {
        productTitle,
        originalUrl: cleanUrl,
        affiliateUrl,
        marketplace: marketplaceSlug,
        program: adapter.program,
        subId: subId || null,
      },
    });

    return {
      ok: true,
      affiliateUrl,
      originalUrl: cleanUrl,
      marketplace: marketplaceSlug,
      program: adapter.program,
      method: adapter.slug,
      isCached: false,
      auditLog,
    };
  }
}
