import { z } from "zod";

const learnerOptionsPageSchema = z.object({
  learners: z.array(z.object({
    id: z.string().min(1),
    name: z.string(),
    admissionNo: z.string(),
    grade: z.string(),
    hasLearnerLogin: z.boolean().optional(),
  })),
  nextCursor: z.string().nullable().optional(),
});

export type LearnerOption = z.infer<typeof learnerOptionsPageSchema>["learners"][number];

/** Load every cursor page for selectors where an incomplete list can cause a wrong record to be chosen. */
export async function fetchAllLearnerOptions(path = "/api/learners?take=100") {
  const learners: z.infer<typeof learnerOptionsPageSchema>["learners"] = [];
  let cursor: string | null = null;
  let pages = 0;

  do {
    const url = new URL(path, window.location.origin);
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(`${url.pathname}${url.search}`, { cache: "no-store" });
    const raw: unknown = await response.json();
    if (!response.ok) {
      throw new Error("Learner records could not be loaded.");
    }
    const parsed = learnerOptionsPageSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error("The learner service returned invalid data.");
    }
    learners.push(...parsed.data.learners);
    cursor = parsed.data.nextCursor ?? null;
    pages += 1;
  } while (cursor && pages < 100);

  return learners;
}
