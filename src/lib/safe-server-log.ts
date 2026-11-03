type CodedError = { code?: unknown };

export function logSafeServerError(scope: string, error: unknown): void {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as CodedError).code
      : undefined;
  const safeCode = typeof code === "string" && /^P\d{4}$/.test(code) ? code : "UNEXPECTED";
  console.error(JSON.stringify({ event: "server_error", scope, code: safeCode }));
}
