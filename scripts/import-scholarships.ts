/**
 * Imports the Mastercard Foundation partner opportunities (src/lib/data/mcf-scholarships.ts).
 *
 *   npm run db:import-scholarships              → insert missing records, refresh existing ones
 *   npm run db:import-scholarships -- --keep-demo  → don't archive the seeded [Demo] scholarships
 *
 * Idempotent (keyed by slug). Re-running overwrites window/eligibility text and rules with the dataset —
 * edit the dataset (or use the admin UI and stop re-importing) to make lasting changes.
 */
import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { db, sqlClient } from "@/lib/db";
import {
  auditLogs,
  scholarshipCriteria,
  scholarshipCriteriaGroups,
  scholarshipDocumentRequirements,
  scholarshipRevisions,
  scholarships,
  scholarshipSources,
} from "@/lib/db/schema";
import { documentsFor, MCF_SCHOLARSHIPS } from "@/lib/data/mcf-scholarships";
import { logoFor } from "@/lib/data/school-logos";
import { validateCriteria, type Criterion } from "@/lib/engine/eligibility";

const VERIFIED_AT = new Date("2026-11-24T12:00:00Z");
const lagosEndOfDay = (d: string) => new Date(`${d}T23:59:00+01:00`);

async function main() {
  const keepDemo = process.argv.includes("--keep-demo");
  let created = 0;
  let updated = 0;
  for (const s of MCF_SCHOLARSHIPS) {
    const problems = validateCriteria(
      s.criteria.map((c, i) => ({ ...c, id: `c${i}`, severity: c.severity ?? "important", isFixable: c.isFixable ?? true, isRequired: c.isRequired ?? true, groupId: c.group ?? null, requiredValue: c.requiredValue ?? null }) as Criterion),
      (s.groups ?? []).map((g) => ({ id: g.key, name: g.name, logic: g.logic })),
    );
    if (problems.length) throw new Error(`${s.slug}: ${problems.join(" ")}`);

    const values = {
      name: s.name,
      partnerUniversity: s.university,
      country: s.country,
      city: s.city ?? null,
      programmeLevel: s.level,
      scholarshipType: "Fully funded",
      programmes: s.fields,
      summary: s.fieldsText,
      description: `**Mastercard Foundation Scholars Program at ${s.university}** (${s.country}).\n\n**Eligible study:** ${s.fieldsText}\n\n${s.keyEligibility}\n\n_Information compiled by the SOAR Hub team on 24 November 2026 from: ${s.researchSources}. Always confirm details on the official page before applying._`,
      deadline: s.deadline ? lagosEndOfDay(s.deadline) : null,
      timezone: "Africa/Lagos",
      applicationUrl: s.applicationUrl ?? null,
      windowStatus: s.windowStatus,
      category: s.category,
      currentWindow: s.currentWindow,
      nextWindow: s.nextWindow,
      keyEligibility: s.keyEligibility,
      howToApply: s.howToApply,
      contactEmail: s.contactEmail ?? null,
      researchSources: s.researchSources,
      status: "published" as const,
      isActive: true,
      isFeatured: s.windowStatus === "open",
      isDemo: false,
      lastVerifiedAt: VERIFIED_AT,
      updatedAt: new Date(),
    };

    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(scholarships).where(eq(scholarships.slug, s.slug)).limit(1);
      let id: string;
      if (existing) {
        // Keep a logo an admin set by hand; otherwise use the downloaded one (npm run logos:fetch).
        const keepLogo = existing.logoUrl && !existing.logoUrl.startsWith("/logos/");
        await tx.update(scholarships).set({ ...values, logoUrl: keepLogo ? existing.logoUrl : logoFor(s) }).where(eq(scholarships.id, existing.id));
        id = existing.id;
        updated++;
      } else {
        const [row] = await tx.insert(scholarships).values({ ...values, logoUrl: logoFor(s), slug: s.slug, publishedAt: new Date() }).returning({ id: scholarships.id });
        id = row.id;
        created++;
      }
      await tx.delete(scholarshipSources).where(eq(scholarshipSources.scholarshipId, id));
      await tx.insert(scholarshipSources).values({
        scholarshipId: id,
        sourceName: s.officialName,
        url: s.officialUrl,
        isPrimary: true,
        verificationStatus: "verified",
        verifiedAt: VERIFIED_AT,
        notes: `Research sources: ${s.researchSources}. Institution domain — confirm the deep link to the MCF page.`,
      });
      await tx.delete(scholarshipCriteria).where(eq(scholarshipCriteria.scholarshipId, id));
      await tx.delete(scholarshipCriteriaGroups).where(eq(scholarshipCriteriaGroups.scholarshipId, id));
      const gmap = new Map<string, string>();
      for (const [i, g] of (s.groups ?? []).entries()) {
        const [row] = await tx.insert(scholarshipCriteriaGroups).values({ scholarshipId: id, name: g.name, logic: g.logic, sortOrder: i }).returning();
        gmap.set(g.key, row.id);
      }
      for (const [i, c] of s.criteria.entries()) {
        await tx.insert(scholarshipCriteria).values({
          scholarshipId: id,
          groupId: c.group ? gmap.get(c.group) ?? null : null,
          name: c.name,
          description: c.description ?? null,
          fieldKey: c.fieldKey,
          operator: c.operator,
          requiredValue: (c.requiredValue ?? null) as object,
          severity: c.severity ?? "important",
          isFixable: c.isFixable ?? true,
          isRequired: c.isRequired ?? true,
          failExplanation: c.failExplanation ?? null,
          recommendedAction: c.recommendedAction ?? null,
          sourceReference: `${s.officialName} — key eligibility (as of 24 Nov 2026)`,
          questionText: c.questionText ?? null,
          answerType: c.answerType ?? null,
          sortOrder: i,
        });
      }
      // Document checklist: update in place by position so documents already linked to a requirement keep their link.
      const docs = documentsFor(s);
      const current = await tx.select().from(scholarshipDocumentRequirements).where(eq(scholarshipDocumentRequirements.scholarshipId, id)).orderBy(scholarshipDocumentRequirements.sortOrder);
      for (const [i, r] of docs.entries()) {
        const v = { category: r.category as never, name: r.name, description: r.description ?? null, section: r.section ?? "admission", isRequired: r.isRequired ?? true, sortOrder: i };
        if (current[i]) await tx.update(scholarshipDocumentRequirements).set(v).where(eq(scholarshipDocumentRequirements.id, current[i].id));
        else await tx.insert(scholarshipDocumentRequirements).values({ ...v, scholarshipId: id });
      }
      const extra = current.slice(docs.length).map((r) => r.id);
      if (extra.length) await tx.delete(scholarshipDocumentRequirements).where(inArray(scholarshipDocumentRequirements.id, extra));
      await tx.insert(scholarshipRevisions).values({ scholarshipId: id, snapshot: { import: "mcf-2026-11-24", ...values }, reason: existing ? "dataset re-import" : "dataset import" });
      await tx.insert(auditLogs).values({ eventType: existing ? "scholarship.imported_update" : "scholarship.imported", actorRole: "cli", targetType: "scholarship", targetId: id, metadata: { slug: s.slug, dataset: "mcf-2026-11-24" } });
    });
  }

  if (!keepDemo) {
    const demos = await db.select({ id: scholarships.id }).from(scholarships).where(and(eq(scholarships.isDemo, true), eq(scholarships.isActive, true)));
    if (demos.length) {
      await db.update(scholarships).set({ status: "archived", isActive: false, updatedAt: new Date() }).where(inArray(scholarships.id, demos.map((d) => d.id)));
      console.log(`Archived ${demos.length} demo scholarship(s) (history kept; use --keep-demo to skip).`);
    }
  }
  console.log(`Scholarships imported: ${created} created, ${updated} updated (${MCF_SCHOLARSHIPS.length} in dataset).`);
  await sqlClient.end();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await sqlClient.end();
  process.exit(1);
});
