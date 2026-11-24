import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Access denied" };

export default function Forbidden() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <ShieldAlert className="size-12 text-gold-600" aria-hidden />
      <h1 className="mt-4 font-display text-3xl">You don&apos;t have access to this page</h1>
      <p className="mt-2 max-w-md text-muted">If you think you should, ask a SOAR Hub administrator to update your role.</p>
      <Button asChild className="mt-6"><Link href="/">Go home</Link></Button>
    </main>
  );
}
