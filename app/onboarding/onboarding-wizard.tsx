"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { VerticalKey } from "@/lib/design/verticals";
import { VERTICAL_META } from "@/lib/design/verticals";
import { detectVertical, resolveConfirmCandidates } from "@/lib/onboarding/detect-vertical";
import { VERTICAL_KNOWLEDGE_BY_KEY } from "@/lib/onboarding/verticals";
import { getAcknowledgement } from "@/lib/onboarding/acknowledgements";
import { applyVerticalChange } from "@/lib/onboarding/vertical-change";
import type { OnboardingDraft } from "@/lib/data/onboarding-draft";
import { ProgressDots } from "./progress-dots";
import { IdentityStep } from "./steps/identity-step";
import { DescriptionStep } from "./steps/description-step";
import { VerticalConfirmStep } from "./steps/vertical-confirm-step";
import { TellUsMoreStep, type AttributeSelection } from "./steps/tell-us-more-step";
import { ReviewStep } from "./steps/review-step";

type StepKey = "identity" | "description" | "confirm" | "more" | "review";
type SaveState = "idle" | "saving" | "saved";

const STEP_KEYS: readonly StepKey[] = ["identity", "description", "confirm", "more", "review"];

function isStepKey(value: string | null): value is StepKey {
  return value !== null && (STEP_KEYS as readonly string[]).includes(value);
}

function resumeStep(draft: OnboardingDraft): StepKey {
  if (isStepKey(draft.currentStep)) return draft.currentStep;
  if (!draft.businessName || !draft.city) return "identity";
  if (!draft.rawBusinessDescription) return "description";
  if (!draft.detectedVertical) return "confirm";
  return "more";
}

function toAttributeSelection(value: unknown): AttributeSelection {
  if (value === "not_sure") return "not_sure";
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

export function OnboardingWizard({ draft }: { draft: OnboardingDraft }) {
  const router = useRouter();

  const [step, setStep] = useState<StepKey>(() => resumeStep(draft));
  const [needsConfirm, setNeedsConfirm] = useState(draft.verticalConfidence === "ambiguous" || draft.verticalConfidence === "unmatched");
  // Persisted in structured_answers.moreSubStep (Phase 5 hardening) so a refresh mid-"more"
  // resumes on the actual sub-question the owner was on, not always back at the first one.
  const [moreSubStep, setMoreSubStep] = useState<0 | 1 | 2>(() => {
    const value = (draft.structuredAnswers as Record<string, unknown>).moreSubStep;
    return value === 1 || value === 2 ? value : 0;
  });

  const [businessName, setBusinessName] = useState(draft.businessName ?? "");
  const [city, setCity] = useState(draft.city ?? "");
  const [description, setDescription] = useState(draft.rawBusinessDescription ?? "");
  const [detectedVertical, setDetectedVertical] = useState<VerticalKey | null>(draft.detectedVertical);
  // Never persisted -- reconstructed here when resuming directly onto the confirm step, by
  // re-running the same deterministic detectVertical() against the saved description
  // (resume-bug fix, found live during the responsive audit pass). detectVertical() is
  // pure, so re-running it on the same input can never produce a different outcome than
  // whatever originally put the user on this screen -- there is nothing to persist.
  const [candidates, setCandidates] = useState<VerticalKey[]>(() => {
    if (resumeStep(draft) !== "confirm" || !draft.rawBusinessDescription) return [];
    return resolveConfirmCandidates(detectVertical(draft.rawBusinessDescription));
  });

  const [attributesSelection, setAttributesSelection] = useState<AttributeSelection>(() =>
    toAttributeSelection((draft.structuredAnswers as Record<string, unknown>).attributes),
  );
  const [preferencesSelection, setPreferencesSelection] = useState<AttributeSelection>(() =>
    toAttributeSelection((draft.structuredAnswers as Record<string, unknown>).operatingPreferences),
  );
  const [note, setNote] = useState(() => {
    const value = (draft.structuredAnswers as Record<string, unknown>).note;
    return typeof value === "string" ? value : "";
  });

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descriptionSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Identity fields had no autosave at all before this phase -- unlike every later step,
  // a refresh or closed tab before tapping "Continue" here silently lost whatever was
  // typed. Same debounce pattern as description below.
  const identitySaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Every autosave chains onto this promise, so at most one PATCH is ever in flight at a
  // time. Without it, two rapid chip taps fire two independent read-merge-write requests
  // on the server (app/api/app/onboarding/draft/route.ts), and whichever's UPDATE commits
  // last wins with whatever (possibly stale/partial) body it was sent with -- caught live
  // while testing this phase: selecting two chips back-to-back silently dropped the first
  // one. Serializing sends on the client removes the race for the realistic case (one
  // owner tapping quickly on their phone) without needing a database-level atomic merge.
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  function saveDraft(partial: Record<string, unknown>): Promise<{ detectedVertical?: VerticalKey | null }> {
    const run = async (): Promise<{ detectedVertical?: VerticalKey | null }> => {
      setSaveState("saving");
      try {
        const response = await fetch("/api/app/onboarding/draft", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(partial),
        });
        const body = (await response.json()) as { ok?: boolean; detectedVertical?: VerticalKey | null };
        if (!response.ok || !body.ok) {
          setSaveState("idle");
          return {};
        }
        setSaveState("saved");
        setTimeout(() => setSaveState((current) => (current === "saved" ? "idle" : current)), 1500);
        return { detectedVertical: body.detectedVertical };
      } catch {
        setSaveState("idle");
        return {};
      }
    };

    const next = saveQueueRef.current.then(run, run);
    saveQueueRef.current = next;
    return next;
  }

  // Resets the "Saved" cue on every screen change -- without it, a save's confirmation
  // (shown for 1.5s) could still be visible on the NEXT screen if the transition happened
  // to land inside that window, which reads as "is THIS screen's content saved?" confusion
  // rather than confirming the screen that actually just saved.
  function goToStep(next: StepKey) {
    setSaveState("idle");
    setStep(next);
  }

  // Persists moreSubStep on every change, not just local state -- otherwise a refresh
  // mid-"more" always resumed at the first sub-question regardless of actual progress.
  function updateMoreSubStep(next: 0 | 1 | 2) {
    setMoreSubStep(next);
    void saveDraft({ structuredAnswers: { moreSubStep: next } });
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);
    if (descriptionSaveTimeout.current) clearTimeout(descriptionSaveTimeout.current);
    descriptionSaveTimeout.current = setTimeout(() => {
      void saveDraft({ rawBusinessDescription: value });
    }, 800);
  }

  function handleIdentityFieldChange(next: { businessName: string; city: string }) {
    setBusinessName(next.businessName);
    setCity(next.city);
    if (identitySaveTimeout.current) clearTimeout(identitySaveTimeout.current);
    identitySaveTimeout.current = setTimeout(() => {
      void saveDraft({ businessName: next.businessName, city: next.city });
    }, 800);
  }

  async function handleIdentityContinue() {
    setSubmitting(true);
    if (identitySaveTimeout.current) clearTimeout(identitySaveTimeout.current);
    await saveDraft({ businessName, city, currentStep: "description" });
    setSubmitting(false);
    goToStep("description");
  }

  async function handleDescriptionContinue() {
    setSubmitting(true);
    if (descriptionSaveTimeout.current) clearTimeout(descriptionSaveTimeout.current);

    // Client-side detectVertical() for instant UI feedback -- deciding which screen comes
    // next always uses the server's authoritative recompute below, not this optimistic
    // value (Phase 4 refinement 7). Since detectVertical() is a pure function, the two
    // will always agree; the server call is the trust boundary, not a second opinion.
    const localResult = detectVertical(description);

    const result = await saveDraft({ rawBusinessDescription: description, currentStep: "confirm" });
    const authoritativeVertical = result.detectedVertical ?? null;
    const authoritativeConfident = authoritativeVertical !== null && localResult.status === "confident";

    setSubmitting(false);

    if (authoritativeConfident && authoritativeVertical) {
      // If the description was edited into a different vertical (e.g. Fashion -> Bakery),
      // the previous vertical's attribute/preference selections are meaningless under the
      // new one and must not survive -- see lib/onboarding/vertical-change.ts.
      const nextAnswers = applyVerticalChange(detectedVertical, authoritativeVertical, {
        attributesSelection,
        preferencesSelection,
        moreSubStep,
        note,
      });
      setDetectedVertical(authoritativeVertical);
      setNeedsConfirm(false);
      setAttributesSelection(nextAnswers.attributesSelection);
      setPreferencesSelection(nextAnswers.preferencesSelection);
      setMoreSubStep(nextAnswers.moreSubStep);
      await saveDraft({
        currentStep: "more",
        structuredAnswers: {
          attributes: nextAnswers.attributesSelection,
          operatingPreferences: nextAnswers.preferencesSelection,
          moreSubStep: nextAnswers.moreSubStep,
        },
      });
      goToStep("more");
      return;
    }

    setNeedsConfirm(true);
    setCandidates(resolveConfirmCandidates(localResult));
    goToStep("confirm");
  }

  async function handleVerticalConfirm(vertical: VerticalKey) {
    setSubmitting(true);
    const nextAnswers = applyVerticalChange(detectedVertical, vertical, {
      attributesSelection,
      preferencesSelection,
      moreSubStep,
      note,
    });
    setDetectedVertical(vertical);
    setAttributesSelection(nextAnswers.attributesSelection);
    setPreferencesSelection(nextAnswers.preferencesSelection);
    setMoreSubStep(nextAnswers.moreSubStep);
    await saveDraft({
      confirmedVertical: vertical,
      currentStep: "more",
      structuredAnswers: {
        attributes: nextAnswers.attributesSelection,
        operatingPreferences: nextAnswers.preferencesSelection,
        moreSubStep: nextAnswers.moreSubStep,
      },
    });
    setSubmitting(false);
    goToStep("more");
  }

  function toggleAttribute(key: string) {
    setAttributesSelection((current) => {
      const list = Array.isArray(current) ? current : [];
      const next = list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
      void saveDraft({ structuredAnswers: { attributes: next } });
      return next;
    });
  }

  function toggleAttributeNotSure() {
    setAttributesSelection((current) => {
      const next: AttributeSelection = current === "not_sure" ? [] : "not_sure";
      void saveDraft({ structuredAnswers: { attributes: next } });
      return next;
    });
  }

  function togglePreference(key: string) {
    setPreferencesSelection((current) => {
      const list = Array.isArray(current) ? current : [];
      const next = list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
      void saveDraft({ structuredAnswers: { operatingPreferences: next } });
      return next;
    });
  }

  function togglePreferenceNotSure() {
    setPreferencesSelection((current) => {
      const next: AttributeSelection = current === "not_sure" ? [] : "not_sure";
      void saveDraft({ structuredAnswers: { operatingPreferences: next } });
      return next;
    });
  }

  function handleNoteChange(value: string) {
    setNote(value);
    void saveDraft({ structuredAnswers: { note: value } });
  }

  async function handleMoreContinue() {
    if (moreSubStep < 2) {
      updateMoreSubStep((moreSubStep + 1) as 0 | 1 | 2);
      return;
    }
    setSubmitting(true);
    await saveDraft({ currentStep: "review" });
    setSubmitting(false);
    goToStep("review");
  }

  async function handleSkipMoreEntirely() {
    setSubmitting(true);
    await saveDraft({ currentStep: "review" });
    setSubmitting(false);
    goToStep("review");
  }

  async function handleFinish() {
    setSubmitting(true);
    setError(null);
    // Explicit, not just relying on Review having no mutating inputs of its own (Phase 5
    // hardening) -- provisioning must never race ahead of a still-in-flight autosave.
    await saveQueueRef.current;
    const response = await fetch("/api/app/onboarding/finish", { method: "POST" });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !body.ok) {
      setSubmitting(false);
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.replace("/app/today");
    router.refresh();
  }

  const stepOrder: StepKey[] = needsConfirm
    ? ["identity", "description", "confirm", "more", "review"]
    : ["identity", "description", "more", "review"];
  const currentIndex = stepOrder.indexOf(step);

  const vertical = detectedVertical ?? candidates[0] ?? null;
  const knowledge = vertical ? VERTICAL_KNOWLEDGE_BY_KEY[vertical] : null;

  return (
    <div>
      <ProgressDots total={stepOrder.length} current={Math.max(currentIndex, 0)} />

      {step === "identity" && (
        <IdentityStep
          businessName={businessName}
          city={city}
          onChangeBusinessName={(value) => handleIdentityFieldChange({ businessName: value, city })}
          onChangeCity={(value) => handleIdentityFieldChange({ businessName, city: value })}
          onContinue={handleIdentityContinue}
          submitting={submitting}
        />
      )}

      {step === "description" && (
        <DescriptionStep
          description={description}
          onChangeDescription={handleDescriptionChange}
          onContinue={handleDescriptionContinue}
          submitting={submitting}
          saveState={saveState}
        />
      )}

      {step === "confirm" && (
        <VerticalConfirmStep
          options={candidates.map((key) => ({ key, label: VERTICAL_META[key].label }))}
          onSelect={handleVerticalConfirm}
          submitting={submitting}
        />
      )}

      {step === "more" && knowledge && vertical && (
        <TellUsMoreStep
          acknowledgement={getAcknowledgement(vertical)}
          subStep={moreSubStep}
          attributeOptions={knowledge.suggestedAttributes}
          preferenceOptions={knowledge.suggestedOperatingPreferences}
          attributesSelection={attributesSelection}
          preferencesSelection={preferencesSelection}
          note={note}
          onToggleAttribute={toggleAttribute}
          onToggleAttributeNotSure={toggleAttributeNotSure}
          onTogglePreference={togglePreference}
          onTogglePreferenceNotSure={togglePreferenceNotSure}
          onChangeNote={handleNoteChange}
          onContinue={handleMoreContinue}
          onSkipWholeStep={handleSkipMoreEntirely}
          submitting={submitting}
        />
      )}

      {step === "review" && vertical && (
        <ReviewStep
          businessName={businessName}
          city={city}
          verticalLabel={VERTICAL_META[vertical].label}
          description={description}
          attributeOptions={knowledge?.suggestedAttributes ?? []}
          preferenceOptions={knowledge?.suggestedOperatingPreferences ?? []}
          attributesSelection={attributesSelection}
          preferencesSelection={preferencesSelection}
          note={note}
          onEditIdentity={() => goToStep("identity")}
          onEditDescription={() => goToStep("description")}
          onEditMore={() => {
            updateMoreSubStep(0);
            goToStep("more");
          }}
          onFinish={handleFinish}
          submitting={submitting}
          error={error}
        />
      )}
    </div>
  );
}
