import { CustomerContext } from "@/app/lib/types";

interface LoginPanelProps {
  ssnInput: string;
  onChangeSsn: (value: string) => void;
  onLogin: () => void;
  loggedInSsn: string | null;
  customerContext: CustomerContext | null;
}

export function LoginPanel({
  ssnInput,
  onChangeSsn,
  onLogin,
  loggedInSsn,
  customerContext,
}: LoginPanelProps) {
  return (
    <div className="panel space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Step 1: Verify account details</h2>
        <p className="mt-1 text-sm text-slate-600 md:text-[15px]">
          Enter personal number to load your current lines and any eligible offers in this demo.
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:flex-row">
        <input
          className="input"
          value={ssnInput}
          onChange={(event) => onChangeSsn(event.target.value)}
          placeholder="YYYYMMDD-XXXX"
          aria-label="Personal number"
        />
        <button type="button" onClick={onLogin} className="button-primary md:w-44">
          Verify
        </button>
      </div>

      {loggedInSsn ? (
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">
          <p>
            Verified personal number: <span className="font-semibold">{loggedInSsn}</span>
          </p>
          {customerContext ? (
            <div className="mt-2 grid gap-1 md:grid-cols-2">
              <p className="rounded-md bg-white/70 px-2 py-1">
                Customer type: <span className="font-semibold">{customerContext.type}</span>
              </p>
              <p className="rounded-md bg-white/70 px-2 py-1">
                Existing family plan:{" "}
                <span className="font-semibold">{customerContext.hasFamily ? "Yes" : "No"}</span>
              </p>
              <p className="rounded-md bg-white/70 px-2 py-1">
                Current family tier: <span className="font-semibold">{customerContext.familyTier ?? "-"}</span>
              </p>
              <p className="rounded-md bg-white/70 px-2 py-1 md:col-span-2">
                Registered numbers: {customerContext.ownedNumbers.map((n) => n.msisdn).join(", ") || "None"}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
