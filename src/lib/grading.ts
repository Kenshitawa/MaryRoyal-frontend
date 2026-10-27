export type CbcLevel = "EE" | "ME" | "AE" | "BE";
export function cbcLevel(score: number, thresholds = { ee: 80, me: 60, ae: 40 }): CbcLevel {
 if (!Number.isFinite(score) || score < 0 || score > 100) throw new RangeError("Score must be between 0 and 100");
 return score >= thresholds.ee ? "EE" : score >= thresholds.me ? "ME" : score >= thresholds.ae ? "AE" : "BE";
}
export function feeBalance(invoiced: number, paid: number, credit = 0): number { return Math.max(0, invoiced - paid - credit); }
