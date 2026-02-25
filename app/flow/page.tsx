import { FamilyFlowClient } from "@/app/components/FamilyFlowClient";
import { getTierDefinitions } from "@/app/lib/rules";
import type { TierId } from "@/app/lib/types";

export default async function FlowPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[]; tier?: string | string[] }>;
}) {
  const params = await searchParams;

  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const tierParam = Array.isArray(params.tier) ? params.tier[0] : params.tier;

  const initialMode = modeParam === "manage" ? "MANAGE" : "START";
  const tierIds = new Set(getTierDefinitions().map((tier) => tier.id));
  const initialTier: TierId = tierParam && tierIds.has(tierParam as TierId) ? (tierParam as TierId) : "15_GB";

  return <FamilyFlowClient initialMode={initialMode} initialTier={initialTier} />;
}
