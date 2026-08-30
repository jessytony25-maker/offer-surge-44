import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AffiliateLinkResolver } from "./AffiliateLinkResolver";

export const resolveAffiliateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        originalUrl: z.string().url("URL inválida"),
        marketplace: z.string().optional().nullable(),
        productId: z.string().optional().nullable(),
        offerId: z.string().optional().nullable(),
        productTitle: z.string().optional().nullable(),
        subId: z.string().optional().nullable(),
        forceRefresh: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return AffiliateLinkResolver.resolve(context.supabase, {
      userId: context.userId,
      originalUrl: data.originalUrl,
      marketplace: data.marketplace || undefined,
      productId: data.productId || undefined,
      offerId: data.offerId || undefined,
      productTitle: data.productTitle || undefined,
      subId: data.subId || undefined,
      forceRefresh: data.forceRefresh ?? false,
    });
  });

export const listAffiliateLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("affiliate_links")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    return data || [];
  });
