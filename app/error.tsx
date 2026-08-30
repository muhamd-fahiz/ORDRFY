"use client";

import { StatusPage } from "@/components/ui/StatusPage";
import { Button } from "@/components/ui/Button";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusPage
      eyebrow="Something went wrong"
      title="That didn't work."
      message="An unexpected error happened. Try again, or come back in a moment."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
