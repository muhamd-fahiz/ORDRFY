import { requireReadyOwnerSession } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";
import { getPaymentsList } from "@/lib/data/payments-list";
import { PaymentsList } from "./payments-list";

export default async function PaymentsPage() {
  const session = await requireReadyOwnerSession();
  const supabase = await createRlsClient();
  const payments = await getPaymentsList(supabase, session.businessId);

  return (
    <div className="mx-auto max-w-sm px-4 py-6">
      <h1 className="mb-6 font-display text-xl font-bold text-ink">Payments</h1>
      {payments.length === 0 ? (
        <p className="font-app text-sm text-ink-70">No payments recorded yet.</p>
      ) : (
        <PaymentsList payments={payments} />
      )}
    </div>
  );
}
