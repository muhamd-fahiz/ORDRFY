/**
 * Trial-expiry graceful degradation
 * (docs/architecture/decisions/0013-trial-expiry-separate-from-kill-switch.md).
 * Deliberately NOT a check against businesses.automation_paused
 * -- that flag stays exclusively the admin-toggled kill switch (Non-Negotiable Architecture
 * Rule 7). This is a separate, computed condition.
 */

export type SubscriptionStatus = "trial" | "active" | "inactive";

export interface TrialEligibilityInput {
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  gracePeriodDays: number;
  now?: Date;
}

export function isAutomationEligibleForBilling(input: TrialEligibilityInput): boolean {
  if (input.subscriptionStatus === "active") return true;
  if (input.subscriptionStatus === "inactive") return false;

  // 'trial'
  if (!input.trialEndsAt) return true; // no trial end set yet -- don't block on missing data
  const now = input.now ?? new Date();
  const graceEnd = new Date(input.trialEndsAt);
  graceEnd.setDate(graceEnd.getDate() + input.gracePeriodDays);
  return now < graceEnd;
}
