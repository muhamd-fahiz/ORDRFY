interface AttentionBannerProps {
  /** Count of unresolved rows in owner_attention_queue for this business. */
  count: number;
}

// Renders nothing when the queue is empty -- this banner should never claim an owner's
// attention when there's genuinely nothing to look at.
export function AttentionBanner({ count }: AttentionBannerProps) {
  if (count <= 0) return null;

  return (
    <div className="flex items-center justify-between rounded-lg bg-attention-soft px-3 py-2 font-app text-sm font-bold text-attention">
      <span>Needs your attention</span>
      <span className="font-data">{count}</span>
    </div>
  );
}
