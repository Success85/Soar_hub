import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-6xl text-gold-500">404</p>
      <h1 className="mt-2 font-display text-3xl">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-muted">It may have moved, or you may not have access to it.</p>
      <div className="mt-6 flex gap-2"><Button asChild><Link href="/">Home</Link></Button><Button asChild variant="secondary"><Link href="/scholarships">Scholarships</Link></Button></div>
    </main>
  );
}
