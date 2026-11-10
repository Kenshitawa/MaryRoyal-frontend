"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Save,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import type { PaymentSettingsView } from "@/lib/payment-settings";

type Props = {
  initial: PaymentSettingsView;
  endpoint: string;
  canEdit: boolean;
};

const accountFormats = [
  { value: "ADMISSION_NO", label: "Admission number" },
  { value: "INVOICE_NO", label: "Invoice number" },
  { value: "LEARNER_ID", label: "Learner record ID" },
];

type SecretField = "consumerKey" | "consumerSecret" | "passkey";

const secretMeta: Record<
  SecretField,
  { label: string; hint: string; maskedKey: "consumerKeyMasked" | "consumerSecretMasked" | "passkeyMasked" }
> = {
  consumerKey: {
    label: "Consumer key",
    hint: "Daraja app consumer key from the Safaricom developer portal.",
    maskedKey: "consumerKeyMasked",
  },
  consumerSecret: {
    label: "Consumer secret",
    hint: "Daraja app consumer secret. Stored encrypted with AES-256-GCM.",
    maskedKey: "consumerSecretMasked",
  },
  passkey: {
    label: "Lipa na M-Pesa passkey",
    hint: "The passkey for the paybill or till shortcode.",
    maskedKey: "passkeyMasked",
  },
};

export default function PaymentSettingsForm({ initial, endpoint, canEdit }: Props) {
  const [settings, setSettings] = useState(initial);
  const [paybillNumber, setPaybillNumber] = useState(initial.paybillNumber ?? "");
  const [tillNumber, setTillNumber] = useState(initial.tillNumber ?? "");
  const [accountFormat, setAccountFormat] = useState(initial.accountFormat);
  const [bankName, setBankName] = useState(initial.bankName ?? "");
  const [bankBranch, setBankBranch] = useState(initial.bankBranch ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(initial.bankAccountNumber ?? "");
  const [bankAccountName, setBankAccountName] = useState(initial.bankAccountName ?? "");
  const [shortcode, setShortcode] = useState(initial.daraja.shortcode ?? "");
  const [environment, setEnvironment] = useState(initial.daraja.environment);
  const [secrets, setSecrets] = useState<Record<SecretField, string>>({
    consumerKey: "",
    consumerSecret: "",
    passkey: "",
  });
  const [clearSecrets, setClearSecrets] = useState<Record<SecretField, boolean>>({
    consumerKey: false,
    consumerSecret: false,
    passkey: false,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );

  const configured = settings.daraja.credentialsConfigured;
  const updatedLabel = useMemo(() => {
    if (!settings.updatedAt) return "No payment settings saved yet";
    return `Last saved ${new Intl.DateTimeFormat("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Nairobi",
    }).format(new Date(settings.updatedAt))}`;
  }, [settings.updatedAt]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setMessage(null);

    const daraja: Record<string, unknown> = {
      shortcode: shortcode.trim() || null,
      environment,
    };

    for (const field of Object.keys(secretMeta) as SecretField[]) {
      if (clearSecrets[field]) {
        daraja[field] = null;
        continue;
      }
      const value = secrets[field].trim();
      if (value) daraja[field] = value;
    }

    const payload = {
      paybillNumber: paybillNumber.trim() || null,
      tillNumber: tillNumber.trim() || null,
      accountFormat,
      bankName: bankName.trim() || null,
      bankBranch: bankBranch.trim() || null,
      bankAccountNumber: bankAccountNumber.trim() || null,
      bankAccountName: bankAccountName.trim() || null,
      daraja,
    };

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        settings?: PaymentSettingsView;
        error?: string;
      };
      if (!response.ok || !result.settings) {
        throw new Error(result.error ?? "Payment settings could not be saved.");
      }

      setSettings(result.settings);
      setPaybillNumber(result.settings.paybillNumber ?? "");
      setTillNumber(result.settings.tillNumber ?? "");
      setAccountFormat(result.settings.accountFormat);
      setBankName(result.settings.bankName ?? "");
      setBankBranch(result.settings.bankBranch ?? "");
      setBankAccountNumber(result.settings.bankAccountNumber ?? "");
      setBankAccountName(result.settings.bankAccountName ?? "");
      setShortcode(result.settings.daraja.shortcode ?? "");
      setEnvironment(result.settings.daraja.environment);
      setSecrets({ consumerKey: "", consumerSecret: "", passkey: "" });
      setClearSecrets({ consumerKey: false, consumerSecret: false, passkey: false });
      setMessage({ tone: "success", text: "Payment settings saved and audited." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Payment settings could not be saved.",
      });
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800";
  const labelClass =
    "text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300";

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Smartphone size={15} aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-wider">M-Pesa collection</span>
          </div>
          <p className="mt-2 text-lg font-extrabold text-slate-950 dark:text-white">
            {settings.paybillNumber ? `Paybill ${settings.paybillNumber}` : "Not configured"}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {settings.tillNumber ? `Till ${settings.tillNumber}` : "No till number"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Building2 size={15} aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Bank collection</span>
          </div>
          <p className="mt-2 text-lg font-extrabold text-slate-950 dark:text-white">
            {settings.bankName || "Not configured"}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {settings.bankAccountNumber || "No account number"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <KeyRound size={15} aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Daraja API</span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-lg font-extrabold text-slate-950 dark:text-white">
            {configured ? (
              <>
                <CheckCircle2 size={17} className="text-emerald-600" aria-hidden="true" /> Configured
              </>
            ) : (
              "Not configured"
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {settings.daraja.environment === "production" ? "Production" : "Sandbox"} environment
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-950 dark:text-white">School payment details</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Shown to families on invoices and the parent portal. Secrets are never sent back to this
              browser.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {updatedLabel}
          </span>
        </div>

        <fieldset disabled={!canEdit || busy} className="mt-5 space-y-4">
          <legend className="sr-only">M-Pesa and bank collection details</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelClass}>M-Pesa paybill number</span>
              <input
                value={paybillNumber}
                onChange={(event) => setPaybillNumber(event.target.value)}
                inputMode="numeric"
                pattern="\d{5,9}"
                maxLength={9}
                placeholder="e.g. 522123"
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>M-Pesa till number</span>
              <input
                value={tillNumber}
                onChange={(event) => setTillNumber(event.target.value)}
                inputMode="numeric"
                pattern="\d{5,9}"
                maxLength={9}
                placeholder="Optional buy-goods till"
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>M-Pesa account format</span>
              <select
                value={accountFormat}
                onChange={(event) => setAccountFormat(event.target.value)}
                className={inputClass}
              >
                {accountFormats.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Bank name</span>
              <input
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
                maxLength={120}
                placeholder="e.g. KCB Bank"
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Bank branch</span>
              <input
                value={bankBranch}
                onChange={(event) => setBankBranch(event.target.value)}
                maxLength={120}
                placeholder="e.g. Kisumu Branch"
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Bank account number</span>
              <input
                value={bankAccountNumber}
                onChange={(event) => setBankAccountNumber(event.target.value)}
                maxLength={34}
                placeholder="School collection account"
                className={inputClass}
              />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>Bank account name</span>
              <input
                value={bankAccountName}
                onChange={(event) => setBankAccountName(event.target.value)}
                maxLength={120}
                placeholder="Name on the school bank account"
                className={inputClass}
              />
            </label>
          </div>
        </fieldset>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <LockKeyhole size={17} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-950 dark:text-white">Daraja credentials</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Secrets are encrypted with AES-256-GCM before storage. Only a masked value is ever returned
              to the browser. Leave a secret blank to keep the stored value, or tick Clear to remove it.
            </p>
          </div>
        </div>

        {!settings.daraja.keyAvailable ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
          >
            Server credential encryption is not configured. Bank and paybill details can still be saved,
            but Daraja secrets cannot be stored until a platform administrator sets
            <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px] dark:bg-amber-900/60">PAYMENT_ENCRYPTION_KEY</code>.
          </p>
        ) : null}

        <fieldset disabled={!canEdit || busy} className="mt-5 space-y-4">
          <legend className="sr-only">Daraja API credentials</legend>
          <div className="grid gap-4 lg:grid-cols-3">
            {(Object.keys(secretMeta) as SecretField[]).map((field) => {
              const meta = secretMeta[field];
              const masked = settings.daraja[meta.maskedKey];
              return (
                <div key={field} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <label>
                    <span className={labelClass}>{meta.label}</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={secrets[field]}
                      disabled={clearSecrets[field]}
                      onChange={(event) =>
                        setSecrets((current) => ({ ...current, [field]: event.target.value }))
                      }
                      placeholder={masked ?? "Not stored"}
                      className={inputClass}
                    />
                  </label>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {meta.hint}
                  </p>
                  <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={clearSecrets[field]}
                      onChange={(event) =>
                        setClearSecrets((current) => ({ ...current, [field]: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                    />
                    Clear stored value
                  </label>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Daraja shortcode</span>
              <input
                value={shortcode}
                onChange={(event) => setShortcode(event.target.value)}
                inputMode="numeric"
                pattern="\d{5,9}"
                maxLength={9}
                placeholder="Paybill or till shortcode"
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Daraja environment</span>
              <select
                value={environment}
                onChange={(event) => setEnvironment(event.target.value)}
                className={inputClass}
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </label>
          </div>
        </fieldset>
      </div>

      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm font-semibold ${
            message.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck size={14} aria-hidden="true" />
          Changes are recorded in the audit trail without secret values.
        </p>
        <button
          type="submit"
          disabled={!canEdit || busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={16} aria-hidden="true" />
          {busy ? "Saving…" : "Save payment settings"}
        </button>
      </div>
    </form>
  );
}
