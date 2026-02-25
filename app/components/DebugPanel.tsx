import qaMappings from "@/app/data/qaMappings.json";
import { PricedCartLine } from "@/app/lib/types";

interface DebugPanelProps {
  ssnInput: string;
  onChangeSsn: (value: string) => void;
  onApplyExample: (ssn: string, msisdn: string) => void;
  caseClassification: string;
  lines: PricedCartLine[];
}

const scenarioEntries = Object.entries(qaMappings.scenariosBySsn);

export function DebugPanel({
  ssnInput,
  onChangeSsn,
  onApplyExample,
  caseClassification,
  lines,
}: DebugPanelProps) {
  return (
    <div className="panel space-y-3 border-dashed border-slate-400 bg-gradient-to-b from-slate-50 to-white">
      <h2 className="text-lg font-semibold">Debug panel</h2>

      <label className="block text-sm font-medium">
        Quick SSN switch
        <select
          className="input mt-1"
          value={ssnInput}
          onChange={(event) => onChangeSsn(event.target.value)}
        >
          <option value="">Select SSN</option>
          {scenarioEntries.map(([ssn, summary]) => (
            <option key={ssn} value={ssn}>
              {ssn} - {summary}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-2 text-sm font-medium">Quick-fill examples</p>
        <div className="flex flex-wrap gap-2">
          {qaMappings.explicitExamples.map((example) => (
            <button
              key={`${example.ssn}-${example.msisdn}`}
              type="button"
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm transition hover:-translate-y-px hover:border-slate-400"
              onClick={() => onApplyExample(example.ssn, example.msisdn)}
              title={example.explanation}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-sm">
        <p className="font-semibold">Computed classification</p>
        <p>{caseClassification}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-sm">
        <p className="mb-1 font-semibold">Computed offers and final monthly</p>
        {lines.length === 0 ? (
          <p>No lines yet.</p>
        ) : (
          <ul className="space-y-1">
            {lines.map((line) => (
              <li key={line.id}>
                {line.msisdn || "(empty)"}: {line.offer.offerType} / {line.price.final} SEK
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
