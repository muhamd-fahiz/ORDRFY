export interface PaymentStatusUpdate {
  providerPaymentId: string;
  status: "paid" | "failed";
  amountPaid: number;
}

export interface PaymentProvider {
  createPaymentLink(amountDue: number, contactRef: string): Promise<string>;
  verifyWebhookSignature(rawPayload: string, signature: string | null): boolean;
  handleWebhook(rawPayload: unknown): PaymentStatusUpdate;
}
