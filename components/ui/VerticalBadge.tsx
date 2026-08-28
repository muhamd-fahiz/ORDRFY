import { VERTICAL_META, type VerticalKey } from "@/lib/design/verticals";

interface VerticalBadgeProps {
  vertical: VerticalKey;
  /** "dot" for a compact inline marker, "icon" for the fuller icon-in-a-tile treatment. */
  variant?: "dot" | "icon";
}

// The one place a vertical's accent color/icon gets chosen -- a lookup by key, never a
// switch/if-chain in a screen component (Non-Negotiable Architecture Rule 1: vertical
// differences live in data, not in shared-engine or UI branching).
export function VerticalBadge({ vertical, variant = "dot" }: VerticalBadgeProps) {
  const meta = VERTICAL_META[vertical];
  const Icon = meta.icon;

  if (variant === "dot") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${meta.dotClass}`} aria-hidden="true" />
        <span className="font-app text-xs text-ink-40">{meta.label}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${meta.iconBgClass} ${meta.iconColorClass}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="font-app text-sm font-medium text-ink">{meta.label}</span>
    </span>
  );
}
