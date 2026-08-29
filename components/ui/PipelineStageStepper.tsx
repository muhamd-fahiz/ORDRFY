interface Stage {
  id: string;
  stageLabel: string;
}

interface PipelineStageStepperProps {
  stages: Stage[];
  currentStageId: string | null;
  onSelect: (stageId: string) => void;
  disabled?: boolean;
}

// Every stage is a single tap away -- no dropdown, no confirmation step. The current stage
// is visually distinct but not a different tone (Chip's confirmed/attention tones are
// reserved for real semantic meaning elsewhere -- see lib/data/today.ts's comment on why
// stage chips render neutral there; this component makes the same call for the same reason).
export function PipelineStageStepper({ stages, currentStageId, onSelect, disabled }: PipelineStageStepperProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((stage) => {
        const isCurrent = stage.id === currentStageId;
        return (
          <button
            key={stage.id}
            type="button"
            disabled={disabled || isCurrent}
            onClick={() => onSelect(stage.id)}
            className={`rounded-full px-3 py-1.5 font-app text-xs font-bold transition-colors disabled:cursor-default ${
              isCurrent
                ? "bg-pink-strong text-paper-raised"
                : "bg-ink-15 text-ink-70 hover:bg-ink-15/70 disabled:opacity-50"
            }`}
          >
            {stage.stageLabel}
          </button>
        );
      })}
    </div>
  );
}
