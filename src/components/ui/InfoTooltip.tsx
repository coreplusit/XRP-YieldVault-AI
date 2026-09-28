"use client";

import { CircleHelp } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type TooltipPlacement = "top" | "bottom";

interface InfoTooltipProps {
  /** Plain-language explanation shown in the popover. */
  content: ReactNode;
  /** Accessible label for the trigger button. */
  label?: string;
  /** Preferred placement; flips automatically if clipped. */
  preferredPlacement?: TooltipPlacement;
  /** Optional extra class on the trigger. */
  className?: string;
}

interface TooltipCoords {
  top: number;
  left: number;
  placement: TooltipPlacement;
}

const TOOLTIP_GAP_PX = 10;
const VIEWPORT_PAD_PX = 12;
const TOOLTIP_MAX_WIDTH_PX = 280;

/**
 * Reusable glassmorphism help tooltip with dynamic top/bottom placement.
 * Opens on hover and keyboard focus; closes on blur / Escape / pointer leave.
 */
export function InfoTooltip({
  content,
  label = "More information",
  preferredPlacement = "top",
  className = "",
}: InfoTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback((): void => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const spaceAbove = triggerRect.top - VIEWPORT_PAD_PX;
    const spaceBelow =
      window.innerHeight - triggerRect.bottom - VIEWPORT_PAD_PX;

    let placement: TooltipPlacement = preferredPlacement;
    if (preferredPlacement === "top") {
      if (spaceAbove < panelRect.height + TOOLTIP_GAP_PX && spaceBelow > spaceAbove) {
        placement = "bottom";
      }
    } else if (
      spaceBelow < panelRect.height + TOOLTIP_GAP_PX &&
      spaceAbove > spaceBelow
    ) {
      placement = "top";
    }

    const rawLeft =
      triggerRect.left + triggerRect.width / 2 - panelRect.width / 2;
    const left = Math.min(
      Math.max(VIEWPORT_PAD_PX, rawLeft),
      window.innerWidth - panelRect.width - VIEWPORT_PAD_PX,
    );

    const top =
      placement === "top"
        ? triggerRect.top - panelRect.height - TOOLTIP_GAP_PX
        : triggerRect.bottom + TOOLTIP_GAP_PX;

    setCoords({ top, left, placement });
  }, [preferredPlacement]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handleReposition = (): void => updatePosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const show = useCallback((): void => setOpen(true), []);
  const hide = useCallback((): void => setOpen(false), []);

  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-vault-muted transition-colors hover:bg-white/5 hover:text-vault-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vault-cyan/50"
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {mounted && open
        ? createPortal(
            <div
              ref={panelRef}
              id={tooltipId}
              role="tooltip"
              style={{
                position: "fixed",
                top: coords?.top ?? -9999,
                left: coords?.left ?? -9999,
                maxWidth: TOOLTIP_MAX_WIDTH_PX,
                visibility: coords ? "visible" : "hidden",
                zIndex: 80,
              }}
              onMouseEnter={show}
              onMouseLeave={hide}
              className="rounded-xl border border-slate-700/70 bg-vault-bg/95 px-3 py-2.5 text-left text-xs leading-relaxed text-vault-muted shadow-glass backdrop-blur-xl"
            >
              {content}
              <span
                aria-hidden="true"
                className={`absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border border-slate-700/70 bg-vault-bg/95 ${
                  coords?.placement === "bottom"
                    ? "-top-1 border-b-0 border-r-0"
                    : "-bottom-1 border-l-0 border-t-0"
                }`}
              />
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
