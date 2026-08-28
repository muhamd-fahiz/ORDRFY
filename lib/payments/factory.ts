import type { PaymentProvider } from "./types";
import { MockPaymentProvider } from "./mock";

export function getPaymentProvider(): PaymentProvider {
  const mode = process.env.PAYMENT_PROVIDER ?? "mock";
  if (mode === "mock") return new MockPaymentProvider();
  throw new Error(
    `PAYMENT_PROVIDER=${mode} not implemented yet -- RazorpayAdapter is Build Order Phase 4.`,
  );
}
