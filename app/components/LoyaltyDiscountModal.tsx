"use client";

import { useEffect, useState } from "react";
import { SubscriptionLineCard } from "@/app/components/SubscriptionLineCard";
import { computeLinePrice } from "@/app/lib/rules";
import { LineRole, OfferResult, PricedCartLine, TierId } from "@/app/lib/types";

type LoyaltyDecision = "ACCEPT" | "DECLINE";

interface LoyaltyLineChoice {
  msisdn: string;
  role: LineRole;
  discountSek: number;
}

interface LoyaltyDiscountModalProps {
  tier: TierId;
  mainLineBase: number;
  lines: LoyaltyLineChoice[];
  decisions: Record<string, LoyaltyDecision | undefined>;
  showBridge: boolean;
  onSetDecision: (msisdn: string, decision: LoyaltyDecision) => void;
  onConfirm: () => void;
}

export function LoyaltyDiscountModal({
  tier,
  mainLineBase,
  lines,
  decisions,
  showBridge,
  onSetDecision,
  onConfirm,
}: LoyaltyDiscountModalProps) {
  const [isFetchingOffers, setIsFetchingOffers] = useState(showBridge);
  const allDecided = lines.every((line) => !!decisions[line.msisdn]);

  useEffect(() => {
    if (!showBridge) {
      setIsFetchingOffers(false);
      return;
    }

    setIsFetchingOffers(true);
    const timer = window.setTimeout(() => {
      setIsFetchingOffers(false);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showBridge, lines]);

  const buildPreviewLine = (
    line: LoyaltyLineChoice,
    offer: OfferResult,
    idSuffix: string,
  ): PricedCartLine => ({
    id: `${line.msisdn}-${idSuffix}`,
    role: line.role,
    msisdn: line.msisdn,
    deviceId: null,
    deviceSelection: null,
    existingFamilyLine: true,
    offer,
    price: computeLinePrice({ tier, lineRole: line.role, offer }),
    deviceMonthly: 0,
    deviceOneTime: 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-3xl max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        {isFetchingOffers ? (
          <div className="relative flex min-h-[320px] flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-white px-6 text-center">
            <div className="pointer-events-none absolute -left-14 top-8 h-36 w-36 rounded-full bg-violet-300/35 blur-2xl" />
            <div className="pointer-events-none absolute -right-14 bottom-10 h-40 w-40 rounded-full bg-fuchsia-300/35 blur-2xl" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.82),transparent_58%)]" />

            <p className="relative z-10 rounded-full border border-violet-300/70 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">
              Exclusive loyalty perks
            </p>
            <h2 className="relative z-10 mt-4 max-w-2xl text-3xl font-extrabold leading-tight text-violet-900 md:text-4xl">
              Congratulations!
            </h2>
            <p className="relative z-10 mt-2 max-w-2xl text-xl font-semibold leading-tight text-violet-900/90 md:text-2xl">
              You are eligible for sweet sweet discounts
            </p>
            <p className="relative z-10 mt-3 max-w-xl text-sm font-medium text-violet-900/75">
              We are now unlocking your best available offers. This takes just a moment.
            </p>

            <div className="relative z-10 mt-7 flex items-center gap-3 rounded-full border border-violet-300/70 bg-white/85 px-5 py-2.5 shadow-sm">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700" />
              <span className="text-sm font-semibold text-violet-900">Fetching your offers...</span>
            </div>
            <div className="relative z-10 mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-violet-200/80">
              <span className="block h-full w-full animate-pulse rounded-full bg-violet-600/80" />
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-sun">Loyalty offer</p>
            <h2 className="mt-1 text-2xl font-bold text-ink">Choose loyalty discount per line</h2>
            <p className="mt-1 text-sm text-slate-600">
              You can claim each discount with a new 24-month binding period, or continue without it.
            </p>

            <div className="mt-4 min-h-0 space-y-3 overflow-y-auto pr-1">
              {lines.map((line) => {
                const decision = decisions[line.msisdn];
                const claimOffer: OfferResult = {
                  offerType: "RENEWAL",
                  discountSek: line.discountSek,
                  bindingMonths: 24,
                  reasonText: "Loyalty discount claimed for this line.",
                };
                const noThanksOffer: OfferResult = {
                  offerType: "NONE",
                  discountSek: 0,
                  bindingMonths: 0,
                  reasonText: "Loyalty discount declined for this line.",
                };
                const previewDecision: LoyaltyDecision = decision ?? "ACCEPT";
                const previewIsClaim = previewDecision === "ACCEPT";
                const previewOffer = previewIsClaim ? claimOffer : noThanksOffer;
                const previewLine = buildPreviewLine(
                  line,
                  previewOffer,
                  previewIsClaim ? "claim" : "decline",
                );
                const previewSavings = Math.max(0, mainLineBase - previewLine.price.final);
                const showSaveBadge = previewSavings > 0;

                return (
                  <div key={line.msisdn} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink">
                        {line.role === "MAIN" ? "Primary line" : "Extra line"} - {line.msisdn}
                      </p>
                      {showSaveBadge ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-900">
                          Save {previewSavings} SEK/mo
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <p
                        className={`mb-1 text-xs font-semibold uppercase tracking-wide ${
                          previewIsClaim ? "text-violet-700" : "text-slate-600"
                        }`}
                      >
                        Preview: {previewIsClaim ? "Claim discount" : "No thanks"}
                      </p>
                      <SubscriptionLineCard
                        line={previewLine}
                        mainLineBase={mainLineBase}
                        className={
                          previewIsClaim
                            ? "border-violet-300 bg-violet-50/60 ring-1 ring-violet-300"
                            : "border-slate-200 bg-white ring-1 ring-slate-300"
                        }
                      />
                    </div>
                    <p className="mt-3 text-xs text-slate-600">Requires 24-month binding if claimed.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                          decision === "ACCEPT"
                            ? "border-violet-700 bg-violet-700 text-white"
                            : "border-violet-300 bg-white text-violet-800 hover:bg-violet-50"
                        }`}
                        onClick={() => onSetDecision(line.msisdn, "ACCEPT")}
                      >
                        Claim discount
                      </button>
                      <button
                        type="button"
                        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                          decision === "DECLINE"
                            ? "border-slate-700 bg-slate-700 text-white"
                            : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                        }`}
                        onClick={() => onSetDecision(line.msisdn, "DECLINE")}
                      >
                        No thanks
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <button type="button" className="button-primary" onClick={onConfirm} disabled={!allDecided}>
                Apply choices
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
