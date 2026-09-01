"use client";

interface MailtoButtonProps {
  subject: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Deliberately does NOT render a literal "mailto:" string into the server HTML at all --
 * assembled and navigated to only on click. Found the hard way: Cloudflare's free tunnel
 * (trycloudflare.com) runs "Email Address Obfuscation" at the edge, which rewrites any
 * mailto: link server-rendered into the HTML before it reaches the browser. That rewrite
 * changes the DOM enough to break React hydration for the whole page -- confirmed live
 * (fetched the raw response through the tunnel and found Cloudflare's own __cf_email__
 * markers in it). A plain <a href="mailto:..."> has nothing to rewrite if the string never
 * exists in the HTML Cloudflare's edge actually sees.
 */
export function MailtoButton({ subject, className, children }: MailtoButtonProps) {
  function handleClick() {
    const address = ["hello", "ordrfy.in"].join("@");
    window.location.href = `mailto:${address}?subject=${encodeURIComponent(subject)}`;
  }

  return (
    <button type="button" onClick={handleClick} className={`w-full cursor-pointer appearance-none ${className ?? ""}`}>
      {children}
    </button>
  );
}
