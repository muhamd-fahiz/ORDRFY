"use client";

import { StatusPage } from "@/components/ui/StatusPage";
import { Button } from "@/components/ui/Button";

export default function OwnerAppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusPage
      eyebrow="Something went wrong"
      title="That didn't work."
      message="An unexpected error happened loading this page. Try again, or come back in a moment."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
