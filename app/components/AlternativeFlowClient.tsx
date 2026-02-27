"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CartSummary } from "@/app/components/CartSummary";
import { DeviceSelector } from "@/app/components/DeviceSelector";
import { LineEditor } from "@/app/components/LineEditor";
import { LoyaltyDiscountModal } from "@/app/components/LoyaltyDiscountModal";
import { VerificationModal } from "@/app/components/VerificationModal";
import {
  classifyCustomer,
  computeCartTotals,
  computeLinePrice,
  determineOffer,
  getCatalogDevices,
  getCustomerDb,
  getRenewalDiscount,
  getTierDefinitions,
} from "@/app/lib/rules";
import {
  CartLineDraft,
  CustomerContext,
  DeviceDefinition,
  DevicePaymentPeriod,
  DeviceSelection,
  OfferResult,
  PricedCartLine,
  TierId,
} from "@/app/lib/types";

type LoyaltyDecision = "ACCEPT" | "DECLINE";

interface LoyaltyEligibleLine {
  msisdn: string;
  role: "MAIN" | "SUB";
  discountSek: number;
}

interface AlternativeFlowClientProps {
  initialTier: TierId;
}

const EMPTY_OFFER: OfferResult = {
  offerType: "NONE",
  discountSek: 0,
  bindingMonths: 0,
  reasonText: "Enter a number to evaluate this line.",
};

function normalizeMsisdn(value: string): string {
  return value.replace(/\D/g, "");
}

function getDeviceTotalPrice(device: DeviceDefinition): number {
  if (device.priceType === "oneTime") {
    return device.price;
  }

  return device.price * 24;
}

function computeDeviceCharge(
  device: DeviceDefinition | null,
  paymentPeriod: DevicePaymentPeriod | undefined,
): { monthly: number; oneTime: number } {
  if (!device) {
    return { monthly: 0, oneTime: 0 };
  }

  const totalPrice = getDeviceTotalPrice(device);
  const effectivePeriod = paymentPeriod ?? "24_MONTH";

  if (effectivePeriod === "DIRECT") {
    return { monthly: 0, oneTime: totalPrice };
  }

  if (effectivePeriod === "36_MONTH") {
    return { monthly: Math.round(totalPrice / 36), oneTime: 0 };
  }

  return { monthly: Math.round(totalPrice / 24), oneTime: 0 };
}

function buildStartLines(context?: CustomerContext): CartLineDraft[] {
  const firstOwnedNumber = context?.type === "EXISTING" ? context.ownedNumbers[0]?.msisdn ?? "" : "";

  return [
    {
      id: "line-1",
      role: "MAIN",
      msisdn: firstOwnedNumber,
      deviceId: null,
      deviceSelection: null,
      existingFamilyLine: false,
    },
    {
      id: "line-2",
      role: "SUB",
      msisdn: "",
      deviceId: null,
      deviceSelection: null,
      existingFamilyLine: false,
    },
  ];
}

function buildFamilyLines(context: CustomerContext): CartLineDraft[] {
  return context.existingFamilyLines.map((msisdn, index) => ({
    id: `line-${index + 1}`,
    role: index === 0 ? "MAIN" : "SUB",
    msisdn,
    deviceId: null,
    deviceSelection: null,
    existingFamilyLine: true,
  }));
}

export function AlternativeFlowClient({ initialTier }: AlternativeFlowClientProps) {
  const router = useRouter();

  const tiers = getTierDefinitions();
  const devices = getCatalogDevices() as DeviceDefinition[];
  const customerDb = getCustomerDb();

  const [ssnInput, setSsnInput] = useState("");
  const [loggedInSsn, setLoggedInSsn] = useState<string | null>(null);
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null);
  const [selectedTier, setSelectedTier] = useState<TierId>(initialTier);
  const [isTierQuickSelectOpen, setIsTierQuickSelectOpen] = useState(false);
  const [lines, setLines] = useState<CartLineDraft[]>(buildStartLines());

  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false);
  const [hasSeenLoyaltyBridge, setHasSeenLoyaltyBridge] = useState(false);
  const [eligibleLoyaltyLines, setEligibleLoyaltyLines] = useState<LoyaltyEligibleLine[]>([]);
  const [loyaltyDecisionByMsisdn, setLoyaltyDecisionByMsisdn] = useState<
    Record<string, LoyaltyDecision | undefined>
  >({});

  const lineCounterRef = useRef(3);
  const orderCounterRef = useRef(1);

  const hasActiveFamily = useMemo(() => {
    return !!customerContext?.hasFamily && customerContext.existingFamilyLines.length > 0;
  }, [customerContext]);

  const familyLinesInBinding = useMemo(() => {
    if (!customerContext || !hasActiveFamily) {
      return [] as string[];
    }

    const familyLineSet = new Set(customerContext.existingFamilyLines);

    return customerContext.ownedNumbers
      .filter((number) => familyLineSet.has(number.msisdn) && number.inBinding)
      .map((number) => number.msisdn);
  }, [customerContext, hasActiveFamily]);

  const isPriceplanChangeBlockedByBinding = familyLinesInBinding.length > 0;

  const setupLoyaltyDecisionGate = (
    context: CustomerContext,
    ssn: string,
    candidateLines: CartLineDraft[],
  ) => {
    const eligible = candidateLines
      .filter((line) => normalizeMsisdn(line.msisdn).length > 0)
      .map((line) => {
        const determinedOffer = determineOffer({
          ssn,
          msisdn: normalizeMsisdn(line.msisdn),
          lineRole: line.role,
          customerContext: context,
          db: customerDb,
        });

        if (determinedOffer.offerType !== "RENEWAL") {
          return null;
        }

        return {
          msisdn: normalizeMsisdn(line.msisdn),
          role: line.role,
          discountSek: getRenewalDiscount(line.role),
        } as LoyaltyEligibleLine;
      })
      .filter((line): line is LoyaltyEligibleLine => !!line);

    if (eligible.length === 0) {
      setEligibleLoyaltyLines([]);
      setLoyaltyDecisionByMsisdn({});
      setHasSeenLoyaltyBridge(false);
      setIsLoyaltyModalOpen(false);
      return;
    }

    const initialDecisions: Record<string, LoyaltyDecision | undefined> = {};
    for (const line of eligible) {
      initialDecisions[line.msisdn] = undefined;
    }

    setEligibleLoyaltyLines(eligible);
    setLoyaltyDecisionByMsisdn(initialDecisions);
    setHasSeenLoyaltyBridge(false);
    setIsLoyaltyModalOpen(true);
  };

  const applyLogin = () => {
    const normalizedSsn = ssnInput.trim();
    if (!normalizedSsn) {
      return;
    }

    const context = classifyCustomer(normalizedSsn, customerDb);
    const resolvedLines =
      context.hasFamily && context.existingFamilyLines.length > 0
        ? buildFamilyLines(context)
        : buildStartLines(context);

    setLoggedInSsn(normalizedSsn);
    setCustomerContext(context);
    setLines(resolvedLines);
    lineCounterRef.current = resolvedLines.length + 1;

    if (context.hasFamily && context.familyTier) {
      setSelectedTier(context.familyTier);
    } else {
      setSelectedTier(initialTier);
    }
    setIsTierQuickSelectOpen(false);

    setupLoyaltyDecisionGate(context, normalizedSsn, resolvedLines);
  };

  const resetSession = () => {
    setSsnInput("");
    setLoggedInSsn(null);
    setCustomerContext(null);
    setSelectedTier(initialTier);
    setIsTierQuickSelectOpen(false);
    setLines(buildStartLines());
    setIsLoyaltyModalOpen(false);
    setHasSeenLoyaltyBridge(false);
    setEligibleLoyaltyLines([]);
    setLoyaltyDecisionByMsisdn({});
    lineCounterRef.current = 3;
  };

  const addSubLine = (prefill = "") => {
    setLines((previousLines) => [
      ...previousLines,
      {
        id: `line-${lineCounterRef.current++}`,
        role: "SUB",
        msisdn: prefill,
        deviceId: null,
        deviceSelection: null,
        existingFamilyLine: false,
      },
    ]);
  };

  const handleRemoveLine = (lineId: string) => {
    setLines((previousLines) =>
      previousLines.filter((line) => {
        if (line.id !== lineId) {
          return true;
        }

        return line.role === "MAIN" || line.existingFamilyLine;
      }),
    );
  };

  const handleChangeMsisdn = (
    lineId: string,
    msisdn: string,
    source: "manual" | "picker" = "manual",
  ) => {
    const targetLine = lines.find((line) => line.id === lineId);
    const previousMsisdn = targetLine ? normalizeMsisdn(targetLine.msisdn) : "";

    setLines((previousLines) =>
      previousLines.map((line) => (line.id === lineId ? { ...line, msisdn } : line)),
    );

    if (previousMsisdn && previousMsisdn !== normalizeMsisdn(msisdn)) {
      setLoyaltyDecisionByMsisdn((previousDecisions) => {
        const nextDecisions = { ...previousDecisions };
        delete nextDecisions[previousMsisdn];
        return nextDecisions;
      });
    }

    if (source !== "manual" && source !== "picker") {
      return;
    }

    if (!targetLine || !customerContext || !loggedInSsn) {
      return;
    }

    const normalizedMsisdn = normalizeMsisdn(msisdn);
    if (!normalizedMsisdn) {
      return;
    }

    const determinedOffer = determineOffer({
      ssn: loggedInSsn,
      msisdn: normalizedMsisdn,
      lineRole: targetLine.role,
      customerContext,
      db: customerDb,
    });

    if (determinedOffer.offerType !== "RENEWAL") {
      return;
    }

    setLoyaltyDecisionByMsisdn((previousDecisions) => ({
      ...previousDecisions,
      [normalizedMsisdn]: undefined,
    }));
  };

  const handleSelectDevice = (
    lineId: string,
    payload: { deviceId: string; selection: DeviceSelection } | null,
  ) => {
    setLines((previousLines) =>
      previousLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              deviceId: payload?.deviceId ?? null,
              deviceSelection: payload?.selection ?? null,
            }
          : line,
      ),
    );
  };

  const offersByLineId = useMemo(() => {
    const lookup: Record<string, OfferResult> = {};

    for (const line of lines) {
      if (!loggedInSsn || !customerContext) {
        lookup[line.id] = EMPTY_OFFER;
        continue;
      }

      const normalizedMsisdn = normalizeMsisdn(line.msisdn);
      if (!normalizedMsisdn) {
        lookup[line.id] = EMPTY_OFFER;
        continue;
      }

      const determinedOffer = determineOffer({
        ssn: loggedInSsn,
        msisdn: normalizedMsisdn,
        lineRole: line.role,
        customerContext,
        db: customerDb,
      });

      if (determinedOffer.offerType === "RENEWAL") {
        const decision = loyaltyDecisionByMsisdn[normalizedMsisdn];

        if (decision === "ACCEPT") {
          lookup[line.id] = determinedOffer;
          continue;
        }

        lookup[line.id] = {
          offerType: "NONE",
          discountSek: 0,
          bindingMonths: 0,
          reasonText:
            decision === "DECLINE"
              ? "Loyalty discount declined. Standard pricing applies."
              : "Claim offer is available for this line.",
        };
        continue;
      }

      lookup[line.id] = determinedOffer;
    }

    return lookup;
  }, [lines, loggedInSsn, customerContext, customerDb, loyaltyDecisionByMsisdn]);

  const showClaimOfferCtaByLineId = useMemo(() => {
    const lookup: Record<string, boolean> = {};

    if (!customerContext || !loggedInSsn) {
      return lookup;
    }

    for (const line of lines) {
      const normalizedMsisdn = normalizeMsisdn(line.msisdn);
      if (!normalizedMsisdn || loyaltyDecisionByMsisdn[normalizedMsisdn] === "ACCEPT") {
        continue;
      }

      const determinedOffer = determineOffer({
        ssn: loggedInSsn,
        msisdn: normalizedMsisdn,
        lineRole: line.role,
        customerContext,
        db: customerDb,
      });

      if (determinedOffer.offerType === "RENEWAL") {
        lookup[line.id] = true;
      }
    }

    return lookup;
  }, [lines, loyaltyDecisionByMsisdn, customerContext, loggedInSsn, customerDb]);

  const pricedLines = useMemo<PricedCartLine[]>(() => {
    return lines.map((line) => {
      const offer = offersByLineId[line.id] ?? EMPTY_OFFER;
      const price = computeLinePrice({ tier: selectedTier, lineRole: line.role, offer });
      const selectedDevice = devices.find((device) => device.id === line.deviceId) ?? null;
      const deviceCharge = computeDeviceCharge(selectedDevice, line.deviceSelection?.paymentPeriod);

      return {
        id: line.id,
        role: line.role,
        msisdn: line.msisdn,
        deviceId: line.deviceId,
        deviceSelection: line.deviceSelection,
        existingFamilyLine: line.existingFamilyLine,
        offer,
        price,
        deviceMonthly: deviceCharge.monthly,
        deviceOneTime: deviceCharge.oneTime,
      };
    });
  }, [lines, offersByLineId, selectedTier, devices]);

  const totals = useMemo(() => computeCartTotals(pricedLines), [pricedLines]);

  const selectedTierDefinition = tiers.find((tier) => tier.id === selectedTier);
  const mainLineBasePrice = selectedTierDefinition?.prices.main ?? 0;
  const subLineBasePrice = selectedTierDefinition?.prices.sub ?? 0;
  const subLinePlanSavings = Math.max(0, mainLineBasePrice - subLineBasePrice);

  const lineSavingsByLineId = useMemo(() => {
    const lookup: Record<
      string,
      {
        planSavings: number;
        offerSavings: number;
        totalSavings: number;
      }
    > = {};

    for (const line of lines) {
      const offerSavings = offersByLineId[line.id]?.discountSek ?? 0;
      const planSavings = line.role === "SUB" ? subLinePlanSavings : 0;

      lookup[line.id] = {
        planSavings,
        offerSavings,
        totalSavings: planSavings + offerSavings,
      };
    }

    return lookup;
  }, [lines, offersByLineId, subLinePlanSavings]);

  const deviceLockReasonByLineId = useMemo(() => {
    const lookup: Record<string, string | undefined> = {};

    if (!customerContext) {
      return lookup;
    }

    for (const line of lines) {
      const normalizedMsisdn = normalizeMsisdn(line.msisdn);
      if (!normalizedMsisdn) {
        continue;
      }

      const ownedLine = customerContext.ownedNumbers.find((number) => number.msisdn === normalizedMsisdn);
      if (ownedLine?.inBinding) {
        lookup[line.id] = "This number is in binding, so device changes are unavailable.";
      }
    }

    return lookup;
  }, [lines, customerContext]);

  const ownedNumbers =
    customerContext && customerContext.type === "EXISTING" && !hasActiveFamily
      ? customerContext.ownedNumbers
      : [];

  const mainLineCount = lines.filter((line) => line.role === "MAIN").length;
  const hasMinimumLines = lines.length >= 2;
  const allLinesHaveNumber = lines.every((line) => line.msisdn.trim().length > 0);

  const validationErrors: string[] = [];
  if (!loggedInSsn) {
    validationErrors.push("Sign in with BankID before placing the order.");
  }
  if (mainLineCount !== 1) {
    validationErrors.push("Your plan must include exactly one primary line.");
  }
  if (!hasMinimumLines) {
    validationErrors.push("Family plans require at least 2 lines in total.");
  }
  if (!allLinesHaveNumber) {
    validationErrors.push("Enter a phone number for every line.");
  }

  const canCheckout = validationErrors.length === 0;

  const handleClaimOfferForLine = (lineId: string) => {
    if (!customerContext || !loggedInSsn) {
      return;
    }

    const targetLine = lines.find((line) => line.id === lineId);
    if (!targetLine) {
      return;
    }

    const normalizedMsisdn = normalizeMsisdn(targetLine.msisdn);
    if (!normalizedMsisdn) {
      return;
    }

    const determinedOffer = determineOffer({
      ssn: loggedInSsn,
      msisdn: normalizedMsisdn,
      lineRole: targetLine.role,
      customerContext,
      db: customerDb,
    });

    if (determinedOffer.offerType !== "RENEWAL") {
      return;
    }

    setLoyaltyDecisionByMsisdn((previousDecisions) => ({
      ...previousDecisions,
      [normalizedMsisdn]: undefined,
    }));
    setEligibleLoyaltyLines([
      {
        msisdn: normalizedMsisdn,
        role: targetLine.role,
        discountSek: determinedOffer.discountSek,
      },
    ]);
    setIsLoyaltyModalOpen(true);
  };

  const handleSetLoyaltyDecision = (msisdn: string, decision: LoyaltyDecision) => {
    setLoyaltyDecisionByMsisdn((previousDecisions) => ({ ...previousDecisions, [msisdn]: decision }));
  };

  const canConfirmLoyaltyChoices =
    eligibleLoyaltyLines.length > 0 &&
    eligibleLoyaltyLines.every((line) => loyaltyDecisionByMsisdn[line.msisdn] !== undefined);

  const handleConfirmLoyaltyChoices = () => {
    if (!canConfirmLoyaltyChoices) {
      return;
    }

    setHasSeenLoyaltyBridge(true);
    setIsLoyaltyModalOpen(false);
  };

  const placeOrder = () => {
    if (!canCheckout || !loggedInSsn) {
      return;
    }

    const orderId = `ALT-${String(orderCounterRef.current).padStart(4, "0")}`;
    orderCounterRef.current += 1;

    router.push(`/confirmation?orderId=${orderId}&ssn=${encodeURIComponent(loggedInSsn)}`);
  };

  const handleSelectTierQuick = (tierId: TierId) => {
    if (isPriceplanChangeBlockedByBinding && tierId !== selectedTier) {
      return;
    }

    setSelectedTier(tierId);
    setIsTierQuickSelectOpen(false);
  };

  const tierLabel = tiers.find((tier) => tier.id === selectedTier)?.label ?? selectedTier;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:py-8">
      {!loggedInSsn ? (
        <VerificationModal ssnInput={ssnInput} onChangeSsn={setSsnInput} onVerify={applyLogin} />
      ) : null}

      {isLoyaltyModalOpen && eligibleLoyaltyLines.length > 0 ? (
        <LoyaltyDiscountModal
          tier={selectedTier}
          mainLineBase={mainLineBasePrice}
          lines={eligibleLoyaltyLines}
          decisions={loyaltyDecisionByMsisdn}
          showBridge={!hasSeenLoyaltyBridge}
          onSetDecision={handleSetLoyaltyDecision}
          onConfirm={handleConfirmLoyaltyChoices}
        />
      ) : null}

      <header className="panel mb-6 flex flex-col gap-3 border-slate-200 bg-gradient-to-r from-white via-white to-slate-50 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sun">Alternative</p>
          <h1 className="text-2xl font-bold leading-tight md:text-3xl">Condensed family flow</h1>
          <p className="mt-1 text-sm text-slate-600">Only actions available to this account are shown.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {loggedInSsn ? (
            <button type="button" className="button-secondary" onClick={resetSession}>
              Switch customer
            </button>
          ) : null}
          <button type="button" className="button-secondary" onClick={() => router.push("/")}>
            Back to plans
          </button>
        </div>
      </header>

      {loggedInSsn ? (
        <>
          <div className="mb-5 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 text-sm text-slate-700 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="mr-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Active plan
                  </span>
                  <span className="font-semibold text-ink">{tierLabel}</span>
                </div>
                <button
                  type="button"
                  className="button-secondary px-3 py-1.5 text-xs md:text-sm"
                  onClick={() => setIsTierQuickSelectOpen((open) => !open)}
                >
                  {isTierQuickSelectOpen ? "Close plan picker" : "Change priceplan"}
                </button>
              </div>
            </div>

            {isTierQuickSelectOpen ? (
              <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm">
                <p className="text-sm font-semibold text-ink">Quick select priceplan</p>
                <p className="mt-1 text-xs text-slate-600">
                  Choose the tier that fits best. USPs are shown below; pricing is hidden here.
                </p>
                {isPriceplanChangeBlockedByBinding ? (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
                    Priceplan change blocked due to binding on: {familyLinesInBinding.join(", ")}
                  </p>
                ) : null}
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {tiers.map((tier) => {
                    const isSelected = tier.id === selectedTier;
                    const isDisabled = isPriceplanChangeBlockedByBinding && !isSelected;

                    return (
                      <button
                        key={tier.id}
                        type="button"
                        className={`rounded-xl border p-3 text-left transition ${
                          isDisabled
                            ? "cursor-not-allowed border-red-200 bg-red-50/60 text-red-900"
                            : isSelected
                            ? "border-ink bg-slate-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm"
                        }`}
                        onClick={() => handleSelectTierQuick(tier.id)}
                        disabled={isDisabled}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-ink">{tier.label}</p>
                          {isSelected ? (
                            <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700">
                              Selected
                            </span>
                          ) : null}
                        </div>
                        <ul className="mt-2 list-disc pl-4 text-xs text-slate-600">
                          <li>{tier.description}</li>
                        </ul>
                        {isDisabled ? (
                          <p className="mt-2 text-xs font-medium text-red-800">
                            Cannot change due to binding on: {familyLinesInBinding.join(", ")}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-4">
              <LineEditor
                lines={lines}
                offersByLineId={offersByLineId}
                ownedNumbers={ownedNumbers}
                lineSavingsByLineId={lineSavingsByLineId}
                showClaimOfferCtaByLineId={showClaimOfferCtaByLineId}
                onClaimOfferForLine={handleClaimOfferForLine}
                onChangeMsisdn={handleChangeMsisdn}
                onAddSubLine={addSubLine}
                onRemoveLine={handleRemoveLine}
                showAddLineAction
                allowRemoveSubLines
                showAllOwnedNumbersInPicker
                hideSavingsInConfigurator
                addLineLabel="+ Add member"
                minimalOfferHint
                addLineDisabled={false}
                collapseUnchangedLines
                familyPlanListMode={hasActiveFamily}
              />

              <DeviceSelector
                lines={lines}
                devices={devices}
                deviceLockReasonByLineId={deviceLockReasonByLineId}
                onSelectDevice={handleSelectDevice}
                hidePricingDetails
                collapseLockedLines
              />
            </section>

            <section className="space-y-3">
              <CartSummary
                tierLabel={tierLabel}
                lines={pricedLines}
                totals={totals}
                onRemoveLine={handleRemoveLine}
                onRemoveDevice={(lineId) => handleSelectDevice(lineId, null)}
              />

              {validationErrors.length > 0 ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {validationErrors[0]}
                </div>
              ) : null}

              <button
                type="button"
                className="button-primary w-full"
                onClick={placeOrder}
                disabled={!canCheckout}
              >
                Place order
              </button>
            </section>
          </div>
        </>
      ) : null}
    </main>
  );
}
