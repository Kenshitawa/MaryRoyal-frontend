import { db } from "@/lib/db";
import { deleteStoredFile } from "@/lib/file-storage";

async function main() {
  const daysValue = Number(process.env.ADMISSION_DRAFT_RETENTION_DAYS ?? 365);
  if (!Number.isInteger(daysValue) || daysValue < 365 || daysValue > 3650) throw new Error("ADMISSION_DRAFT_RETENTION_DAYS must be an integer between 365 and 3650.");
  const cutoff = new Date(Date.now() - daysValue * 24 * 60 * 60 * 1000);
  const expired = await db.admissionDraft.findMany({
    where: { status: "DRAFT", learnerId: null, updatedAt: { lt: cutoff } },
    select: { id: true, documents: { select: { storageKey: true } } },
  });
  if (process.env.RETENTION_APPLY !== "PURGE_EXPIRED_DRAFTS") {
    console.log(`Dry run: ${expired.length} abandoned admission drafts exceed ${daysValue} days; no records were changed.`);
    return;
  }
  for (const draft of expired) {
    for (const document of draft.documents) {
      try { await deleteStoredFile("private", `admissions/${draft.id}/${document.storageKey}`); }
      catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw new Error("Could not securely remove an expired admission document; draft was retained.");
      }
    }
    await db.$transaction(async tx => {
      await tx.auditEvent.create({ data: { action: "RETENTION_PURGE", entity: "AdmissionDraft", entityId: draft.id } });
      await tx.admissionDraft.delete({ where: { id: draft.id } });
    });
  }
  console.log(`Retention enforcement removed ${expired.length} abandoned admission drafts and their private documents.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Retention enforcement failed.");
  process.exitCode = 1;
}).finally(async () => db.$disconnect());
