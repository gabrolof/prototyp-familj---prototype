import { AlternativeFlowClient } from "@/app/components/AlternativeFlowClient";
import { getTierDefinitions } from "@/app/lib/rules";
import type { TierId } from "@/app/lib/types";

export default async function AlternativePage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string | string[] }>;
}) {
  const params = await searchParams;
  const tierParam = Array.isArray(params.tier) ? params.tier[0] : params.tier;

  const tierIds = new Set(getTierDefinitions().map((tier) => tier.id));
  const initialTier: TierId = tierParam && tierIds.has(tierParam as TierId) ? (tierParam as TierId) : "15_GB";

  return <AlternativeFlowClient initialTier={initialTier} />;
}
