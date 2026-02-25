import { TierDefinition, TierId } from "@/app/lib/types";

interface TierCardProps {
  tier: TierDefinition;
  selected: boolean;
  onSelect: (tier: TierId) => void;
}

export function TierCard({ tier, selected, onSelect }: TierCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tier.id)}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? "border-ink bg-slate-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{tier.label}</h3>
        {selected ? (
          <span className="rounded-full bg-ink px-2 py-1 text-xs text-white">Current choice</span>
        ) : null}
      </div>
      <p className="mb-3 text-sm text-slate-600">{tier.description}</p>
      <div className="space-y-1 text-sm">
        <p>Primary line: {tier.prices.main} SEK/mo</p>
        <p>Extra line: {tier.prices.sub} SEK/mo</p>
      </div>
    </button>
  );
}
