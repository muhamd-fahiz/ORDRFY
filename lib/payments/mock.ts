import type { PaymentProvider, PaymentStatusUpdate } from "./types";

/**
 * Returns a fake local URL that, when "clicked" in a test flow, immediately fires a
 * simulated success webhook -- lets the full payment-tracking, reminder, and
 * stage-progression logic be tested without Razorpay at all
 * (Ordrfy-Cost-Optimized-Stack.pdf Section 3).
 */
export class MockPaymentProvider implements PaymentProvider {
  async createPaymentLink(amountDue: number, contactRef: string): Promise<string> {
    return `https://mock-payments.local/pay/${contactRef}?amount=${amountDue}`;
  }

  verifyWebhookSignature(_rawPayload: string, _signature: string | null): boolean {
    return true;
  }

  handleWebhook(rawPayload: unknown): PaymentStatusUpdate {
    const payload = rawPayload as { contactRef: string; amount: number };
    return {
      providerPaymentId: `mock-pay-${crypto.randomUUID()}`,
      status: "paid",
      amountPaid: payload.amount,
    };
  }
}
