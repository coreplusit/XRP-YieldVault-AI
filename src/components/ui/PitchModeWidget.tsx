"use client";

import {
  CheckCircle2,
  ChevronRight,
  Eye,
  RotateCcw,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { resetPitchDemoState } from "@/lib/demo/resetPitchDemo";

interface PitchStep {
  id: number;
  title: string;
  talkingPoint: ReactNode;
  href: "/dashboard" | "/analytics" | "/governance";
  cta: string;
}

const PITCH_STEPS: readonly PitchStep[] = [
  {
    id: 1,
    title: "Non-Custodial Security",
    talkingPoint: (
      <>
        Highlight{" "}
        <span className="font-bold text-emerald-400">XRPL Native Escrow</span>{" "}
        non-custodial security model.
      </>
    ),
    href: "/dashboard",
    cta: "Open Dashboard",
  },
  {
    id: 2,
    title: "15% APY Breakdown",
    talkingPoint: (
      <>
        Show{" "}
        <span className="font-bold text-emerald-400">15% APY</span> Yield
        Calculator breakdown (Principal vs Guaranteed Yield).
      </>
    ),
    href: "/analytics",
    cta: "Open Calculator",
  },
  {
    id: 3,
    title: "DAO Governance",
    talkingPoint: (
      <>
        Demonstrate{" "}
        <span className="font-bold text-emerald-400">DAO Governance</span>,
        Quorum limits, InfoTooltips, and 1-Click Voting.
      </>
    ),
    href: "/governance",
    cta: "Open Governance",
  },
  {
    id: 4,
    title: "VP Delegation",
    talkingPoint: (
      <>
        Show Passive Investor{" "}
        <span className="font-bold text-emerald-400">
          Voting Power Delegation
        </span>{" "}
        to AI Delegate.
      </>
    ),
    href: "/governance",
    cta: "Open Delegation",
  },
] as const;

const OPEN_STORAGE_KEY = "yieldvault.pitch.widget.open";
const STEP_STORAGE_KEY = "yieldvault.pitch.step";

/**
 * Collapsible Demo Guide — fixed bottom-right pitch walkthrough.
 * Uses App Router navigation (no hash anchors / page-bottom scroll).
 */
export function PitchModeWidget() {
  const router = useRouter();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<boolean>(false);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [resetFlash, setResetFlash] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    try {
      const openRaw = window.localStorage.getItem(OPEN_STORAGE_KEY);
      const stepRaw = window.localStorage.getItem(STEP_STORAGE_KEY);
      if (openRaw === "1") setExpanded(true);
      const parsed = Number(stepRaw);
      if (
        Number.isFinite(parsed) &&
        parsed >= 0 &&
        parsed < PITCH_STEPS.length
      ) {
        setStepIndex(parsed);
      }
    } catch {
      // Ignore storage errors during demos.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(OPEN_STORAGE_KEY, expanded ? "1" : "0");
      window.localStorage.setItem(STEP_STORAGE_KEY, String(stepIndex));
    } catch {
      // Ignore.
    }
  }, [expanded, hydrated, stepIndex]);

  const current = useMemo((): PitchStep => {
    return PITCH_STEPS[stepIndex] ?? PITCH_STEPS[0]!;
  }, [stepIndex]);

  const navigateToStep = useCallback(
    (index: number, event?: MouseEvent): void => {
      event?.preventDefault();
      event?.stopPropagation();
      const step = PITCH_STEPS[index] ?? PITCH_STEPS[0]!;
      setStepIndex(index);
      if (pathname !== step.href) {
        router.push(step.href);
      }
    },
    [pathname, router],
  );

  const handleReset = useCallback(
    (event: MouseEvent<HTMLButtonElement>): void => {
      event.preventDefault();
      resetPitchDemoState();
      setStepIndex(0);
      setResetFlash(true);
      window.setTimeout(() => setResetFlash(false), 2200);
    },
    [],
  );

  if (!hydrated) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex max-w-[calc(100vw-3rem)] flex-col items-end gap-3">
      {expanded ? (
        <div
          className="pointer-events-auto w-[min(100vw-3rem,22rem)] rounded-2xl border border-emerald-400/40 bg-vault-bg/95 p-4 shadow-[0_0_24px_rgba(52,211,153,0.18)] backdrop-blur-xl"
          role="dialog"
          aria-label="Demo Guide"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                Demo Guide
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                Pitch Walkthrough
              </p>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                setExpanded(false);
              }}
              className="rounded-lg border border-slate-700/60 p-1.5 text-vault-muted transition-colors hover:border-emerald-400/40 hover:bg-white/5 hover:text-white"
              aria-label="Close demo guide"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <ol className="space-y-2">
            {PITCH_STEPS.map((step, index) => {
              const active = index === stepIndex;
              const done = index < stepIndex;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={(event) => navigateToStep(index, event)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-emerald-400/50 bg-emerald-400/10"
                        : "border-slate-800/60 bg-vault-bg/50 hover:border-cyan-400/30"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${
                          done
                            ? "bg-emerald-400/20 text-emerald-400"
                            : active
                              ? "bg-cyan-400/20 text-cyan-300"
                              : "bg-slate-800 text-vault-muted"
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          step.id
                        )}
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {step.title}
                      </span>
                    </span>
                    {active ? (
                      <span className="mt-1.5 block pl-7 text-[11px] leading-relaxed text-slate-300">
                        {step.talkingPoint}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(event) => navigateToStep(stepIndex, event)}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-400/20"
            >
              {current.cta}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={stepIndex >= PITCH_STEPS.length - 1}
              onClick={(event) => {
                event.preventDefault();
                const nextIndex = Math.min(
                  PITCH_STEPS.length - 1,
                  stepIndex + 1,
                );
                navigateToStep(nextIndex, event);
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700/70 px-3 py-2 text-xs font-medium text-vault-muted transition-colors hover:border-cyan-400/30 hover:text-white disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/70 px-3 py-2 text-xs text-vault-muted transition-colors hover:border-amber-400/40 hover:text-amber-200"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {resetFlash ? "Demo state cleared" : "Reset Demo State"}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          setExpanded((open) => !open);
        }}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-vault-bg/95 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_0_20px_rgba(34,211,238,0.22)] backdrop-blur-xl transition-all hover:border-cyan-300 hover:shadow-[0_0_28px_rgba(52,211,153,0.35)]"
        aria-expanded={expanded}
        aria-label="Demo Guide"
      >
        <Eye className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
        <span>Demo Guide</span>
        {expanded ? (
          <X className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
