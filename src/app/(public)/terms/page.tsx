import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { DEFAULT_TERMS } from "@/lib/legal";
import { getSettings } from "@/lib/services/settings";

export const metadata: Metadata = { title: "Terms of service" };

export default async function Page() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl">Terms of service</h1>
      <p className="mt-2 text-sm text-muted">Version {s.terms_version}</p>
      <div className="mt-8"><Markdown>{s.terms_markdown || DEFAULT_TERMS}</Markdown></div>
    </div>
  );
}
