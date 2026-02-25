import { LandingPlanChooser } from "@/app/components/LandingPlanChooser";
import { getTierDefinitions } from "@/app/lib/rules";

export default function LandingPage() {
  const tiers = getTierDefinitions();

  return (
    <>
      <section className="w-full bg-[#211f45]">
        <div className="mx-auto max-w-6xl px-4 pt-5 pb-6 md:pt-7 md:pb-7">
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
            Family plans
          </h1>
          <div className="mt-6 flex flex-wrap gap-4 text-base text-white/95 md:gap-8 md:text-lg">
            <p>✓ Lower cost</p>
            <p>✓ One invoice</p>
            <p>✓ Best 5G coverage in Sweden</p>
          </div>
        </div>
      </section>

      <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 md:py-10">
        <LandingPlanChooser tiers={tiers} />
      </main>
    </>
  );
}
