import { describe, it, expect } from "vitest";
import { selectReminderChannel, isInstagramWindowOpen } from "@/lib/engine/channel-selection";

describe("isInstagramWindowOpen", () => {
  it("is closed when there's never been an inbound message", () => {
    expect(isInstagramWindowOpen(null)).toBe(false);
  });

  it("is open just under 24h after the last inbound message", () => {
    const now = new Date("2026-08-28T12:00:00Z");
    const lastInbound = new Date("2026-08-27T13:00:00Z").toISOString(); // 23h ago
    expect(isInstagramWindowOpen(lastInbound, now)).toBe(true);
  });

  it("is closed at exactly 24h and beyond", () => {
    const now = new Date("2026-08-28T12:00:00Z");
    const lastInbound = new Date("2026-08-27T12:00:00Z").toISOString(); // exactly 24h
    expect(isInstagramWindowOpen(lastInbound, now)).toBe(false);
  });
});

describe("selectReminderChannel", () => {
  it("prefers WhatsApp for a native contact with no consent row at all (consentStatus null)", () => {
    const result = selectReminderChannel({
      whatsapp: { optedOutAt: null, consentStatus: null },
      instagram: null,
    });
    expect(result).toEqual({ outcome: "whatsapp" });
  });

  it("routes an Instagram-origin contact to WhatsApp once consent is granted", () => {
    const result = selectReminderChannel({
      whatsapp: { optedOutAt: null, consentStatus: "granted" },
      instagram: { optedOutAt: null, lastInboundAt: null }, // window irrelevant once WhatsApp is eligible
    });
    expect(result).toEqual({ outcome: "whatsapp" });
  });

  it("falls back to Instagram directly when the window is open and WhatsApp isn't eligible", () => {
    const now = new Date("2026-08-28T12:00:00Z");
    const result = selectReminderChannel({
      whatsapp: null,
      instagram: { optedOutAt: null, lastInboundAt: new Date("2026-08-28T10:00:00Z").toISOString() },
      now,
    });
    expect(result).toEqual({ outcome: "instagram" });
  });

  it("is unsupported when WhatsApp consent was revoked and the Instagram window is closed", () => {
    const now = new Date("2026-08-28T12:00:00Z");
    const result = selectReminderChannel({
      whatsapp: { optedOutAt: null, consentStatus: "revoked" },
      instagram: { optedOutAt: null, lastInboundAt: new Date("2026-08-25T12:00:00Z").toISOString() },
      now,
    });
    expect(result).toEqual({ outcome: "unsupported" });
  });

  it("is unsupported when the only WhatsApp identity is opted out and Instagram has no identity at all", () => {
    const result = selectReminderChannel({
      whatsapp: { optedOutAt: new Date().toISOString(), consentStatus: null },
      instagram: null,
    });
    expect(result).toEqual({ outcome: "unsupported" });
  });

  it("is unsupported when the contact has no channel identities at all", () => {
    const result = selectReminderChannel({ whatsapp: null, instagram: null });
    expect(result).toEqual({ outcome: "unsupported" });
  });

  it("does not fall back to Instagram when WhatsApp consent is merely pending, not yet granted", () => {
    const now = new Date("2026-08-28T12:00:00Z");
    const result = selectReminderChannel({
      whatsapp: { optedOutAt: null, consentStatus: "pending" },
      instagram: { optedOutAt: null, lastInboundAt: new Date("2026-08-28T10:00:00Z").toISOString() },
      now,
    });
    expect(result).toEqual({ outcome: "instagram" });
  });
});
