import type { ChaosMessage } from "@/lib/marketing/content";

// Small, deterministic rotation/offset per position -- not random, so the layout is stable
// across renders and identical for every visitor. Reuses the exact incoming-bubble shape
// already established in Hero.tsx (same rounded corner treatment, same ink-raised surface);
// the only new idea here is the loose, overlapping stack, not a new bubble style.
const ROTATIONS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "-rotate-1"];
const OFFSETS = ["ml-0", "ml-5", "ml-2", "ml-7", "ml-3"];

// Fixed bar heights (px) for the voice-note waveform -- decorative only, deterministic like
// everything else in this pile.
const WAVEFORM_HEIGHTS = [5, 11, 7, 14, 6, 12, 8, 4];

export interface ChaosVoiceMessage {
  from: string;
  /** e.g. "0:14" -- shown as-is, not computed. */
  duration: string;
}

interface ScatteredMessagesProps {
  messages: ChaosMessage[];
  /**
   * A voice note in the mix -- WhatsApp/Instagram customers really do send these, so it
   * belongs in a realistic picture of the inbox. Rendered with a play icon, a waveform, and
   * a duration only -- no transcript, no resolved content -- because Ordrfy does not
   * automatically process voice messages today (V1 explicitly ignores inbound media
   * content, routing it to Needs Owner Attention rather than acting on it). This is
   * deliberately never passed to TheShift, which only ever resolves a text message from
   * CHAOS_MESSAGES -- showing a voice note "becoming" an order would claim a capability
   * that doesn't exist.
   */
  voiceMessage?: ChaosVoiceMessage;
  /** Where the voice note sits among the text messages, purely for a natural-looking pile order. */
  voiceMessagePosition?: number;
  /** Shown under the pile -- omit when the caller (e.g. TheShift) doesn't need the "more waiting" framing. */
  moreCount?: number;
}

function TextBubble({ message, index }: { message: ChaosMessage; index: number }) {
  return (
    <div
      className={`self-start rounded-[14px_14px_14px_4px] border border-paper/10 bg-ink-raised px-3.5 py-[11px] text-[14px] leading-[1.4] text-paper/90 shadow-[0_10px_24px_rgba(0,0,0,0.28)] ${ROTATIONS[index % ROTATIONS.length]} ${OFFSETS[index % OFFSETS.length]}`}
    >
      <span className="mr-1.5 font-data text-[10px] font-bold uppercase tracking-[0.08em] text-pink">{message.from}</span>
      {message.text}
    </div>
  );
}

function VoiceBubble({ message, index }: { message: ChaosVoiceMessage; index: number }) {
  return (
    <div
      className={`self-start rounded-[14px_14px_14px_4px] border border-paper/10 bg-ink-raised px-3.5 py-[11px] shadow-[0_10px_24px_rgba(0,0,0,0.28)] ${ROTATIONS[index % ROTATIONS.length]} ${OFFSETS[index % OFFSETS.length]}`}
    >
      <span className="mr-1.5 font-data text-[10px] font-bold uppercase tracking-[0.08em] text-pink">{message.from}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-pink" aria-hidden="true">
          <span className="ml-px h-0 w-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-white" />
        </span>
        <span className="flex items-end gap-[2px]" aria-hidden="true">
          {WAVEFORM_HEIGHTS.map((height, barIndex) => (
            <span key={barIndex} className="w-[2px] rounded-full bg-paper/40" style={{ height: `${height}px` }} />
          ))}
        </span>
        <span className="font-data text-[11px] text-paper/50">{message.duration}</span>
        <span className="sr-only">Voice message, {message.duration}</span>
      </div>
    </div>
  );
}

/**
 * The Chaos visual: a pile of separate customers' messages, arriving with no order to them --
 * the direct visual opposite of OrderSlip's one-slip-per-customer clarity. Deliberately reuses
 * only markup/classes already established elsewhere on the site (Hero's chat bubble), per the
 * "do not create a new visual system" instruction.
 */
export function ScatteredMessages({ messages, voiceMessage, voiceMessagePosition = 2, moreCount }: ScatteredMessagesProps) {
  const before = messages.slice(0, voiceMessagePosition);
  const after = messages.slice(voiceMessagePosition);

  return (
    <div className="mx-auto flex max-w-[380px] flex-col gap-3">
      {before.map((message, index) => (
        <TextBubble key={`${message.from}-${index}`} message={message} index={index} />
      ))}
      {voiceMessage && <VoiceBubble message={voiceMessage} index={voiceMessagePosition} />}
      {after.map((message, index) => (
        <TextBubble key={`${message.from}-${index + voiceMessagePosition}`} message={message} index={index + voiceMessagePosition + (voiceMessage ? 1 : 0)} />
      ))}
      {typeof moreCount === "number" && (
        <span className="mt-1 self-start rounded-full bg-pink/15 px-3 py-1.5 font-data text-[10.5px] font-bold uppercase tracking-[0.08em] text-pink">
          + {moreCount} more today
        </span>
      )}
    </div>
  );
}
