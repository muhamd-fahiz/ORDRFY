import { describe, it, expect } from "vitest";
import { isAutomationEligibleForBilling } from "@/lib/engine/trial-eligibility";

describe("isAutomationEligibleForBilling", () => {
  it("is always eligible when subscription is active, regardless of trial_ends_at", () => {
    expect(
      isAutomationEligibleForBilling({
        subscriptionStatus: "active",
        trialEndsAt: "2020-01-01T00:00:00Z",
        gracePeriodDays: 3,
      }),
    ).toBe(true);
  });

  it("is never eligible when subscription is inactive, even with a future trial_ends_at", () => {
    expect(
      isAutomationEligibleForBilling({
        subscriptionStatus: "inactive",
        trialEndsAt: "2099-01-01T00:00:00Z",
        gracePeriodDays: 3,
      }),
    ).toBe(false);
  });

  it("is eligible during an on-going trial, before trial_ends_at", () => {
    const now = new Date("2026-08-28T12:00:00Z");
    expect(
      isAutomationEligibleForBilling({
        subscriptionStatus: "trial",
        trialEndsAt: "2026-08-30T00:00:00Z",
        gracePeriodDays: 3,
        now,
      }),
    ).toBe(true);
  });

  it("is eligible within the grace period after trial_ends_at has passed", () => {
    const now = new Date("2026-08-28T12:00:00Z");
    expect(
      isAutomationEligibleForBilling({
        subscriptionStatus: "trial",
        trialEndsAt: "2026-08-26T00:00:00Z", // 2 days, 12h ago
        gracePeriodDays: 3,
        now,
      }),
    ).toBe(true);
  });

  it("is not eligible once the grace period after trial_ends_at has fully elapsed", () => {
    const now = new Date("2026-08-28T12:00:00Z");
    expect(
      isAutomationEligibleForBilling({
        subscriptionStatus: "trial",
        trialEndsAt: "2026-08-20T00:00:00Z", // 8 days ago
        gracePeriodDays: 3,
        now,
      }),
    ).toBe(false);
  });

  it("does not block on missing trial_ends_at data", () => {
    expect(
      isAutomationEligibleForBilling({
        subscriptionStatus: "trial",
        trialEndsAt: null,
        gracePeriodDays: 3,
      }),
    ).toBe(true);
  });

  it("respects a zero-day grace period as an immediate cutoff at trial_ends_at", () => {
    const now = new Date("2026-08-28T00:00:01Z");
    expect(
      isAutomationEligibleForBilling({
        subscriptionStatus: "trial",
        trialEndsAt: "2026-08-28T00:00:00Z",
        gracePeriodDays: 0,
        now,
      }),
    ).toBe(false);
  });
});
