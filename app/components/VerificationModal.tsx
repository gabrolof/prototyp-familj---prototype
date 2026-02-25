"use client";

import qaMappings from "@/app/data/qaMappings.json";

interface VerificationModalProps {
  ssnInput: string;
  onChangeSsn: (value: string) => void;
  onVerify: () => void;
}

const scenarioEntries = Object.entries(qaMappings.scenariosBySsn);

export function VerificationModal({ ssnInput, onChangeSsn, onVerify }: VerificationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-sun">Verify customer</p>
        <h2 className="mt-1 text-2xl font-bold text-ink">Sign in with BankID</h2>
        <p className="mt-1 text-sm text-slate-600">
          Scan the QR code with your BankID app to continue.
        </p>

        <div className="mt-5 flex flex-col items-center">
          <div className="w-full max-w-[220px] rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
            <div className="h-44 w-full rounded-lg border border-slate-300 bg-[linear-gradient(90deg,#0f172a_8%,transparent_8%,transparent_16%,#0f172a_16%,#0f172a_24%,transparent_24%,transparent_32%,#0f172a_32%,#0f172a_40%,transparent_40%,transparent_48%,#0f172a_48%,#0f172a_56%,transparent_56%,transparent_64%,#0f172a_64%,#0f172a_72%,transparent_72%,transparent_80%,#0f172a_80%,#0f172a_88%,transparent_88%),linear-gradient(#0f172a_8%,transparent_8%,transparent_16%,#0f172a_16%,#0f172a_24%,transparent_24%,transparent_32%,#0f172a_32%,#0f172a_40%,transparent_40%,transparent_48%,#0f172a_48%,#0f172a_56%,transparent_56%,transparent_64%,#0f172a_64%,#0f172a_72%,transparent_72%,transparent_80%,#0f172a_80%,#0f172a_88%,transparent_88%)] bg-[length:36px_36px] bg-center" />
            <p className="mt-2 text-center text-xs text-slate-500">Demo QR</p>
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            Demo mode: use the simulation tools below to choose SSN before login.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">Demo simulation tools</p>
            <button
              type="button"
              className="button-primary"
              onClick={onVerify}
              disabled={!ssnInput.trim()}
            >
              Login
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Choose test SSN
              <select
                className="input mt-1"
                value={scenarioEntries.some(([ssn]) => ssn === ssnInput) ? ssnInput : ""}
                onChange={(event) => onChangeSsn(event.target.value)}
              >
                <option value="">Select scenario</option>
                {scenarioEntries.map(([ssn, summary]) => (
                  <option key={ssn} value={ssn}>
                    {ssn} - {summary}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Or enter SSN manually
              <input
                className="input mt-1"
                value={ssnInput}
                onChange={(event) => onChangeSsn(event.target.value)}
                placeholder="YYYYMMDD-XXXX"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
