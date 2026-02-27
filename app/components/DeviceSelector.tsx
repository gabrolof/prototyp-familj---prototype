import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CartLineDraft,
  DeviceDefinition,
  DeviceMemoryOption,
  DevicePaymentPeriod,
  DeviceSelection,
} from "@/app/lib/types";

interface DeviceSelectorProps {
  lines: CartLineDraft[];
  devices: DeviceDefinition[];
  deviceLockReasonByLineId?: Record<string, string | undefined>;
  onSelectDevice: (lineId: string, payload: { deviceId: string; selection: DeviceSelection } | null) => void;
  hidePricingDetails?: boolean;
  collapseLockedLines?: boolean;
}

type DeviceModalStep = "LIST" | "DETAIL";

interface DeviceVisualDetails {
  image: string;
  colors: string[];
}

const DEVICE_VISUALS_BY_ID: Record<string, DeviceVisualDetails> = {
  "pixel-lite": {
    image:
      "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=80",
    colors: ["Midnight", "Sky Blue", "Silver"],
  },
  "nordic-pro": {
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
    colors: ["Graphite", "Arctic White", "Forest Green"],
  },
  "apple-mini": {
    image:
      "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=1200&q=80",
    colors: ["Starlight", "Space Gray", "Rose"],
  },
  "family-tab": {
    image:
      "https://images.unsplash.com/photo-1605236453806-6ff36851218e?auto=format&fit=crop&w=1200&q=80",
    colors: ["Black", "Blue", "Mint"],
  },
};

const MEMORY_OPTIONS: DeviceMemoryOption[] = ["128GB", "256GB"];
const PAYMENT_OPTIONS: DevicePaymentPeriod[] = ["DIRECT", "24_MONTH", "36_MONTH"];

function paymentLabel(option: DevicePaymentPeriod): string {
  if (option === "DIRECT") {
    return "Direct payment";
  }

  if (option === "24_MONTH") {
    return "24 month payment";
  }

  return "36 month payment";
}

function getDeviceTotalPrice(device: DeviceDefinition): number {
  if (device.priceType === "oneTime") {
    return device.price;
  }

  return device.price * 24;
}

function getDeviceMonthlyForPeriod(device: DeviceDefinition, paymentPeriod: DevicePaymentPeriod): number {
  if (paymentPeriod === "DIRECT") {
    return 0;
  }

  const total = getDeviceTotalPrice(device);
  return Math.round(total / (paymentPeriod === "36_MONTH" ? 36 : 24));
}

function getDefaultColor(deviceId: string): string {
  return DEVICE_VISUALS_BY_ID[deviceId]?.colors[0] ?? "Black";
}

export function DeviceSelector({
  lines,
  devices,
  deviceLockReasonByLineId = {},
  onSelectDevice,
  hidePricingDetails = false,
  collapseLockedLines = false,
}: DeviceSelectorProps) {
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [modalStep, setModalStep] = useState<DeviceModalStep>("LIST");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedMemory, setSelectedMemory] = useState<DeviceMemoryOption>("128GB");
  const [selectedPaymentPeriod, setSelectedPaymentPeriod] = useState<DevicePaymentPeriod>("24_MONTH");
  const [isLockedLinesOpen, setIsLockedLinesOpen] = useState(false);

  const listDevices = useMemo(() => devices.slice(0, 3), [devices]);
  const activeLine = activeLineId ? lines.find((line) => line.id === activeLineId) ?? null : null;
  const selectedDevice =
    selectedDeviceId ? devices.find((device) => device.id === selectedDeviceId) ?? null : null;
  const editableDeviceLines = useMemo(
    () => lines.filter((line) => !deviceLockReasonByLineId[line.id]),
    [lines, deviceLockReasonByLineId],
  );
  const lockedDeviceLines = useMemo(
    () => lines.filter((line) => !!deviceLockReasonByLineId[line.id]),
    [lines, deviceLockReasonByLineId],
  );
  const linesForPrimaryList = collapseLockedLines ? editableDeviceLines : lines;

  const closeModal = () => {
    setActiveLineId(null);
    setModalStep("LIST");
    setSelectedDeviceId(null);
  };

  const openModalForLine = (line: CartLineDraft) => {
    if (deviceLockReasonByLineId[line.id]) {
      return;
    }

    setActiveLineId(line.id);
    setModalStep("LIST");
    setSelectedDeviceId(null);
    setSelectedColor(line.deviceSelection?.color ?? "");
    setSelectedMemory(line.deviceSelection?.memory ?? "128GB");
    setSelectedPaymentPeriod(line.deviceSelection?.paymentPeriod ?? "24_MONTH");
  };

  const openDeviceDetails = (deviceId: string) => {
    const previousSelection = activeLine?.deviceSelection;

    setSelectedDeviceId(deviceId);
    setSelectedColor(
      previousSelection && activeLine?.deviceId === deviceId
        ? previousSelection.color
        : getDefaultColor(deviceId),
    );
    setSelectedMemory(
      previousSelection && activeLine?.deviceId === deviceId ? previousSelection.memory : "128GB",
    );
    setSelectedPaymentPeriod(
      previousSelection && activeLine?.deviceId === deviceId
        ? previousSelection.paymentPeriod
        : "24_MONTH",
    );
    setModalStep("DETAIL");
  };

  const confirmDeviceSelection = () => {
    if (!activeLineId || !selectedDeviceId) {
      return;
    }

    onSelectDevice(activeLineId, {
      deviceId: selectedDeviceId,
      selection: {
        color: selectedColor || getDefaultColor(selectedDeviceId),
        memory: selectedMemory,
        paymentPeriod: selectedPaymentPeriod,
      },
    });
    closeModal();
  };

  const deviceModal =
    activeLine && activeLineId ? (
      <div
        className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)",
        }}
      >
        <div className="max-h-[calc(100dvh-6rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex h-full flex-col">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sun">Device selection</p>
                <p className="text-sm font-semibold text-ink">
                  {activeLine.role === "MAIN" ? "Primary line" : "Extra line"} -{" "}
                  {activeLine.msisdn || "No number entered"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Device subflow. You can close and return without saving.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                onClick={closeModal}
                aria-label="Close device selection"
              >
                X
              </button>
            </div>

            {modalStep === "LIST" ? (
              <div className="h-full overflow-auto p-5">
                <p className="mb-3 text-sm text-slate-600">Pick a phone to continue.</p>
                <div className="grid gap-4 md:grid-cols-3">
                  {listDevices.map((device) => {
                    const visual = DEVICE_VISUALS_BY_ID[device.id];
                    const monthlyPrice = getDeviceMonthlyForPeriod(device, "24_MONTH");

                    return (
                      <button
                        key={device.id}
                        type="button"
                        className="rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-px hover:border-slate-400 hover:shadow-md"
                        onClick={() => openDeviceDetails(device.id)}
                      >
                        <div className="aspect-[4/3] overflow-hidden rounded-t-2xl bg-slate-100">
                          <img
                            src={
                              visual?.image ??
                              "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1200&q=80"
                            }
                            alt={device.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="p-3">
                          <p className="font-semibold text-ink">{device.name}</p>
                          <p className="mt-1 text-xs text-slate-600">{device.shortDescription}</p>
                          {!hidePricingDetails ? (
                            <p className="mt-2 text-sm font-semibold text-ink">{monthlyPrice} SEK/mo</p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full overflow-auto p-5">
                {selectedDevice ? (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                        <img
                          src={
                            DEVICE_VISUALS_BY_ID[selectedDevice.id]?.image ??
                            "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1200&q=80"
                          }
                          alt={selectedDevice.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <p className="mt-3 text-lg font-semibold text-ink">{selectedDevice.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{selectedDevice.shortDescription}</p>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <p className="text-sm font-semibold text-ink">Color</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(DEVICE_VISUALS_BY_ID[selectedDevice.id]?.colors ?? [
                            "Black",
                            "Silver",
                            "Blue",
                          ]).map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                                selectedColor === color
                                  ? "border-ink bg-ink text-white"
                                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                              }`}
                              onClick={() => setSelectedColor(color)}
                            >
                              {color}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-ink">Memory size</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {MEMORY_OPTIONS.map((memory) => (
                            <button
                              key={memory}
                              type="button"
                              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                                selectedMemory === memory
                                  ? "border-ink bg-ink text-white"
                                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                              }`}
                              onClick={() => setSelectedMemory(memory)}
                            >
                              {memory}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-ink">Payment period</p>
                        <div className="mt-2 space-y-2">
                          {PAYMENT_OPTIONS.map((option) => {
                            const monthly = getDeviceMonthlyForPeriod(selectedDevice, option);
                            const total = getDeviceTotalPrice(selectedDevice);
                            const detailText =
                              option === "DIRECT"
                                ? `${total} SEK today`
                                : `${monthly} SEK/mo`;

                            return (
                              <button
                                key={option}
                                type="button"
                                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                                  selectedPaymentPeriod === option
                                    ? "border-ink bg-ink text-white"
                                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                                }`}
                                onClick={() => setSelectedPaymentPeriod(option)}
                              >
                                <span>{paymentLabel(option)}</span>
                                {!hidePricingDetails ? (
                                  <span className="font-semibold">{detailText}</span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-between gap-2 pt-2">
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => setModalStep("LIST")}
                        >
                          Back to phones
                        </button>
                        <button
                          type="button"
                          className="button-primary"
                          onClick={confirmDeviceSelection}
                        >
                          Save phone
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div className="panel space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Step 2: Add devices (optional)</h2>
          <p className="mt-1 text-sm text-slate-600 md:text-[15px]">
            Add a phone per line or keep existing phones and continue.
          </p>
        </div>

        <div className="space-y-3">
          {linesForPrimaryList.length > 0 ? (
            linesForPrimaryList.map((line) => {
              const selectedLineDevice = line.deviceId
                ? devices.find((device) => device.id === line.deviceId)
                : null;
              const lockReason = deviceLockReasonByLineId[line.id];
              const isDeviceLocked = !!lockReason;
              const effectiveSelection =
                selectedLineDevice && line.deviceSelection
                  ? line.deviceSelection
                  : selectedLineDevice
                    ? {
                        color: getDefaultColor(selectedLineDevice.id),
                        memory: "128GB" as DeviceMemoryOption,
                        paymentPeriod: "24_MONTH" as DevicePaymentPeriod,
                      }
                    : null;
              const lineDeviceMonthly =
                selectedLineDevice && effectiveSelection
                  ? getDeviceMonthlyForPeriod(selectedLineDevice, effectiveSelection.paymentPeriod)
                  : 0;
              const lineDeviceOneTime =
                selectedLineDevice && effectiveSelection?.paymentPeriod === "DIRECT"
                  ? getDeviceTotalPrice(selectedLineDevice)
                  : 0;

              return (
                <div key={line.id} className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {line.role === "MAIN" ? "Primary line" : "Extra line"} -{" "}
                        {line.msisdn || "No number entered"}
                      </p>
                      {selectedLineDevice && effectiveSelection ? (
                        <div className="mt-1 text-xs text-slate-600">
                          <p className="font-medium text-slate-700">{selectedLineDevice.name}</p>
                          <p>
                            {effectiveSelection.color}, {effectiveSelection.memory},{" "}
                            {paymentLabel(effectiveSelection.paymentPeriod)}
                          </p>
                          {!hidePricingDetails && lineDeviceMonthly > 0 ? (
                            <p>Device cost: {lineDeviceMonthly} SEK/mo</p>
                          ) : null}
                          {!hidePricingDetails && lineDeviceOneTime > 0 ? (
                            <p>Device cost: {lineDeviceOneTime} SEK one-time</p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">No phone selected.</p>
                      )}
                      {isDeviceLocked ? (
                        <p className="mt-1 text-xs font-medium text-red-700">{lockReason}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`button-secondary ${
                          isDeviceLocked ? "cursor-not-allowed opacity-60 hover:translate-y-0" : ""
                        }`}
                        onClick={() => openModalForLine(line)}
                        disabled={isDeviceLocked}
                      >
                        {line.deviceId ? "Change phone" : "Add phone"}
                      </button>
                      {line.deviceId ? (
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => onSelectDevice(line.id, null)}
                        >
                          Remove phone
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No lines are currently eligible for device changes.
            </p>
          )}

          {collapseLockedLines && lockedDeviceLines.length > 0 ? (
            <div className="space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2 text-left"
                onClick={() => setIsLockedLinesOpen((open) => !open)}
                aria-expanded={isLockedLinesOpen}
              >
                <span className="text-sm font-semibold text-slate-800">
                  Unchanged device lines ({lockedDeviceLines.length})
                </span>
                <span className="text-xs font-medium text-slate-600">
                  {isLockedLinesOpen ? "Hide" : "Show"}
                </span>
              </button>

              {isLockedLinesOpen ? (
                <div className="space-y-3">
                  {lockedDeviceLines.map((line) => {
                    const selectedLineDevice = line.deviceId
                      ? devices.find((device) => device.id === line.deviceId)
                      : null;
                    const lockReason = deviceLockReasonByLineId[line.id];

                    return (
                      <div
                        key={line.id}
                        className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm"
                      >
                        <p className="text-sm font-semibold">
                          {line.role === "MAIN" ? "Primary line" : "Extra line"} -{" "}
                          {line.msisdn || "No number entered"}
                        </p>
                        {selectedLineDevice ? (
                          <p className="mt-1 text-xs text-slate-600">
                            Existing device: <span className="font-medium">{selectedLineDevice.name}</span>
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-600">No device change available.</p>
                        )}
                        {lockReason ? (
                          <p className="mt-1 text-xs font-medium text-red-700">{lockReason}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {deviceModal && typeof document !== "undefined" ? createPortal(deviceModal, document.body) : null}
    </>
  );
}
