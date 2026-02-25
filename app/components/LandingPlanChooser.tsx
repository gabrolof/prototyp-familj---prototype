"use client";

import Link from "next/link";
import { getNewCustomerDiscount } from "@/app/lib/rules";
import { TierDefinition } from "@/app/lib/types";

interface LandingPlanChooserProps {
  tiers: TierDefinition[];
}

export function LandingPlanChooser({ tiers }: LandingPlanChooserProps) {
  return (
    <>
      <section className="panel mb-6 border-slate-200 bg-gradient-to-b from-white via-white to-slate-50">
        <h2 className="mb-1 text-xl font-semibold md:text-2xl">New to family? start here!</h2>
        <p className="mb-4 text-sm text-slate-600 md:text-[15px]">
          Pick a plan to start checkout. Prices below assume new-customer discounts.
        </p>

        <div className="grid gap-3 md:auto-rows-fr md:grid-cols-3">
          {tiers.map((tier) => {
            const discountedMain = Math.max(0, tier.prices.main - getNewCustomerDiscount("MAIN"));
            const discountedSub = Math.max(0, tier.prices.sub - getNewCustomerDiscount("SUB"));

            return (
              <article
                key={tier.id}
                className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-px hover:border-slate-500 hover:shadow-md"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">{tier.label}</h3>
                    <span className="rounded-full border border-green-200 bg-green-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-green-900">
                      Sign on bonus
                    </span>
                  </div>
                  <div className="mt-3">
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      <li>{tier.description}</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm">
                  <p className="text-ink">
                    <span className="font-semibold">Primary line: </span>
                    <span className="font-semibold text-green-700">{discountedMain} SEK/mo</span>
                    <span className="ml-2 text-xs text-slate-500 line-through">{tier.prices.main} SEK/mo</span>
                  </p>
                  <p className="mt-1 text-ink">
                    <span className="font-semibold">Extra line: </span>
                    <span className="font-semibold text-green-700">{discountedSub} SEK/mo</span>
                    <span className="ml-2 text-xs text-slate-500 line-through">{tier.prices.sub} SEK/mo</span>
                  </p>
                </div>

                <div className="mt-auto pt-4">
                  <Link href={`/flow?tier=${tier.id}`} className="button-primary inline-flex w-full justify-center">
                    Continue with this plan
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-4 text-sm text-slate-600">
          The prices shown above are for new customers. Based on your current contract, pricing can
          change in the next step.
        </p>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-300 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-5 shadow-[0_18px_30px_-24px_rgba(15,23,42,0.75)]">
        <p className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink shadow-sm">
          Existing Customer Path
        </p>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
          <div>
            <h2 className="text-xl font-semibold text-white md:text-2xl">Already have a family plan?</h2>
            <p className="mt-1 text-sm text-slate-200 md:text-[15px]">
              Start here if you already have a family subscription and want to make changes.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-200">
              <li>Add new family lines</li>
              <li>Pick phones for existing lines</li>
              <li>Review upgrades before placing order</li>
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/flow?mode=manage"
              className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-px hover:bg-slate-100 hover:shadow-md md:min-w-[220px]"
            >
              Manage Family
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
