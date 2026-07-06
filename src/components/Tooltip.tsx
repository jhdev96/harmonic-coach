"use client";

import clsx from "clsx";

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  // "right" suits controls hugging the left viewport edge, where a centered
  // bottom tooltip would clip.
  side?: "bottom" | "right";
  // Applied to the wrapper so the tooltip can participate in flex layouts
  // (e.g. w-full when wrapping a full-width input).
  className?: string;
}

const SIDE_CLASSES: Record<NonNullable<TooltipProps["side"]>, string> = {
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

export default function Tooltip({
  label,
  children,
  side = "bottom",
  className = "",
}: TooltipProps) {
  return (
    <span 
      className={clsx(
        "group/tooltip relative inline-flex", 
        className
      )}
    >
      {children}
      <span
        role="tooltip"
        className={clsx(
          "pointer-events-none absolute z-30 whitespace-nowrap rounded-lg bg-[var(--foreground)] px-2.5 py-1.5 text-xs font-medium text-[var(--card)] opacity-0 shadow-[var(--shadow-arrow)] transition-opacity delay-150 duration-150 group-hover/tooltip:opacity-100 group-has-[:focus-visible]/tooltip:opacity-100",
          SIDE_CLASSES[side]
        )}
      >
        {label}
      </span>
    </span>
  );
}
