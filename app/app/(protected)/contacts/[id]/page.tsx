import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReadyOwnerSession } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";
import { getContactDetail } from "@/lib/data/contact-detail";
import { PaymentCard } from "@/components/ui/PaymentCard";
import { StageChanger } from "./stage-changer";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireReadyOwnerSession();
  const { id } = await params;
  const supabase = await createRlsClient();
  const contact = await getContactDetail(supabase, session.businessId, session.vertical, id);

  if (!contact) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-6">
      <Link href="/app/contacts" className="mb-4 inline-block font-app text-xs text-ink-40 underline">
        &larr; Contacts
      </Link>
      <h1 className="mb-6 font-display text-xl font-bold text-ink">{contact.name}</h1>

      <section className="mb-6">
        <h2 className="mb-2 font-app text-xs font-semibold uppercase tracking-wide text-ink-40">Pipeline Stage</h2>
        <StageChanger contactId={contact.id} stages={contact.availableStages} currentStageId={contact.currentStageId} />
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-app text-xs font-semibold uppercase tracking-wide text-ink-40">Order Details</h2>
        {contact.verticalFields.length === 0 ? (
          <p className="font-app text-sm text-ink-70">
            No vertical-specific order fields for this business type.
          </p>
        ) : (
          <dl className="flex flex-col gap-2 rounded-2xl border border-ink-15 bg-paper-raised p-4">
            {contact.verticalFields.map((field) => (
              <div key={field.fieldKey} className="flex justify-between gap-3">
                <dt className="font-app text-sm text-ink-40">{field.fieldLabel}</dt>
                <dd className="text-right font-app text-sm text-ink">{field.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-app text-xs font-semibold uppercase tracking-wide text-ink-40">Payments</h2>
        {contact.payments.length === 0 ? (
          <p className="font-app text-sm text-ink-70">No payments recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {contact.payments.map((payment) => (
              <PaymentCard
                key={payment.id}
                orderReference={payment.orderReference}
                amountDue={payment.amountDue}
                amountPaid={payment.amountPaid}
                status={payment.status}
                dueDate={payment.dueDate}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
