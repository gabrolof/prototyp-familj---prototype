"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartSummary } from "@/app/components/CartSummary";
import { DebugPanel } from "@/app/components/DebugPanel";
import { DeviceSelector } from "@/app/components/DeviceSelector";
import { LineEditor } from "@/app/components/LineEditor";
import { LoyaltyDiscountModal } from "@/app/components/LoyaltyDiscountModal";
import { Stepper } from "@/app/components/Stepper";
import { VerificationModal } from "@/app/components/VerificationModal";
import {
  classifyCustomer,
  computeCartTotals,
  computeLinePrice,
  determineOffer,
  getCaseClassification,
  getCatalogDevices,
  getCustomerDb,
  getNewCustomerDiscount,
  getRenewalDiscount,
  getTierDefinitions,
} from "@/app/lib/rules";
import {
  CartLineDraft,
  CustomerContext,
  DevicePaymentPeriod,
  DeviceSelection,
  DeviceDefinition,
  OfferResult,
  PricedCartLine,
  TierId,
} from "@/app/lib/types";

type FlowMode = "START" | "MANAGE";
type LoyaltyDecision = "ACCEPT" | "DECLINE";

interface LoyaltyEligibleLine {
  msisdn: string;
  role: "MAIN" | "SUB";
  discountSek: number;
}

const STEP_LABELS = [
  "Add family lines",
  "Choose devices",
  "Review and place order",
];

const EMPTY_OFFER: OfferResult = {
  offerType: "NONE",
  discountSek: 0,
  bindingMonths: 0,
  reasonText: "Enter a phone number to see eligible offers.",
};

const ASSUMED_NEW_CUSTOMER_REASON =
  "Estimated new-customer discount is shown until account verification is completed.";

interface FamilyFlowClientProps {
  initialMode: FlowMode;
  initialTier: TierId;
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

function buildStartLines(): CartLineDraft[] {
  return [
    {
      id: "line-1",
      role: "MAIN",
      msisdn: "",
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

function buildManageLines(context: CustomerContext): CartLineDraft[] {
  if (!context.hasFamily || context.existingFamilyLines.length === 0) {
    return buildStartLines();
  }

  return context.existingFamilyLines.map((msisdn, index) => ({
    id: `line-${index + 1}`,
    role: index === 0 ? "MAIN" : "SUB",
    msisdn,
    deviceId: null,
    deviceSelection: null,
    existingFamilyLine: true,
  }));
}

export function FamilyFlowClient({ initialMode, initialTier }: FamilyFlowClientProps) {
  const router = useRouter();

  const tiers = getTierDefinitions();
  const devices = getCatalogDevices() as DeviceDefinition[];
  const customerDb = getCustomerDb();

  const [flowMode, setFlowMode] = useState<FlowMode>(initialMode);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState<TierId>(initialTier);
  const [isTierQuickSelectOpen, setIsTierQuickSelectOpen] = useState(false);
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false);
  const [hasSeenLoyaltyBridge, setHasSeenLoyaltyBridge] = useState(false);
  const [eligibleLoyaltyLines, setEligibleLoyaltyLines] = useState<LoyaltyEligibleLine[]>([]);
  const [loyaltyDecisionByMsisdn, setLoyaltyDecisionByMsisdn] = useState<
    Record<string, LoyaltyDecision | undefined>
  >({});
  const [showStep1NumberErrors, setShowStep1NumberErrors] = useState(false);
  const [ssnInput, setSsnInput] = useState("");
  const [loggedInSsn, setLoggedInSsn] = useState<string | null>(null);
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null);
  const [lines, setLines] = useState<CartLineDraft[]>(buildStartLines());

  const lineCounterRef = useRef(3);
  const orderCounterRef = useRef(1);

  const resetLineCounter = (nextLines: CartLineDraft[]) => {
    lineCounterRef.current = nextLines.length + 1;
  };

  const setLinesAndResetCounter = (nextLines: CartLineDraft[]) => {
    setLines(nextLines);
    resetLineCounter(nextLines);
  };

  const setupLoyaltyDecisionGate = (
    context: CustomerContext,
    resolvedMode: FlowMode,
    candidateLines: CartLineDraft[],
  ) => {
    if (!(resolvedMode === "MANAGE" && context.hasFamily)) {
      setEligibleLoyaltyLines([]);
      setLoyaltyDecisionByMsisdn({});
      setIsLoyaltyModalOpen(false);
      return;
    }

    const eligibleLines = candidateLines
      .filter((line) => line.existingFamilyLine)
      .map((line) => {
        const ownedLine = context.ownedNumbers.find((number) => number.msisdn === line.msisdn);
        if (!ownedLine) {
          return null;
        }

        if (ownedLine.inBinding && !ownedLine.bindingCompatibleWithRenewalOffer) {
          return null;
        }

        return {
          msisdn: line.msisdn,
          role: line.role,
          discountSek: getRenewalDiscount(line.role),
        } as LoyaltyEligibleLine;
      })
      .filter((line): line is LoyaltyEligibleLine => !!line);

    if (eligibleLines.length === 0) {
      setEligibleLoyaltyLines([]);
      setLoyaltyDecisionByMsisdn({});
      setIsLoyaltyModalOpen(false);
      return;
    }

    const initialDecisions: Record<string, LoyaltyDecision | undefined> = {};
    for (const line of eligibleLines) {
      initialDecisions[line.msisdn] = undefined;
    }

    setEligibleLoyaltyLines(eligibleLines);
    setLoyaltyDecisionByMsisdn(initialDecisions);
    setIsLoyaltyModalOpen(true);
  };

  const applyLogin = (ssn: string, forceMode?: FlowMode) => {
    const context = classifyCustomer(ssn, customerDb);
    const resolvedMode: FlowMode =
      forceMode ?? (context.hasFamily ? "MANAGE" : flowMode === "MANAGE" ? "START" : flowMode);

    const nextLines =
      resolvedMode === "MANAGE" && context.hasFamily ? buildManageLines(context) : buildStartLines();

    setLoggedInSsn(ssn);
    setCustomerContext(context);
    setFlowMode(resolvedMode);
    setIsTierQuickSelectOpen(false);
    setHasSeenLoyaltyBridge(false);
    setLinesAndResetCounter(nextLines);

    if (resolvedMode === "MANAGE" && context.familyTier) {
      setSelectedTier(context.familyTier);
    }

    setupLoyaltyDecisionGate(context, resolvedMode, nextLines);
  };

  const addSubLine = (prefill = "") => {
    setLines((prev) => [
      ...prev,
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

  const offersByLineId = useMemo(() => {
    const lookup: Record<string, OfferResult> = {};

    for (const line of lines) {
      if (!loggedInSsn || !customerContext) {
        if (initialMode === "START") {
          lookup[line.id] = {
            offerType: "NEW_CUSTOMER",
            discountSek: getNewCustomerDiscount(line.role),
            bindingMonths: 24,
            reasonText: ASSUMED_NEW_CUSTOMER_REASON,
          };
        } else {
          lookup[line.id] = EMPTY_OFFER;
        }
        continue;
      }

      const determinedOffer = determineOffer({
        ssn: loggedInSsn,
        msisdn: line.msisdn,
        lineRole: line.role,
        customerContext,
        db: customerDb,
      });

      if (determinedOffer.offerType === "RENEWAL") {
        const decision = loyaltyDecisionByMsisdn[line.msisdn.trim()];

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
              ? "Loyalty discount was declined. Standard pricing applies."
              : "Claim offer is available for this line.",
        };
        continue;
      }

      lookup[line.id] = determinedOffer;
    }

    return lookup;
  }, [lines, loggedInSsn, customerContext, customerDb, initialMode, loyaltyDecisionByMsisdn]);

  const pricedLines = useMemo<PricedCartLine[]>(() => {
    return lines.map((line) => {
      const offer = offersByLineId[line.id] ?? EMPTY_OFFER;
      const price = computeLinePrice({ tier: selectedTier, lineRole: line.role, offer });
      const selectedDevice = devices.find((device) => device.id === line.deviceId) ?? null;
      const deviceCharge = computeDeviceCharge(
        selectedDevice,
        line.deviceSelection?.paymentPeriod,
      );

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
  const showClaimOfferCtaByLineId = useMemo(() => {
    const lookup: Record<string, boolean> = {};

    if (!customerContext || !loggedInSsn) {
      return lookup;
    }

    for (const line of lines) {
      const msisdn = line.msisdn.trim();
      if (!msisdn || loyaltyDecisionByMsisdn[msisdn] === "ACCEPT") {
        continue;
      }

      const determinedOffer = determineOffer({
        ssn: loggedInSsn,
        msisdn,
        lineRole: line.role,
        customerContext,
        db: customerDb,
      });

      if (determinedOffer.offerType !== "RENEWAL") {
        continue;
      }

      lookup[line.id] = true;
    }

    return lookup;
  }, [lines, loyaltyDecisionByMsisdn, customerContext, loggedInSsn, customerDb]);

  const tierLabel = tiers.find((tier) => tier.id === selectedTier)?.label ?? selectedTier;
  const ownedNumbers =
    customerContext && customerContext.type === "EXISTING" && !customerContext.hasFamily
      ? customerContext.ownedNumbers
      : [];
  const familyLinesInBinding = useMemo(() => {
    if (!customerContext || !customerContext.hasFamily) {
      return [] as string[];
    }

    const familyLineSet = new Set(customerContext.existingFamilyLines);

    return customerContext.ownedNumbers
      .filter((number) => familyLineSet.has(number.msisdn) && number.inBinding)
      .map((number) => number.msisdn);
  }, [customerContext]);
  const isPriceplanChangeBlockedByBinding = familyLinesInBinding.length > 0;
  const deviceLockReasonByLineId = useMemo(() => {
    const lookup: Record<string, string | undefined> = {};

    if (!customerContext) {
      return lookup;
    }

    for (const line of lines) {
      const msisdn = line.msisdn.trim();
      if (!msisdn) {
        continue;
      }

      const ownedLine = customerContext.ownedNumbers.find((number) => number.msisdn === msisdn);
      if (ownedLine?.inBinding) {
        lookup[line.id] =
          "This number is currently in binding, so device changes are unavailable.";
      }
    }

    return lookup;
  }, [lines, customerContext]);

  const mainLineCount = lines.filter((line) => line.role === "MAIN").length;
  const hasPrimaryLineNumber = lines.some(
    (line) => line.role === "MAIN" && line.msisdn.trim().length > 0,
  );
  const hasSecondaryLineNumber = lines.some(
    (line) => line.role === "SUB" && line.msisdn.trim().length > 0,
  );
  const hasMinimumNumbersForStepNavigation = hasPrimaryLineNumber && hasSecondaryLineNumber;
  const hasMinimumLines = lines.length >= 2;
  const allLinesHaveNumber = lines.every((line) => line.msisdn.trim().length > 0);

  useEffect(() => {
    if (showStep1NumberErrors && hasMinimumNumbersForStepNavigation) {
      setShowStep1NumberErrors(false);
    }
  }, [showStep1NumberErrors, hasMinimumNumbersForStepNavigation]);

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
  const nextStepLabel = STEP_LABELS[currentStep] ?? STEP_LABELS[STEP_LABELS.length - 1];
  const canProceedFromCurrentStep = currentStep !== 1 || !!loggedInSsn;
  const showBackStepButton = currentStep > 1;
  const showContinueStepButton = currentStep < 3;
  const showPlaceOrderButton = currentStep === 3;

  const resetSelections = () => {
    setFlowMode(initialMode);
    setCurrentStep(1);
    setSelectedTier(initialTier);
    setIsTierQuickSelectOpen(false);
    setIsLoyaltyModalOpen(false);
    setHasSeenLoyaltyBridge(false);
    setEligibleLoyaltyLines([]);
    setLoyaltyDecisionByMsisdn({});
    setShowStep1NumberErrors(false);
    setSsnInput("");
    setLoggedInSsn(null);
    setCustomerContext(null);
    setLinesAndResetCounter(buildStartLines());
    orderCounterRef.current = 1;
  };

  const handleLoginClick = () => {
    const normalized = ssnInput.trim();
    if (!normalized) {
      return;
    }
    applyLogin(normalized);
    setCurrentStep(1);
  };

  const handleChangeMsisdn = (
    lineId: string,
    msisdn: string,
    source: "manual" | "picker" = "manual",
  ) => {
    const normalizedMsisdn = msisdn.trim();
    const targetLine = lines.find((line) => line.id === lineId);

    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, msisdn } : line)));

    if (source !== "manual") {
      return;
    }

    if (!normalizedMsisdn || !targetLine || !customerContext || !loggedInSsn) {
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

    setLoyaltyDecisionByMsisdn((prev) => ({
      ...prev,
      [normalizedMsisdn]: undefined,
    }));
  };

  const handleRemoveLine = (lineId: string) => {
    setLines((prev) =>
      prev.filter((line) => {
        if (line.id !== lineId) {
          return true;
        }
        return line.role === "MAIN" || line.existingFamilyLine;
      }),
    );
  };

  const handleSelectDevice = (
    lineId: string,
    payload: { deviceId: string; selection: DeviceSelection } | null,
  ) => {
    setLines((prev) =>
      prev.map((line) =>
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

  const handleApplyDebugExample = (ssn: string, msisdn: string) => {
    setSsnInput(ssn);

    const context = classifyCustomer(ssn, customerDb);
    const nextMode: FlowMode = context.hasFamily ? "MANAGE" : "START";

    const baselineLines =
      nextMode === "MANAGE" && context.hasFamily ? buildManageLines(context) : buildStartLines();

    const nextLines = [...baselineLines];

    if (nextMode === "START") {
      nextLines[0] = { ...nextLines[0], msisdn };
    } else {
      nextLines.push({
        id: `line-${nextLines.length + 1}`,
        role: "SUB",
        msisdn,
        deviceId: null,
        deviceSelection: null,
        existingFamilyLine: false,
      });
    }

    setFlowMode(nextMode);
    setLoggedInSsn(ssn);
    setCustomerContext(context);
    setIsTierQuickSelectOpen(false);
    setHasSeenLoyaltyBridge(false);
    setLinesAndResetCounter(nextLines);

    if (context.familyTier && nextMode === "MANAGE") {
      setSelectedTier(context.familyTier);
    }

    setupLoyaltyDecisionGate(context, nextMode, nextLines);

    setCurrentStep(1);
  };

  const placeOrder = () => {
    if (!canCheckout || !loggedInSsn) {
      return;
    }

    const orderId = `ORD-${String(orderCounterRef.current).padStart(4, "0")}`;
    orderCounterRef.current += 1;

    router.push(`/confirmation?orderId=${orderId}&ssn=${encodeURIComponent(loggedInSsn)}`);
  };

  const handleBackToPlans = () => {
    resetSelections();
    router.push("/");
  };

  const handleSelectTierQuick = (tierId: TierId) => {
    if (isPriceplanChangeBlockedByBinding && tierId !== selectedTier) {
      return;
    }

    setSelectedTier(tierId);
    setIsTierQuickSelectOpen(false);
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep > 1 && !hasMinimumNumbersForStepNavigation) {
      setCurrentStep(1);
      setShowStep1NumberErrors(true);
      return;
    }

    setShowStep1NumberErrors(false);
    setCurrentStep(targetStep);
  };

  const handleClaimOfferForLine = (lineId: string) => {
    if (!customerContext || !loggedInSsn) {
      return;
    }

    const targetLine = lines.find((line) => line.id === lineId);
    if (!targetLine) {
      return;
    }

    const msisdn = targetLine.msisdn.trim();
    if (!msisdn) {
      return;
    }

    const determinedOffer = determineOffer({
      ssn: loggedInSsn,
      msisdn,
      lineRole: targetLine.role,
      customerContext,
      db: customerDb,
    });

    if (determinedOffer.offerType !== "RENEWAL") {
      return;
    }

    setLoyaltyDecisionByMsisdn((prev) => ({
      ...prev,
      [msisdn]: undefined,
    }));
    setEligibleLoyaltyLines([
      {
        msisdn,
        role: targetLine.role,
        discountSek: determinedOffer.discountSek,
      },
    ]);
    setIsLoyaltyModalOpen(true);
  };

  const handleSetLoyaltyDecision = (msisdn: string, decision: LoyaltyDecision) => {
    setLoyaltyDecisionByMsisdn((prev) => ({ ...prev, [msisdn]: decision }));
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:py-8">
      {!loggedInSsn ? (
        <VerificationModal ssnInput={ssnInput} onChangeSsn={setSsnInput} onVerify={handleLoginClick} />
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
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-sun">Family plan checkout</p>
          <h1 className="text-2xl font-bold leading-tight md:text-3xl">
            Build your family subscription in a few steps
          </h1>
          <p className="mt-2 text-sm text-slate-600 md:text-[15px]">
            Add lines, pick devices, and review your cost before placing the order.
          </p>
        </div>
        <button type="button" className="button-secondary" onClick={handleBackToPlans}>
          Back to plans
        </button>
      </header>

      <Stepper currentStep={currentStep} labels={STEP_LABELS} onStepClick={handleStepClick} />
      {currentStep === 1 ? (
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
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          {currentStep === 1 ? (
            <>
              {flowMode === "MANAGE" && customerContext && !customerContext.hasFamily ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  No existing family plan was found for this account. You can still continue and create a
                  new family setup.
                </div>
              ) : null}

              <LineEditor
                lines={lines}
                offersByLineId={offersByLineId}
                ownedNumbers={ownedNumbers}
                lineSavingsByLineId={lineSavingsByLineId}
                showClaimOfferCtaByLineId={showClaimOfferCtaByLineId}
                onClaimOfferForLine={handleClaimOfferForLine}
                showMissingNumberErrors={showStep1NumberErrors}
                onChangeMsisdn={handleChangeMsisdn}
                onAddSubLine={addSubLine}
                onRemoveLine={handleRemoveLine}
              />
            </>
          ) : null}

          {currentStep === 2 ? (
            <DeviceSelector
              lines={lines}
              devices={devices}
              deviceLockReasonByLineId={deviceLockReasonByLineId}
              onSelectDevice={handleSelectDevice}
            />
          ) : null}

          {currentStep === 3 ? (
            <div className="panel space-y-4">
              <h2 className="text-xl font-semibold">Step 3: Review and place order</h2>
              {validationErrors.length > 0 ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p className="mb-2 font-semibold">Before you place the order:</p>
                  <ul className="list-disc pl-5">
                    {validationErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">
                  Everything looks good. You can place the order now.
                </div>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <div>
              {showBackStepButton ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
                >
                  Back
                </button>
              ) : null}
            </div>
            <div>
              {showContinueStepButton ? (
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => setCurrentStep((step) => Math.min(3, step + 1))}
                  disabled={!canProceedFromCurrentStep}
                >
                  Continue to {nextStepLabel}
                </button>
              ) : null}
              {showPlaceOrderButton ? (
                <button
                  type="button"
                  className="button-primary"
                  onClick={placeOrder}
                  disabled={!canCheckout}
                >
                  Place order
                </button>
              ) : null}
            </div>
          </div>

          <details className="rounded-2xl border border-dashed border-slate-300 bg-white/90 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Internal simulation tools
            </summary>
            <p className="mt-2 text-xs text-slate-500">
              For test scenarios only. Not part of the customer checkout experience.
            </p>
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
              Current flow mode:{" "}
              <span className="font-semibold">
                {flowMode === "START" ? "New family plan" : "Manage existing family plan"}
              </span>
            </div>
            <div className="mt-3">
              <DebugPanel
                ssnInput={ssnInput}
                onChangeSsn={setSsnInput}
                onApplyExample={handleApplyDebugExample}
                caseClassification={getCaseClassification(customerContext)}
                lines={pricedLines}
              />
            </div>
          </details>
        </section>

        <CartSummary
          tierLabel={tierLabel}
          lines={pricedLines}
          totals={totals}
          onRemoveLine={handleRemoveLine}
          onRemoveDevice={(lineId) => handleSelectDevice(lineId, null)}
        />
      </div>
    </main>
  );
}
