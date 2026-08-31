import type { SupabaseClient } from "@supabase/supabase-js";
import { MARKETPLACE_ADAPTERS, type MarketplaceSlug } from "@/integrations/marketplaces";
import { computeOfferScore } from "@/lib/offer-score";
import { AffiliateLinkResolver } from "@/lib/affiliate/AffiliateLinkResolver";

export interface SyncExecutionResult {
  marketplace: string;
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  itemsFound: number;
  itemsImported: number;
  itemsUpdated: number;
  itemsSkipped: number;
  errorCount: number;
  lastError: string | null;
}

export class MarketplaceSyncEngine {
  /**
   * Sincroniza um único marketplace de forma isolada e robusta.
   */
  static async sync(
    supabase: SupabaseClient,
    userId: string,
    marketplaceSlug: MarketplaceSlug,
  ): Promise<SyncExecutionResult> {
    const startedAt = new Date().toISOString();
    const adapter = MARKETPLACE_ADAPTERS[marketplaceSlug];

    const result: SyncExecutionResult = {
      marketplace: marketplaceSlug,
      ok: false,
      startedAt,
      finishedAt: "",
      itemsFound: 0,
      itemsImported: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
      errorCount: 0,
      lastError: null,
    };

    if (!adapter) {
      result.finishedAt = new Date().toISOString();
      result.lastError = "Adaptador de marketplace não localizado.";
      return result;
    }

    let logId: string | undefined = undefined;

    try {
      // 1. Criar registro inicial de log de sincronização (Status: running)
      const { data: logRow, error: logError } = await supabase
        .from("marketplace_sync_logs")
        .insert({
          user_id: userId,
          marketplace: marketplaceSlug,
          started_at: startedAt,
          status: "running",
        })
        .select("id")
        .maybeSingle();

      logId = logRow?.id;

      // 2. Obter credenciais salvas do usuário para esse marketplace
      const { data: credRow } = await supabase
        .from("integration_credentials")
        .select("credentials")
        .eq("user_id", userId)
        .eq("kind", "marketplace")
        .eq("provider", marketplaceSlug)
        .maybeSingle();

      const credentials = (credRow?.credentials ?? {}) as Record<string, string>;

      // Se for Amazon e a PA-API não estiver disponível (sem chaves), não executa busca automática
      if (marketplaceSlug === "amazon" && (!credentials.api_key || !credentials.api_secret)) {
        const finishedAt = new Date().toISOString();
        result.finishedAt = finishedAt;
        result.lastError = "PA-API 5.0 qualificada não disponível.";
        result.errorCount = 1;

        // Atualiza status da conexão no painel como "limited"
        await supabase.from("marketplace_connections").upsert(
          {
            user_id: userId,
            marketplace: marketplaceSlug,
            status: "limited",
            last_error: "PA-API 5.0 qualificada não disponível.",
            updated_at: finishedAt,
          },
          { onConflict: "user_id,marketplace" },
        );

        // Registra o log de sincronização como "limited"
        if (logId) {
          await supabase
            .from("marketplace_sync_logs")
            .update({
              finished_at: finishedAt,
              status: "limited",
              last_error: "PA-API 5.0 qualificada não disponível.",
              error_count: 1,
            })
            .eq("id", logId);
        }

        return result;
      }

      // 3. Chamar a sincronização oficial do adaptador
      const syncResult = await adapter.syncOffers(credentials);

      if (!syncResult.ok) {
        // Falha ou indisponibilidade na sincronização da plataforma
        const finishedAt = new Date().toISOString();
        result.finishedAt = finishedAt;
        result.lastError = syncResult.message;
        result.errorCount = 1;

        // Atualiza status da conexão
        await supabase.from("marketplace_connections").upsert(
          {
            user_id: userId,
            marketplace: marketplaceSlug,
            status: syncResult.state || "error",
            last_error: syncResult.message,
            updated_at: finishedAt,
          },
          { onConflict: "user_id,marketplace" },
        );

        // Atualiza log de sincronização para erro
        if (logId) {
          await supabase
            .from("marketplace_sync_logs")
            .update({
              finished_at: finishedAt,
              status: "error",
              last_error: syncResult.message,
              error_count: 1,
            })
            .eq("id", logId);
        }

        return result;
      }

      // Sincronização executada com sucesso
      const syncReport = syncResult.data;
      result.itemsFound = syncReport.found;
      result.itemsSkipped = syncReport.skipped;
      result.errorCount = syncReport.errors.length;
      if (syncReport.errors.length > 0) {
        result.lastError = syncReport.errors[0] || null;
      }

      // Processar cada produto retornado
      const now = new Date().toISOString();
      for (const p of syncReport.products) {
        try {
          // A. Deduplicação & Upsert no catálogo de produtos
          const { data: prodData } = await supabase
            .from("products")
            .upsert(
              {
                user_id: userId,
                marketplace: marketplaceSlug,
                external_id: p.externalId,
                title: p.title,
                image_url: p.imageUrl,
                url: p.url,
                price: p.price,
                rating: p.rating,
                sales_count: p.salesCount,
                updated_at: now,
              },
              { onConflict: "user_id,marketplace,external_id" as any },
            )
            .select("id")
            .maybeSingle();

          const productId = prodData?.id;

          // B. Obter/Resolver link de afiliado oficial real
          let finalAffiliateUrl = p.affiliateUrl || p.url || "";
          let affiliateStatus: "resolved" | "pending" | "failed" = "pending";

          if (p.url) {
            const resolved = await AffiliateLinkResolver.resolve(supabase, {
              userId,
              originalUrl: p.url,
              marketplace: marketplaceSlug,
              productId,
              productTitle: p.title,
            });

            if (resolved.ok) {
              finalAffiliateUrl = resolved.affiliateUrl;
              affiliateStatus = "resolved";
            } else {
              affiliateStatus = "failed";
              result.errorCount++;
              result.lastError = resolved.error;
            }
          }

          // C. Calcular Offer Score
          const scoreResult = computeOfferScore({
            discountPct: p.discountPct ?? undefined,
            price: p.price,
            rating: p.rating ?? undefined,
            salesCount: p.salesCount ?? undefined,
            commissionPct: p.commissionPct ?? undefined,
            freeShipping: p.freeShipping,
            available: p.available,
          });

          // D. Verificar se oferta já existe para incrementar ou atualizar
          const { data: existingOffer } = await supabase
            .from("offers")
            .select("id")
            .eq("user_id", userId)
            .eq("marketplace", marketplaceSlug)
            .eq("title", p.title)
            .maybeSingle();

          const isUpdate = Boolean(existingOffer);

          // E. Upsert na tabela de ofertas
          const { data: offerData, error: offerError } = await supabase
            .from("offers")
            .upsert(
              {
                user_id: userId,
                product_id: productId || null,
                marketplace: marketplaceSlug,
                external_product_id: p.externalId,
                title: p.title,
                image_url: p.imageUrl,
                price: p.price,
                previous_price: p.previousPrice,
                discount_pct: p.discountPct || 0,
                rating: p.rating,
                sales_count: p.salesCount,
                review_count: p.reviewCount || p.ratingCount || null,
                commission: p.commission,
                commission_pct: p.commissionPct,
                free_shipping: p.freeShipping || false,
                available: p.available ?? true,
                original_url: p.url,
                affiliate_url: finalAffiliateUrl,
                affiliate_status: affiliateStatus,
                score: scoreResult.score,
                status: isUpdate ? "approved" : "new",
                source: "sync",
                synced_at: now,
                updated_at: now,
              },
              { onConflict: "user_id,marketplace,title" as any },
            )
            .select("id")
            .maybeSingle();

          if (offerError) {
            result.errorCount++;
            result.lastError = `Falha ao salvar oferta "${p.title}": ${offerError.message}`;
            continue;
          }

          if (isUpdate) {
            result.itemsUpdated++;
          } else {
            result.itemsImported++;
          }

          // F. Salvar Snapshot no Histórico de Preços
          if (productId || offerData?.id) {
            await supabase.from("offer_price_history").insert({
              user_id: userId,
              product_id: productId || null,
              offer_id: offerData?.id || null,
              marketplace: marketplaceSlug,
              price: p.price,
              promo_price: p.price,
              original_price: p.previousPrice,
              coupon: p.coupon || null,
              free_shipping: p.freeShipping || false,
              available: p.available ?? true,
              captured_at: now,
            });
          }
        } catch (err: any) {
          result.errorCount++;
          result.lastError = `Erro ao processar item: ${err.message}`;
        }
      }

      // Finalização com sucesso
      const finishedAt = new Date().toISOString();
      result.finishedAt = finishedAt;
      result.ok = result.errorCount === 0;

      const finalStatus =
        result.errorCount === 0
          ? "completed"
          : result.itemsImported + result.itemsUpdated > 0
            ? "partial_success"
            : "error";

      // 4. Atualizar log de sincronização finalizado
      if (logId) {
        await supabase
          .from("marketplace_sync_logs")
          .update({
            finished_at: finishedAt,
            status: finalStatus,
            items_found: result.itemsFound,
            items_imported: result.itemsImported,
            items_updated: result.itemsUpdated,
            items_skipped: result.itemsSkipped,
            error_count: result.errorCount,
            last_error: result.lastError,
          })
          .eq("id", logId);
      }

      // Atualiza status da conexão no painel
      await supabase.from("marketplace_connections").upsert(
        {
          user_id: userId,
          marketplace: marketplaceSlug,
          status: "connected",
          last_sync_at: finishedAt,
          last_error: result.lastError,
          updated_at: finishedAt,
        },
        { onConflict: "user_id,marketplace" },
      );
    } catch (err: any) {
      const finishedAt = new Date().toISOString();
      result.finishedAt = finishedAt;
      result.lastError = `Falha crítica na engine: ${err.message}`;
      result.errorCount++;

      if (logId) {
        await supabase
          .from("marketplace_sync_logs")
          .update({
            finished_at: finishedAt,
            status: "error",
            last_error: err.message,
            error_count: 1,
          })
          .eq("id", logId);
      }
    }

    return result;
  }
}
