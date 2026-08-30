import Link from "next/link";
import { StatusPage } from "@/components/ui/StatusPage";

export default function RootNotFound() {
  return (
    <StatusPage
      eyebrow="404"
      title="Page not found."
      message="That page doesn't exist, or the link may be out of date."
      action={
        <Link href="/" className="rounded-md bg-pink px-4 py-2 font-display text-sm font-bold text-white transition-colors hover:bg-pink-hover">
          Back to home
        </Link>
      }
    />
  );
}
