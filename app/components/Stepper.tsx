interface StepperProps {
  currentStep: number;
  labels: string[];
  onStepClick?: (step: number) => void;
}

export function Stepper({ currentStep, labels, onStepClick }: StepperProps) {
  return (
    <ol className="mb-5 grid gap-3 md:grid-cols-3">
      {labels.map((label, index) => {
        const step = index + 1;
        const isActive = step === currentStep;
        const isDone = step < currentStep;
        const isClickable = !!onStepClick;

        return (
          <li
            key={label}
            className={`rounded-2xl border px-3 py-2 text-xs transition ${
              isActive
                ? "border-ink bg-white shadow-sm"
                : isDone
                  ? "border-slate-300 bg-slate-50 text-slate-700"
                  : "border-slate-200 bg-white text-slate-500"
            } ${isClickable ? "cursor-pointer hover:border-slate-400" : ""}`}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onStepClick?.(step)}
              aria-current={isActive ? "step" : undefined}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[10px] font-semibold ${
                    isActive
                      ? "border-ink bg-ink text-white"
                      : isDone
                        ? "border-slate-400 bg-white text-slate-700"
                        : "border-slate-300 bg-white text-slate-500"
                  }`}
                >
                  {step}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide ${
                    isDone ? "text-slate-700" : isActive ? "text-ink" : "text-slate-500"
                  }`}
                >
                  {isDone ? "Done" : isActive ? "Current" : "Next"}
                </span>
              </div>
              <p className={`text-[12px] ${isActive ? "font-semibold text-ink" : ""}`}>{label}</p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
