import { MARKETING_CONFIG } from "./content";

/**
 * wa.me deep link with a pre-filled message -- the format the WhatsApp product itself
 * documents (digits-only number, no "+"). Unlike mailto: links, this is a plain URL with no
 * "@"-shaped content for Cloudflare's tunnel-level email obfuscation to rewrite (the exact
 * bug MailtoButton.tsx exists to work around), so a plain anchor tag is safe here.
 */
export function getWhatsAppLink(prefilledText: string): string {
  return `https://wa.me/${MARKETING_CONFIG.whatsappNumber}?text=${encodeURIComponent(prefilledText)}`;
}
