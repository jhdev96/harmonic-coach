"use client";

import { useEffect, useRef, useState } from "react";

interface CustomSelectProps<T extends string> {
  id: string;
  value: T;
  options: readonly T[];
  ariaLabel: string;
  // Applied to the trigger button; the parent supplies field styling so the
  // trigger matches sibling inputs.
  className?: string;
  onChange: (value: T) => void;
  formatOption?: (option: T) => string;
}

export default function CustomSelect<T extends string>({
  id,
  value,
  options,
  ariaLabel,
  className,
  onChange,
  formatOption,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const format = (option: T) =>
    formatOption ? formatOption(option) : option;

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [isOpen, activeIndex]);

  function open() {
    setActiveIndex(Math.max(0, options.indexOf(value)));
    setIsOpen(true);
  }

  function commit(index: number) {
    if (index >= 0 && index < options.length) {
      onChange(options[index]);
    }
    setIsOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!isOpen) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        open();
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(options.length - 1, index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
        }
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onKeyDown={handleKeyDown}
        className={`flex items-center justify-between gap-2 text-left ${className ?? ""}`}
      >
        <span className="truncate">{format(value)}</span>
        <svg
          aria-hidden
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          className={`shrink-0 text-[var(--muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path
            d="M1 1.5L6 6.5L11 1.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-[0_12px_40px_-16px_rgba(42,37,32,0.5)]"
        >
          {options.map((option, index) => (
            <li
              key={option}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option === value}
              onPointerDown={(event) => {
                event.preventDefault();
                commit(index);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer px-4 py-2 text-base transition-colors ${
                index === activeIndex
                  ? "bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                  : "text-[var(--foreground)]"
              } ${option === value ? "font-semibold" : ""}`}
            >
              {format(option)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
