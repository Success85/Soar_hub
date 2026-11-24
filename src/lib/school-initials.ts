/**
 * Short label for a school's initials tile.
 * "African Leadership University (ALU)" → "ALU"; "USIU-Africa" acronym → "USIU"; "AIMS Rwanda (…)" → "AIMS";
 * "University of Cape Town" → "UCT".
 */
export function schoolInitials(name: string): string {
  const acronym = /\(([A-Z0-9][A-Za-z0-9-]{1,11})\)/.exec(name)?.[1];
  if (acronym) return acronym.split("-")[0].toUpperCase().slice(0, 5);
  const bare = name.replace(/\([^)]*\)/g, " ").replace(/[–—]/g, " ").trim();
  const first = bare.split(/\s+/)[0] ?? "";
  if (first.length >= 2 && first.length <= 5 && /^[A-Z0-9][A-Z0-9a-z]*$/.test(first) && first.replace(/[^A-Z0-9]/g, "").length >= 2) return first.toUpperCase();
  const words = bare.split(/[\s-]+/).filter((w) => w && !/^(of|the|and|for|in|de|du|la|le|des)$/i.test(w));
  return words.slice(0, 3).map((w) => w.replace(/^d'/i, "")[0]).join("").toUpperCase();
}
