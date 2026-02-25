"use client";

import { PricedCartLine } from "@/app/lib/types";

interface SubscriptionLineCardProps {
  line: PricedCartLine;
  mainLineBase: number;
  className?: string;
  canRemoveLine?: boolean;
  onRemoveLine?: (lineId: string) => void;
  showDeviceDetails?: boolean;
  onRemoveDevice?: (lineId: string) => void;
}

function getOfferLabel(offerType: PricedCartLine["offer"]["offerType"]): string | null {
  if (offerType === "NEW_CUSTOMER") {
    return "Sign on discount";
  }

  if (offerType === "RENEWAL") {
    return "Loyalty discount";
  }

  return null;
}

function getOfferLabelClass(offerType: PricedCartLine["offer"]["offerType"]): string {
  if (offerType === "NEW_CUSTOMER") {
    return "text-green-700";
  }

  if (offerType === "RENEWAL") {
    return "text-slate-700";
  }

  return "text-slate-600";
}

function RoleBadge({
  role,
  existingFamilyLine,
}: {
  role: PricedCartLine["role"];
  existingFamilyLine: boolean;
}) {
  const isMain = role === "MAIN";
  const isExistingFamilySub = role === "SUB" && existingFamilyLine;
  const label = isMain ? "Primary line" : isExistingFamilySub ? "Existing family line" : "Extra line";
  const icon = isMain ? "M" : isExistingFamilySub ? "E" : "S";
  const badgeClass = isMain
    ? "bg-ink/10 text-ink"
    : isExistingFamilySub
      ? "bg-slate-200 text-slate-800"
      : "bg-slate-100 text-slate-700";
  const iconClass = isMain
    ? "bg-ink/20 text-ink"
    : isExistingFamilySub
      ? "bg-slate-300 text-slate-800"
      : "bg-slate-200 text-slate-700";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${badgeClass}`}>
      <span
        aria-hidden
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${iconClass}`}
      >
        {icon}
      </span>
      {label}
    </span>
  );
}

export function SubscriptionLineCard({
  line,
  mainLineBase,
  className = "",
  canRemoveLine = false,
  onRemoveLine,
  showDeviceDetails = false,
  onRemoveDevice,
}: SubscriptionLineCardProps) {
  const equivalentMainPrice = mainLineBase;
  const hasReducedPrice = equivalentMainPrice > line.price.final;
  const offerLabel = getOfferLabel(line.offer.offerType);
  const offerLabelClass = getOfferLabelClass(line.offer.offerType);
  const hasOffer = !!offerLabel && line.price.discount > 0;
  const hasDeviceMonthlyCost = line.deviceMonthly > 0;
  const hasDeviceOneTimeCost = line.deviceOneTime > 0;
  const deviceMonths =
    line.deviceSelection?.paymentPeriod === "36_MONTH"
      ? 36
      : line.deviceSelection?.paymentPeriod === "24_MONTH"
        ? 24
        : null;

  return (
    <div className={`rounded-xl border p-3 text-sm shadow-sm ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RoleBadge role={line.role} existingFamilyLine={line.existingFamilyLine} />
          <p className="font-semibold text-ink">{line.msisdn || "Missing number"}</p>
        </div>
        {canRemoveLine && onRemoveLine ? (
          <button
            type="button"
            className="text-xs text-red-700 underline"
            onClick={() => onRemoveLine(line.id)}
          >
            remove line
          </button>
        ) : null}
      </div>
      <p>
        Standard price:{" "}
        {line.role === "SUB"
          ? `${equivalentMainPrice} SEK/mo`
          : `${line.price.base} SEK/mo`}
      </p>
      {hasOffer ? <p className={offerLabelClass}>{offerLabel}: -{line.price.discount} SEK/mo</p> : null}
      <p className={`font-semibold ${hasReducedPrice ? "text-green-700" : "text-ink"}`}>
        Monthly cost: {line.price.final} SEK/mo
        {hasReducedPrice ? (
          <span className="ml-2 text-xs text-slate-500 line-through">
            {equivalentMainPrice} SEK/mo
          </span>
        ) : null}
      </p>
      <p>Binding: {line.offer.bindingMonths} months</p>
      {showDeviceDetails && line.deviceId ? (
        <>
          {line.deviceSelection ? (
            <p>
              Device options: {line.deviceSelection.color}, {line.deviceSelection.memory}
            </p>
          ) : null}
          {hasDeviceMonthlyCost ? (
            <p>
              Device cost: {line.deviceMonthly} SEK/mo
              {deviceMonths ? ` for ${deviceMonths} months` : ""}
            </p>
          ) : null}
          {hasDeviceOneTimeCost ? <p>Device cost: {line.deviceOneTime} SEK one-time</p> : null}
          {onRemoveDevice ? (
            <button
              type="button"
              className="mt-1 text-xs text-slate-700 underline"
              onClick={() => onRemoveDevice(line.id)}
            >
              remove device
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
