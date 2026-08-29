/**
 * MODO "COPIAR E PUBLICAR" (WhatsApp)
 *
 * A API oficial do WhatsApp (Cloud API) não envia mensagens para grupos e não
 * expõe a lista de grupos da conta. Por isso o fluxo suportado é assistido:
 * a plataforma gera a mensagem pronta e o usuário publica no grupo com um
 * toque, usando o próprio WhatsApp (app ou Web).
 */

/** Link universal que abre o WhatsApp com o texto já preenchido. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Compartilhamento nativo no celular (Web Share API), com fallback. */
export async function shareText(text: string): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ text });
      return "shared";
    } catch {
      // usuário cancelou ou não suportado — cai no clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
