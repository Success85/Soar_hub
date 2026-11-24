import Link from "next/link";

export function EssayTabs({ current }: { current: "essays" | "bank" }) {
  return (
    <nav aria-label="Essay workspace" className="mb-6 flex gap-2">
      <Link href="/essays" aria-current={current === "essays" ? "page" : undefined} className={current === "essays" ? "rounded-full bg-navy-900 px-4 py-1.5 text-sm font-semibold text-ivory" : "rounded-full border border-line bg-white px-4 py-1.5 text-sm font-semibold"}>My essays</Link>
      <Link href="/answer-bank" aria-current={current === "bank" ? "page" : undefined} className={current === "bank" ? "rounded-full bg-navy-900 px-4 py-1.5 text-sm font-semibold text-ivory" : "rounded-full border border-line bg-white px-4 py-1.5 text-sm font-semibold"}>Answer bank</Link>
    </nav>
  );
}

