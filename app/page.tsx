import { LandingPlanChooser } from "@/app/components/LandingPlanChooser";
import { getTierDefinitions } from "@/app/lib/rules";

export default function LandingPage() {
  const tiers = getTierDefinitions();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 md:py-10">
      <header className="panel mb-8 border-slate-200 bg-gradient-to-r from-white via-white to-slate-50">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-sun">Family plans</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight md:text-4xl">
          Pick a plan that fits your household
        </h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Compare data tiers, add family members, and estimate your monthly cost before checkout.
        </p>
      </header>

      <LandingPlanChooser tiers={tiers} />
    </main>
  );
}
