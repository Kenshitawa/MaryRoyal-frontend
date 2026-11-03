const restrictedStatutoryFields = new Set([
  "kraPin",
  "nssfNumber",
  "shaNumber",
  "bankName",
  "bankAccountName",
  "bankAccountNumber",
  "bankBranch",
]);

type RestrictedStatutoryField =
  | "kraPin"
  | "nssfNumber"
  | "shaNumber"
  | "bankName"
  | "bankAccountName"
  | "bankAccountNumber"
  | "bankBranch";

export function stripStaffStatutoryFields<T extends Record<RestrictedStatutoryField, unknown>>(
  profile: T,
): Omit<T, RestrictedStatutoryField> {
  const filteredEntries = Object.entries(profile).filter(([field]) => !restrictedStatutoryFields.has(field));
  return Object.fromEntries(filteredEntries) as Omit<T, RestrictedStatutoryField>;
}
