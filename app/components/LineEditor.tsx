import { useState } from "react";
import { CartLineDraft, OfferResult, OwnedPhoneNumber } from "@/app/lib/types";

interface LineEditorProps {
  lines: CartLineDraft[];
  offersByLineId: Record<string, OfferResult>;
  ownedNumbers: OwnedPhoneNumber[];
  lineSavingsByLineId: Record<
    string,
    {
      planSavings: number;
      offerSavings: number;
      totalSavings: number;
    }
  >;
  onChangeMsisdn: (id: string, msisdn: string, source?: "manual" | "picker") => void;
  onAddSubLine: (prefill?: string) => void;
  onRemoveLine: (id: string) => void;
  showClaimOfferCtaByLineId?: Record<string, boolean>;
  onClaimOfferForLine?: (id: string) => void;
  showMissingNumberErrors?: boolean;
}

function offerBadgeClass(offerType: OfferResult["offerType"]): string {
  if (offerType === "NEW_CUSTOMER") {
    return "bg-green-100 text-green-900";
  }

  if (offerType === "RENEWAL") {
    return "bg-violet-100 text-violet-800";
  }

  return "bg-slate-100 text-slate-700";
}

function offerBadgeLabel(offerType: OfferResult["offerType"]): string {
  if (offerType === "NEW_CUSTOMER") {
    return "Welcome offer";
  }

  if (offerType === "RENEWAL") {
    return "Loyalty offer";
  }

  return "Standard pricing";
}

function isRenewalBlockedOffer(offer: OfferResult | undefined): boolean {
  return (
    offer?.offerType === "NONE" &&
    (offer.reasonText ?? "").toLowerCase().includes("renewal blocked")
  );
}

function isNoChangeState(offer: OfferResult | undefined): boolean {
  return isRenewalBlockedOffer(offer);
}

function lineRoleLabel(line: CartLineDraft): string {
  if (line.role === "MAIN") {
    return "Primary line";
  }

  return line.existingFamilyLine ? "Existing family line" : "Extra line";
}

export function LineEditor({
  lines,
  offersByLineId,
  ownedNumbers,
  lineSavingsByLineId,
  onChangeMsisdn,
  onAddSubLine,
  onRemoveLine,
  showClaimOfferCtaByLineId = {},
  onClaimOfferForLine,
  showMissingNumberErrors = false,
}: LineEditorProps) {
  const [numberPickerLineId, setNumberPickerLineId] = useState<string | null>(null);
  const activeLines = lines.filter((line) => !isNoChangeState(offersByLineId[line.id]));
  const noChangeLines = lines.filter((line) => isNoChangeState(offersByLineId[line.id]));
  const primaryActiveLines = activeLines.filter((line) => line.role === "MAIN");
  const extraActiveLines = activeLines.filter((line) => line.role === "SUB");
  const pickerLine = numberPickerLineId ? lines.find((line) => line.id === numberPickerLineId) ?? null : null;

  const getAvailableOwnedNumbers = (lineId: string, currentMsisdn: string) => {
    const usedNumbers = new Set(
      lines
        .filter((candidate) => candidate.id !== lineId)
        .map((candidate) => candidate.msisdn.trim())
        .filter(Boolean),
    );

    return ownedNumbers.filter(
      (number) => !usedNumbers.has(number.msisdn) || number.msisdn === currentMsisdn,
    );
  };

  const pickerAvailableNumbers = pickerLine
    ? getAvailableOwnedNumbers(pickerLine.id, pickerLine.msisdn)
    : [];
  const hasNoChangeLines = noChangeLines.length > 0;

  const renderActiveLineCard = (line: CartLineDraft) => {
    const offer = offersByLineId[line.id];
    const isLockedExisting = line.existingFamilyLine;
    const digitsOnly = line.msisdn.replace(/\D/g, "");
    const hasValidatedNumber = digitsOnly.length === 10;
    const showPendingOfferState = !hasValidatedNumber;
    const showMissingNumberError = showMissingNumberErrors && !hasValidatedNumber && !isLockedExisting;
    const availableOwnedNumbers = isLockedExisting
      ? []
      : getAvailableOwnedNumbers(line.id, line.msisdn);
    const showNumberPickerTrigger = !isLockedExisting && availableOwnedNumbers.length > 0;
    const totalLineSavings = lineSavingsByLineId[line.id]?.totalSavings ?? 0;
    const showClaimOfferCta = !!showClaimOfferCtaByLineId[line.id];

    return (
      <div
        key={line.id}
        className={`rounded-lg border p-3 ${
          showMissingNumberError
            ? "border-red-200 bg-red-50/50"
            : "border-slate-200 bg-white/95 shadow-sm"
        }`}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
            {lineRoleLabel(line)}
          </span>
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              showPendingOfferState
                ? "bg-slate-100 text-slate-600"
                : offerBadgeClass(offer?.offerType ?? "NONE")
            }`}
          >
            {showPendingOfferState ? "Pending number" : offerBadgeLabel(offer?.offerType ?? "NONE")}
          </span>
          {hasValidatedNumber ? (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-green-700">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-100">
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden
                  className="h-3 w-3 fill-none stroke-2 stroke-green-700"
                >
                  <path d="M3.5 8.5 6.5 11.5 12.5 5.5" />
                </svg>
              </span>
              Verified
            </span>
          ) : null}
        </div>

        {isLockedExisting ? (
          <div className="w-full max-w-[22ch] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
            {line.msisdn || "No number available"}
          </div>
        ) : (
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <input
                className={`input max-w-[22ch] ${
                  showMissingNumberError
                    ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200"
                    : ""
                }`}
                value={line.msisdn}
                onChange={(event) => onChangeMsisdn(line.id, event.target.value, "manual")}
                placeholder="Phone number"
              />
              {showMissingNumberError ? (
                <p className="text-xs font-medium text-red-700">
                  Enter a phone number to continue.
                </p>
              ) : null}
              {showNumberPickerTrigger ? (
                <button
                  type="button"
                  className="text-left text-xs font-medium text-slate-600 underline hover:text-slate-800"
                  onClick={() => setNumberPickerLineId(line.id)}
                >
                  Select an existing number instead
                </button>
              ) : null}
            </div>
            {line.role === "SUB" ? (
              <button
                type="button"
                className="button-secondary md:w-28 md:self-end"
                onClick={() => onRemoveLine(line.id)}
              >
                Remove
              </button>
            ) : null}
          </div>
        )}

        <p className="mt-2 text-xs text-slate-600">
          {offer?.reasonText ?? "Offer details appear after account verification."}
        </p>
        {showClaimOfferCta && onClaimOfferForLine ? (
          <button
            type="button"
            className="mt-1 text-xs font-semibold text-violet-700 underline hover:text-violet-900"
            onClick={() => onClaimOfferForLine(line.id)}
          >
            Claim offer
          </button>
        ) : null}
        {hasValidatedNumber ? (
          <p
            className={`mt-1 text-xs ${
              totalLineSavings > 0 ? "font-semibold text-green-700" : "text-slate-600"
            }`}
          >
            Savings: {totalLineSavings} SEK/mo
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="panel space-y-4">
      <h2 className="text-xl font-semibold">Step 1: Add family members</h2>

      <p className="text-sm text-slate-600 md:text-[15px]">
        Keep one primary line and add at least one extra line for your family plan.
      </p>

      {primaryActiveLines.length > 0 ? (
        <div>
          <p className="text-sm font-semibold text-slate-800">Primary line</p>
          <p className="mt-1 text-xs text-slate-600">
            This number anchors your family plan and pricing.
          </p>
          <div className="mt-3 space-y-3">
            {primaryActiveLines.map((line) => renderActiveLineCard(line))}
          </div>
        </div>
      ) : null}

      {extraActiveLines.length > 0 ? (
        <div>
          <p className="text-sm font-semibold text-slate-800">Family member lines</p>
          <p className="mt-1 text-xs text-slate-600">
            Add, validate, and manage each extra line in your family.
          </p>
          <div className="mt-3 space-y-3">
            {extraActiveLines.map((line) => renderActiveLineCard(line))}
          </div>
        </div>
      ) : null}

      {hasNoChangeLines ? (
        <div className="pt-1">
          <button type="button" className="button-secondary" onClick={() => onAddSubLine()}>
            Add extra line
          </button>
        </div>
      ) : null}

      {hasNoChangeLines ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-300" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Unchanged lines
            </span>
            <div className="h-px flex-1 bg-slate-300" />
          </div>
          <div className="rounded-2xl border border-slate-300 bg-gradient-to-b from-slate-50 to-slate-100 p-3">
            <p className="text-xs text-slate-700">
              Renewal is blocked on these lines, so they stay on current terms.
            </p>
            <div className="mt-3 space-y-3">
              {noChangeLines.map((line) => {
                const offer = offersByLineId[line.id];

                return (
                  <div key={line.id} className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
                        {lineRoleLabel(line)}
                      </span>
                      {!line.existingFamilyLine ? (
                        <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                          Existing number
                        </span>
                      ) : null}
                    </div>
                    <div className="w-full max-w-[22ch] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
                      {line.msisdn || "No number available"}
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {offer?.reasonText ?? "No offer changes apply."}
                    </p>
                    {!line.existingFamilyLine ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => onChangeMsisdn(line.id, "")}
                        >
                          Edit number
                        </button>
                        {line.role === "SUB" ? (
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => onRemoveLine(line.id)}
                          >
                            Remove line
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {pickerLine ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4"
          onClick={() => setNumberPickerLineId(null)}
        >
          <div
            className="flex w-full max-w-md max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">Select existing number</h3>
                <p className="text-sm text-slate-600">
                  Pick one of your current numbers for this line. Lines in binding can be added if renewal is compatible.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setNumberPickerLineId(null)}
                aria-label="Close number picker"
              >
                X
              </button>
            </div>

            <div className="mt-1 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {pickerAvailableNumbers.length > 0 ? (
                pickerAvailableNumbers.map((number) => {
                  const isBindingBlocked =
                    number.inBinding && !number.bindingCompatibleWithRenewalOffer;

                  return (
                  <button
                    key={number.msisdn}
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                      isBindingBlocked
                        ? "cursor-not-allowed border-red-300 bg-red-50 text-red-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      if (isBindingBlocked) {
                        return;
                      }

                      onChangeMsisdn(pickerLine.id, number.msisdn, "picker");
                      setNumberPickerLineId(null);
                    }}
                    disabled={isBindingBlocked}
                  >
                    <span>{number.msisdn}</span>
                    {isBindingBlocked ? (
                      <span className="mt-1 block text-xs font-normal text-red-700">
                        Cannot be added due to binding incompatibility
                      </span>
                    ) : null}
                  </button>
                  );
                })
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  No available existing numbers for this line.
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setNumberPickerLineId(null)}
              >
                Enter manually
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!hasNoChangeLines ? (
        <div className="pt-1">
          <button type="button" className="button-secondary" onClick={() => onAddSubLine()}>
            Add extra line
          </button>
        </div>
      ) : null}

    </div>
  );
}
