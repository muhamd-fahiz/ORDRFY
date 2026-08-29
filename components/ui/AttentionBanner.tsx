import Link from "next/link";

interface AttentionBannerProps {
  /** Count of unresolved rows in owner_attention_queue for this business. */
  count: number;
  /** When set, the whole banner links to the full Needs Attention screen. */
  href?: string;
}

// Renders nothing when the queue is empty -- this banner should never claim an owner's
// attention when there's genuinely nothing to look at.
export function AttentionBanner({ count, href }: AttentionBannerProps) {
  if (count <= 0) return null;

  const content = (
    <>
      <span>Needs your attention</span>
      <span className="font-data">{count}</span>
    </>
  );
  const className = "flex items-center justify-between rounded-lg bg-attention-soft px-3 py-2 font-app text-sm font-bold text-attention";

  if (href) {
    return (
      <Link href={href} className={`${className} hover:opacity-80`}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
