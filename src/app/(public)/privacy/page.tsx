import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { DEFAULT_PRIVACY } from "@/lib/legal";
import { getSettings } from "@/lib/services/settings";

export const metadata: Metadata = { title: "Privacy policy" };

export default async function Page() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted">Version {s.privacy_version}</p>
      <div className="mt-8"><Markdown>{s.privacy_markdown || DEFAULT_PRIVACY}</Markdown></div>
    </div>
  );
}
