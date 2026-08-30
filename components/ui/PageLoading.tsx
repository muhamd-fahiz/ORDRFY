import { ordrfyFontVariables } from "@/lib/design/fonts";

/**
 * Deliberately minimal -- a centered spinner, not a per-screen skeleton layout. Only exists
 * because there was previously no loading.tsx anywhere in the app at all: locally, fast
 * queries made this invisible, but real network latency (e.g. testing over a tunnel) can
 * show a blank page for a moment otherwise.
 */
export function PageLoading() {
  return (
    <div className={`${ordrfyFontVariables} flex min-h-[50vh] items-center justify-center bg-paper font-app`}>
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-ink-15 border-t-pink"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
