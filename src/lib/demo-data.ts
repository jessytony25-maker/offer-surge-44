import headphones from "@/assets/demo-headphones.jpg";
import sneakers from "@/assets/demo-sneakers.jpg";
import grinder from "@/assets/demo-grinder.jpg";
import smartwatch from "@/assets/demo-smartwatch.jpg";
import { computeOfferScore } from "./offer-score";

/**
 * MODO DEMO — dados de demonstração claramente identificados.
 * Nunca são apresentados como dados reais: toda tela que os usa exibe o selo
 * "DEMO" e some assim que o modo demo é desligado nas configurações.
 */

export interface DemoOffer {
  id: string;
  title: string;
  image: string;
  marketplace: string;
  category: string;
  previousPrice: number;
  price: number;
  discountPct: number;
  rating: number;
  ratingCount: number;
  salesCount: number;
  coupon: string | null;
  commission: number;
  commissionPct: number;
  freeShipping: boolean;
  available: boolean;
  originalUrl: string;
  affiliateUrl: string | null;
  score: number;
  status: "new" | "approved" | "rejected" | "published";
}

const base = [
  {
    id: "demo-1",
    title: "Fone Bluetooth ANC Pro Max",
    image: headphones,
    marketplace: "shopee",
    category: "eletronicos",
    previousPrice: 189.9,
    price: 89.9,
    rating: 4.8,
    ratingCount: 12340,
    salesCount: 12300,
    coupon: "ACHADO10",
    commissionPct: 12,
    freeShipping: true,
    status: "new" as const,
  },
  {
    id: "demo-2",
    title: "Tênis Casual Feminino Runner",
    image: sneakers,
    marketplace: "shein",
    category: "moda",
    previousPrice: 149.0,
    price: 79.9,
    rating: 4.6,
    ratingCount: 3120,
    salesCount: 3100,
    coupon: null,
    commissionPct: 9,
    freeShipping: false,
    status: "approved" as const,
  },
  {
    id: "demo-3",
    title: "Moedor de Café Elétrico Inox",
    image: grinder,
    marketplace: "mercadolivre",
    category: "cozinha",
    previousPrice: 320.0,
    price: 199.0,
    rating: 4.5,
    ratingCount: 860,
    salesCount: 860,
    coupon: "CAFE15",
    commissionPct: 7,
    freeShipping: true,
    status: "published" as const,
  },
  {
    id: "demo-4",
    title: "Smartwatch Fit Track 8",
    image: smartwatch,
    marketplace: "amazon",
    category: "eletronicos",
    previousPrice: 289.0,
    price: 239.0,
    rating: 4.2,
    ratingCount: 340,
    salesCount: 340,
    coupon: null,
    commissionPct: 5,
    freeShipping: false,
    status: "new" as const,
  },
];

export const DEMO_OFFERS: DemoOffer[] = base.map((item) => {
  const discountPct = Math.round(
    ((item.previousPrice - item.price) / item.previousPrice) * 100,
  );
  const { score } = computeOfferScore({
    discountPct,
    price: item.price,
    rating: item.rating,
    ratingCount: item.ratingCount,
    salesCount: item.salesCount,
    commissionPct: item.commissionPct,
    hasCoupon: Boolean(item.coupon),
    freeShipping: item.freeShipping,
    available: true,
  });
  return {
    ...item,
    discountPct,
    available: true,
    commission: Number(((item.price * item.commissionPct) / 100).toFixed(2)),
    originalUrl: `https://exemplo.${item.marketplace}.com/produto/${item.id}`,
    affiliateUrl: null,
    score,
  };
});

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const DEMO_SERIES = DAYS.map((day, i) => ({
  day,
  ofertas: [42, 58, 47, 71, 63, 88, 96][i],
  cliques: [320, 410, 380, 540, 470, 690, 812][i],
  vendas: [3, 5, 4, 8, 6, 11, 13][i],
  comissao: [86, 142, 118, 231, 176, 318, 402][i],
}));

export const DEMO_BY_MARKETPLACE = [
  { marketplace: "Shopee", comissao: 1240, cliques: 3820 },
  { marketplace: "Mercado Livre", comissao: 890, cliques: 2410 },
  { marketplace: "Amazon", comissao: 640, cliques: 1580 },
  { marketplace: "SHEIN", comissao: 470, cliques: 1100 },
];

export const DEMO_BY_GROUP = [
  { grupo: "Achadinhos Casa", publicacoes: 84, cliques: 2410, vendas: 18 },
  { grupo: "Tech em Oferta", publicacoes: 61, cliques: 1980, vendas: 14 },
  { grupo: "Moda & Beleza", publicacoes: 52, cliques: 1420, vendas: 9 },
];

export const DEMO_BY_CATEGORY = [
  { categoria: "Eletrônicos", valor: 1180 },
  { categoria: "Casa", valor: 940 },
  { categoria: "Moda", valor: 720 },
  { categoria: "Cozinha", valor: 400 },
];

export const DEMO_METRICS = {
  ofertasEncontradas: 1482,
  ofertasAprovadas: 342,
  ofertasPublicadas: 218,
  ofertasRejeitadas: 96,
  cliques: 8910,
  comissao: 3240.5,
  vendas: 61,
  conversao: 3.6,
};
