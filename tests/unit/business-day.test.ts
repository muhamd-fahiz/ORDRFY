import { describe, it, expect } from "vitest";
import { getBusinessDateString } from "@/lib/engine/business-day";

const IST = "Asia/Kolkata";

describe("getBusinessDateString", () => {
  it("matches the UTC date for most of the day (well after the IST rollover)", () => {
    // 2026-09-02T12:00:00Z = 2026-09-02T17:30 IST -- both clocks agree it's the 2nd.
    const now = new Date("2026-09-02T12:00:00Z");
    expect(getBusinessDateString(IST, now)).toBe("2026-09-02");
  });

  it("is already the next IST day just before UTC midnight (18:30Z = 00:00 IST)", () => {
    // 2026-09-02T18:30:00Z = 2026-09-03T00:00 IST exactly.
    const now = new Date("2026-09-02T18:30:00Z");
    expect(getBusinessDateString(IST, now)).toBe("2026-09-03");
  });

  it("is the confirmed bug window: UTC still says yesterday, IST has already rolled over", () => {
    // 2026-09-02T20:00:00Z = 2026-09-03T01:30 IST -- naive UTC-date logic would still say
    // "2026-09-02" here, which is exactly the false "already sent today" bug.
    const now = new Date("2026-09-02T20:00:00Z");
    expect(getBusinessDateString(IST, now)).toBe("2026-09-03");
  });

  it("rolls over to the new IST day at exactly 18:30Z, not a moment before", () => {
    const justBefore = new Date("2026-09-02T18:29:59Z");
    const atRollover = new Date("2026-09-02T18:30:00Z");
    expect(getBusinessDateString(IST, justBefore)).toBe("2026-09-02");
    expect(getBusinessDateString(IST, atRollover)).toBe("2026-09-03");
  });

  it("treats two timestamps either side of the IST rollover as different business days", () => {
    const beforeMidnightIst = new Date("2026-09-02T17:00:00Z"); // 2026-09-02T22:30 IST
    const afterMidnightIst = new Date("2026-09-02T19:00:00Z"); // 2026-09-03T00:30 IST
    expect(getBusinessDateString(IST, beforeMidnightIst)).not.toBe(getBusinessDateString(IST, afterMidnightIst));
  });

  it("treats two timestamps on either side of the UTC-only boundary as the SAME IST business day", () => {
    // Naive UTC-date logic would treat these as two different days (2026-09-02 vs
    // 2026-09-03), which is the mirror-image bug: it would wrongly ALLOW a second manual
    // reminder within what the owner considers a single IST calendar day.
    const earlyIst = new Date("2026-09-01T20:00:00Z"); // 2026-09-02T01:30 IST
    const laterSameIstDay = new Date("2026-09-02T10:00:00Z"); // 2026-09-02T15:30 IST
    expect(getBusinessDateString(IST, earlyIst)).toBe(getBusinessDateString(IST, laterSameIstDay));
  });
});
