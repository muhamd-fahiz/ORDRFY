import Image from "next/image";

type LogoTone = "on-ink" | "on-paper" | "on-pink";
type LogoSize = "sm" | "md";

interface LogoProps {
  /** "lockup" = mark + wordmark (product surfaces, site header). "wordmark" = text only,
   *  optionally with the tagline (marketing, site footer, slip footer). See the logo
   *  handoff's "approved lock-ups" (public/logo-mark.svg's design_handoff source). */
  variant?: "lockup" | "wordmark";
  /** Which background this sits on -- determines wordmark color and full-stop color. */
  tone?: LogoTone;
  size?: LogoSize;
  /** Only meaningful with variant="wordmark" -- adds the "CHATS IN. ORDERS OUT." lockup. */
  tagline?: boolean;
  className?: string;
}

const WORDMARK_TEXT_CLASS: Record<LogoTone, string> = {
  "on-ink": "text-paper",
  "on-paper": "text-ink",
  "on-pink": "text-paper-warm",
};

const STOP_CLASS: Record<LogoTone, string> = {
  "on-ink": "text-pink",
  "on-paper": "text-pink",
  // The one exception in the spec: on a pink background, the full stop flips to ink so it
  // still reads as an accent rather than disappearing into the fill.
  "on-pink": "text-ink",
};

const WORDMARK_SIZE_CLASS: Record<LogoSize, string> = {
  sm: "text-xs",
  md: "text-[19px]",
};

const TAGLINE_TONE_CLASS: Record<LogoTone, string> = {
  "on-ink": "text-paper/60",
  "on-paper": "text-ink/50",
  "on-pink": "text-paper-warm/75",
};

const DIVIDER_TONE_CLASS: Record<LogoTone, string> = {
  "on-ink": "bg-paper/20",
  "on-paper": "bg-ink/15",
  "on-pink": "bg-paper-warm/40",
};

/**
 * The one place the Ordrfy wordmark/mark is drawn -- every surface (marketing header/footer
 * today; the owner app and admin nav could adopt this too, see CLAUDE.md) renders the same
 * component instead of re-styling "ordrfy." text independently. Text-based, not the SVG mark
 * asset, for the wordmark itself: the logotype is literally styled type in the design spec
 * (Unbounded 800, -3.5% tracking), so real text stays crisp and accessible rather than
 * rasterizing it. The square mark (public/logo-mark.svg) is the separate icon-style asset for
 * contexts that need a fixed-aspect glyph (favicons, profile pictures).
 */
export function Logo({ variant = "lockup", tone = "on-ink", size = "md", tagline = false, className = "" }: LogoProps) {
  const wordmark = (
    <span className={`font-display font-extrabold leading-none tracking-[-0.03em] ${WORDMARK_SIZE_CLASS[size]} ${WORDMARK_TEXT_CLASS[tone]}`}>
      ordrfy<span className={STOP_CLASS[tone]}>.</span>
    </span>
  );

  if (variant === "wordmark") {
    if (!tagline) return <span className={className}>{wordmark}</span>;
    return (
      <span className={`flex items-center gap-3.5 ${className}`}>
        {wordmark}
        <span className={`h-[17px] w-px ${DIVIDER_TONE_CLASS[tone]}`} />
        <span className={`font-data text-[11px] font-bold tracking-[0.1em] ${TAGLINE_TONE_CLASS[tone]}`}>CHATS IN. ORDERS OUT.</span>
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Image src="/logo-mark.svg" alt="" aria-hidden="true" width={30} height={30} className="h-[30px] w-[30px] rounded-[7px]" priority />
      {wordmark}
    </span>
  );
}
