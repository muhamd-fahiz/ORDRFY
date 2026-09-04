"use client";

interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

/**
 * A tappable, toggleable chip -- distinct from components/ui/Chip.tsx, which is a
 * display-only status pill. Modeled on components/ui/PipelineStageStepper.tsx's button
 * style (the one existing selectable-chip pattern in this codebase) rather than inventing
 * a new visual language for the wizard.
 */
export function ChoiceChip({ label, selected, onToggle }: ChoiceChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`rounded-full px-3.5 py-2 font-app text-sm font-semibold transition-colors ${
        selected ? "bg-pink-strong text-paper-raised" : "bg-ink-15 text-ink-70 hover:bg-ink-15/70"
      }`}
    >
      {label}
    </button>
  );
}
