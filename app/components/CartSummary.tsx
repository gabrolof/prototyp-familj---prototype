"use client";

import { useEffect, useRef, useState } from "react";
import { SubscriptionLineCard } from "@/app/components/SubscriptionLineCard";
import { CartTotals, PricedCartLine } from "@/app/lib/types";

interface CartSummaryProps {
  tierLabel: string;
  lines: PricedCartLine[];
  totals: CartTotals;
  onRemoveLine: (lineId: string) => void;
  onRemoveDevice: (lineId: string) => void;
}

function isNoChangeLine(line: PricedCartLine): boolean {
  return (
    line.offer.offerType === "NONE" &&
    line.offer.reasonText.toLowerCase().includes("renewal blocked")
  );
}

export function CartSummary({
  tierLabel,
  lines,
  totals,
  onRemoveLine,
  onRemoveDevice,
}: CartSummaryProps) {
  const mainLineBase = lines.find((line) => line.role === "MAIN")?.price.base ?? 0;
  const activeLines = lines.filter((line) => !isNoChangeLine(line));
  const noChangeLines = lines.filter((line) => isNoChangeLine(line));

  const offerSavings = activeLines.reduce((sum, line) => sum + line.price.discount, 0);
  const subLineTierSavings = lines.reduce((sum, line) => {
    if (line.role !== "SUB" || isNoChangeLine(line)) {
      return sum;
    }

    return sum + Math.max(0, mainLineBase - line.price.base);
  }, 0);
  const monthlySavings = offerSavings + subLineTierSavings;
  const monthlyTotalWithoutDiscounts = totals.monthlyTotal + monthlySavings;
  const [isSavingsIncreasing, setIsSavingsIncreasing] = useState(false);
  const previousMonthlySavingsRef = useRef(monthlySavings);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (monthlySavings > previousMonthlySavingsRef.current) {
      setIsSavingsIncreasing(true);

      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      animationTimeoutRef.current = setTimeout(() => {
        setIsSavingsIncreasing(false);
      }, 900);
    }

    previousMonthlySavingsRef.current = monthlySavings;
  }, [monthlySavings]);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <aside className="panel lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto">
      <h2 className="text-lg font-semibold text-ink md:text-xl">Your order</h2>
      <p className="mb-4 text-sm text-slate-600">Selected plan: {tierLabel}</p>

      <div className="mb-4 rounded-2xl border border-slate-300 bg-gradient-to-br from-slate-50 via-white to-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Estimated totals
        </p>
        <div className="mt-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Monthly cost</p>
          <p className="text-xl font-bold text-green-700 md:text-2xl">
            {totals.monthlyTotal} SEK
            {monthlySavings > 0 ? (
              <span className="ml-2 text-xs font-medium text-slate-500 line-through">
                {monthlyTotalWithoutDiscounts} SEK
              </span>
            ) : null}
          </p>
        </div>
        <div className="mt-3 grid gap-1.5 text-sm">
          <p>
            Due today: <span className="font-semibold text-ink">{totals.oneTimeTotal} SEK</span>
          </p>
          <p>
            Contract length: <span className="font-semibold text-ink">up to {totals.bindingMonthsMax} months</span>
          </p>
        </div>
        <p
          className={`mt-3 inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800 ${
            isSavingsIncreasing ? "animate-savings-bump" : ""
          }`}
        >
          Monthly savings: <span className="ml-1">{monthlySavings} SEK</span>
        </p>
      </div>

      <div className="space-y-3">
        {activeLines.map((line) => {
          return (
            <SubscriptionLineCard
              key={line.id}
              line={line}
              mainLineBase={mainLineBase}
              className="border-slate-200 bg-white/95"
              canRemoveLine={line.role === "SUB" && !line.existingFamilyLine}
              onRemoveLine={onRemoveLine}
              showDeviceDetails
              onRemoveDevice={onRemoveDevice}
            />
          );
        })}
      </div>

      {noChangeLines.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-300" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Unchanged lines
            </span>
            <div className="h-px flex-1 bg-slate-300" />
          </div>
          <p className="text-xs text-slate-600">
            These lines are kept on current terms and will not be altered.
          </p>
          <div className="space-y-3">
            {noChangeLines.map((line) => (
              <div key={line.id}>
                <SubscriptionLineCard
                  line={line}
                  mainLineBase={mainLineBase}
                  className="border-slate-300 bg-white"
                />
                <p className="text-xs text-slate-600">{line.offer.reasonText}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <hr className="my-4 border-slate-200" />

      <div className="space-y-1 text-sm">
        <p className="font-semibold">Monthly total: {totals.monthlyTotal} SEK</p>
        <p>One-time total: {totals.oneTimeTotal} SEK</p>
        <p>Total binding (max): {totals.bindingMonthsMax} months</p>
      </div>
    </aside>
  );
}
