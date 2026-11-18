export type CbcLevel = "EE1" | "EE2" | "ME1" | "ME2" | "AE1" | "AE2" | "BE1" | "BE2";

export const CBC_LEVEL_BANDS: ReadonlyArray<{ code: CbcLevel; min: number; maxExclusive: number | null; descriptor: string }> = [
  { code: "EE1", min: 90, maxExclusive: null, descriptor: "Exceeding expectations" },
  { code: "EE2", min: 75, maxExclusive: 90, descriptor: "Exceeding expectations" },
  { code: "ME1", min: 58, maxExclusive: 75, descriptor: "Meeting expectations" },
  { code: "ME2", min: 41, maxExclusive: 58, descriptor: "Meeting expectations" },
  { code: "AE1", min: 31, maxExclusive: 41, descriptor: "Approaching expectations" },
  { code: "AE2", min: 21, maxExclusive: 31, descriptor: "Approaching expectations" },
  { code: "BE1", min: 10, maxExclusive: 21, descriptor: "Below expectations" },
  { code: "BE2", min: 0, maxExclusive: 10, descriptor: "Below expectations" },
];

export function cbcLevel(score: number): CbcLevel {
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new RangeError("Score must be between 0 and 100");
  if (score >= 90) return "EE1";
  if (score >= 75) return "EE2";
  if (score >= 58) return "ME1";
  if (score >= 41) return "ME2";
  if (score >= 31) return "AE1";
  if (score >= 21) return "AE2";
  if (score >= 10) return "BE1";
  return "BE2";
}
export function feeBalance(invoiced: number, paid: number, credit = 0): number { return Math.max(0, invoiced - paid - credit); }
