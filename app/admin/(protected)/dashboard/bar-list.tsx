/**
 * Hand-rolled horizontal bar chart -- deliberately no charting library added for this.
 * Server component (no interactivity needed): pure display over numbers already computed
 * by the page. The admin panel is explicitly allowed to look more technical/data-dense than
 * the owner app, per the project owner's own instruction -- this is that surface.
 */
export function BarList({
  title,
  items,
  formatValue,
  emptyLabel,
}: {
  title: string;
  items: { label: string; value: number }[];
  formatValue: (n: number) => string;
  emptyLabel: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <section className="rounded-xl border border-ink-15 p-6 lg:p-9">
      <h2 className="mb-5 text-base font-semibold uppercase tracking-wide text-ink-40">{title}</h2>
      {items.length === 0 ? (
        <p className="font-app text-lg text-ink-70">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 font-app text-base">
                <span className="text-ink">{item.label}</span>
                <span className="font-data text-ink-40">{formatValue(item.value)}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-ink-15">
                <div
                  className="h-2.5 rounded-full bg-pink-strong"
                  style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
