"use client";

import { useState } from "react";
import {
  CreditCard,
  Smartphone,
  Building2,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Props {
  learnerName: string;
  admissionNo: string;
  outstandingBalance: number;
}

export default function ParentFeePaymentGuide({
  learnerName,
  admissionNo,
  outstandingBalance,
}: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"mpesa" | "bank" | "cash">("mpesa");
  const [isOpen, setIsOpen] = useState(true);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const kes = (n: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="rounded-3xl border border-blue-200/90 bg-gradient-to-b from-blue-50/70 via-white to-slate-50/50 p-6 shadow-sm dark:border-blue-900/60 dark:from-blue-950/40 dark:via-slate-900/80 dark:to-slate-900/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-700 text-white shadow-md shadow-blue-700/20">
            <CreditCard size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              How to Pay School Fees
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Approved school payment channels for {learnerName} ({admissionNo})
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <span>{isOpen ? "Collapse Guide" : "View Instructions"}</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-5 space-y-6">
          {/* Method Selector Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedMethod("mpesa")}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
                selectedMethod === "mpesa"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
              }`}
            >
              <Smartphone size={16} />
              <span>M-PESA Paybill (Fastest)</span>
            </button>

            <button
              onClick={() => setSelectedMethod("bank")}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
                selectedMethod === "bank"
                  ? "bg-blue-700 text-white shadow-md shadow-blue-700/25"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
              }`}
            >
              <Building2 size={16} />
              <span>KCB Bank Deposit / EFT</span>
            </button>

            <button
              onClick={() => setSelectedMethod("cash")}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
                selectedMethod === "cash"
                  ? "bg-slate-800 text-white shadow-md shadow-slate-800/25 dark:bg-slate-700"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
              }`}
            >
              <Clock size={16} />
              <span>School Accounts Desk</span>
            </button>
          </div>

          {/* METHOD 1: M-PESA PAYBILL */}
          {selectedMethod === "mpesa" && (
            <div className="space-y-4 rounded-2xl border border-emerald-200/80 bg-white/90 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-slate-900/70">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Official Mobile Payment Channel
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Lipa na M-PESA · Paybill
                  </h4>
                </div>
                {outstandingBalance > 0 && (
                  <span className="rounded-xl bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    Target Balance: {kes(outstandingBalance)}
                  </span>
                )}
              </div>

              {/* Quick Credentials Box */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Business / Paybill No.</span>
                    <p className="font-mono text-base font-black text-slate-900 dark:text-white">522123</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard("522123", "paybill")}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    title="Copy Paybill Number"
                  >
                    {copiedKey === "paybill" ? (
                      <>
                        <Check size={13} className="text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div>
                    <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase">
                      Account No. (Learner Admission)
                    </span>
                    <p className="font-mono text-base font-black text-emerald-950 dark:text-emerald-200">
                      {admissionNo}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(admissionNo, "account")}
                    className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-300"
                    title="Copy Learner Admission Number"
                  >
                    {copiedKey === "account" ? (
                      <>
                        <Check size={13} className="text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 5-Step Guide */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Steps to Pay on your Phone:</p>
                <ol className="mt-2.5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      1
                    </span>
                    <span>Go to the <b>M-PESA</b> menu on your phone and select <b>Lipa na M-PESA</b>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      2
                    </span>
                    <span>Select <b>Paybill</b> and enter Business No. <b className="font-mono">522123</b>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      3
                    </span>
                    <span>
                      Enter Account No. as <b className="font-mono">{admissionNo}</b> (this matches {learnerName}&apos;s profile).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      4
                    </span>
                    <span>Enter the fee amount in KES and your M-PESA PIN, then press <b>Send</b>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      5
                    </span>
                    <span>
                      You will receive an SMS confirmation from Safaricom. The payment code is recorded by the school
                      accounts desk and your receipt will appear right here in your portal.
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* METHOD 2: DIRECT BANK DEPOSIT / EFT */}
          {selectedMethod === "bank" && (
            <div className="space-y-4 rounded-2xl border border-blue-200/80 bg-white/90 p-5 shadow-sm dark:border-blue-900/60 dark:bg-slate-900/70">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  Direct Bank Branch or EFT / RTGS
                </span>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  KCB Bank Kenya Details
                </h4>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Bank &amp; Branch</span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Kenya Commercial Bank (KCB)</p>
                  <p className="text-[11px] text-slate-500">Kisumu Main Branch (Bank Code: 01)</p>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-blue-200/80 bg-blue-50/40 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <div>
                    <span className="text-[10px] font-semibold text-blue-800 dark:text-blue-300 uppercase">
                      Account Number
                    </span>
                    <p className="font-mono text-base font-black text-blue-950 dark:text-blue-200">
                      1289456721
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard("1289456721", "bankacc")}
                    className="flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-bold text-blue-800 hover:bg-blue-50 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-300"
                  >
                    {copiedKey === "bankacc" ? (
                      <>
                        <Check size={13} className="text-blue-600" />
                        <span className="text-blue-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Important Deposit Note:</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  When making bank deposits, ensure the teller indicates <b>{admissionNo} - {learnerName}</b> on the
                  deposit slip reference or narration. Present the bank slip to the Secretary desk or email
                  it to accounts for instant confirmation.
                </p>
              </div>
            </div>
          )}

          {/* METHOD 3: ACCOUNTS OFFICE / CASH */}
          {selectedMethod === "cash" && (
            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  In-Person Payments
                </span>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Mary Royal School Accounts &amp; Secretary Desk
                </h4>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Location:</span>
                    <span>Administration Block, Ground Floor, Obunga Campus</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Office Hours:</span>
                    <span>Monday – Friday: 8:00 AM – 4:30 PM (EAT)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Accepted:</span>
                    <span>Cash, Banker&apos;s Cheque, M-PESA, and Direct Bank Slips</span>
                  </div>
                </div>

                <p className="mt-4 border-t border-slate-200/70 pt-3 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Official Mary Royal School receipts are printed and stamped on the spot upon payment recording.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck size={14} className="text-blue-600" />
            <span>
              All fee transactions are audit-logged and protected under Kenya&apos;s Data Protection Act and school finance policy.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
