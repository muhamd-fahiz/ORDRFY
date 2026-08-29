import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

export interface PaymentsListRow {
  id: string;
  contactId: string;
  contactName: string;
  orderReference: string | null;
  amountDue: number;
  amountPaid: number;
  status: string;
  dueDate: string | null;
}

// overdue and pending are what an owner needs to act on; paid is reference-only history --
// this ordering, not due_date alone, is what makes "what do I still need to chase" readable
// at a glance. Matches idx_payments_business_status_due's own column order.
const STATUS_SORT_PRIORITY: Record<string, number> = { overdue: 0, pending: 1, paid: 2 };

/**
 * The full payments roster for the business (not per-contact -- that's Contact Detail's
 * job), for the "who still owes me money" screen the payments(business_id, status, due_date)
 * index was already built for.
 */
export async function getPaymentsList(supabase: SupabaseClient<Database>, businessId: string): Promise<PaymentsListRow[]> {
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, contact_id, order_reference, amount_due, amount_paid, status, due_date")
    .eq("business_id", businessId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (paymentsError) throw new Error(`Failed to load payments: ${paymentsError.message}`);
  if (!payments || payments.length === 0) return [];

  const contactIds = [...new Set(payments.map((p) => p.contact_id))];
  const { data: contacts, error: contactsError } = await supabase.from("contacts").select("id, name").in("id", contactIds);
  if (contactsError) throw new Error(`Failed to load contacts: ${contactsError.message}`);
  const nameByContactId = new Map((contacts ?? []).map((c) => [c.id, c.name ?? "Unnamed contact"]));

  return payments
    .map((p) => ({
      id: p.id,
      contactId: p.contact_id,
      contactName: nameByContactId.get(p.contact_id) ?? "Unnamed contact",
      orderReference: p.order_reference,
      amountDue: Number(p.amount_due),
      amountPaid: Number(p.amount_paid),
      status: p.status,
      dueDate: p.due_date,
    }))
    .sort((a, b) => {
      const priorityDiff = (STATUS_SORT_PRIORITY[a.status] ?? 1) - (STATUS_SORT_PRIORITY[b.status] ?? 1);
      if (priorityDiff !== 0) return priorityDiff;
      return (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
    });
}
