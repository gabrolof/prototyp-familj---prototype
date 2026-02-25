import { TierCard } from "@/app/components/TierCard";
import { TierDefinition, TierId } from "@/app/lib/types";

interface TierSelectorProps {
  tiers: TierDefinition[];
  selectedTier: TierId;
  onSelectTier: (tierId: TierId) => void;
}

export function TierSelector({ tiers, selectedTier, onSelectTier }: TierSelectorProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {tiers.map((tier) => (
        <TierCard
          key={tier.id}
          tier={tier}
          selected={tier.id === selectedTier}
          onSelect={onSelectTier}
        />
      ))}
    </div>
  );
}
