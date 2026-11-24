"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl">Something went wrong on our side</h1>
      <p className="mt-2 max-w-md text-muted">Please try again. If the problem continues, contact support{error.digest ? ` and quote reference ${error.digest}` : ""}.</p>
      {process.env.NODE_ENV !== "production" && (
        <pre className="mt-6 max-w-2xl overflow-auto whitespace-pre-wrap rounded-lg border border-red-200 bg-danger-100 p-4 text-left text-xs text-danger-700">
          {error.message}
          {"\n\n"}Development hint: most first-run errors mean the database is not reachable or not migrated. Check DATABASE_URL in .env, then run `npm run db:migrate` and `npm run db:seed:demo`. Open /api/health to test the connection.
        </pre>
      )}
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </main>
  );
}
