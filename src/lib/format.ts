export const brl = (value?: number | null) =>
  typeof value === "number"
    ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

export const num = (value?: number | null) =>
  typeof value === "number" ? value.toLocaleString("pt-BR") : "—";

export const pct = (value?: number | null, digits = 1) =>
  typeof value === "number" ? `${value.toFixed(digits).replace(".", ",")}%` : "—";

export const rating = (value?: number | null) =>
  typeof value === "number" ? value.toFixed(1).replace(".", ",") : "—";

export const dateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const dayLabel = (value: Date) =>
  value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

export const nowLabel = () =>
  new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
