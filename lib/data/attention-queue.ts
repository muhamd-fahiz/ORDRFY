import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

export interface AttentionQueueRow {
  contactId: string;
  contactName: string;
  stageLabel: string | null;
  lastMessage: string;
  lastMessageAt: string | null;
  oldestUnresolvedAt: string;
  unresolvedCount: number;
  /** owner_attention_queue.reason of the oldest unresolved item -- see
   *  lib/design/attention-reasons.ts for the owner-facing copy. */
  reason: string;
}

interface OldestAttentionItem {
  createdAt: string;
  reason: string;
  referenceType: string;
  referenceId: string | null;
}

/**
 * Every unresolved owner_attention_queue item, grouped by contact and sorted
 * oldest-waiting-first (ADR-0006: "Oldest-unresolved-first ... a single query"). This is
 * the screen Today's 10-contact-by-recency cap cannot substitute for: a contact who hasn't
 * messaged recently but still has an old unresolved item would sort out of Today's list
 * entirely, while the count badge (a separate, unbounded query) kept counting them --
 * making that item invisible-but-counted. This screen has no such cap.
 *
 * "Make Automation Visible" phase: `lastMessage` now shows the EXACT message the oldest
 * unresolved item references (reference_type='message', reference_id=that message's id) --
 * not, as before, "this contact's most recent inbound message overall," which could be a
 * different, later message than the one that actually triggered the alert if the contact
 * messaged again before the owner looked. The "most recent inbound message" derivation is
 * kept only as a fallback for reference_type='reminder'/'contact' rows, which have no
 * message to point to.
 */
export async function getAttentionQueue(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<AttentionQueueRow[]> {
  const { data: attentionRows, error: attentionError } = await supabase
    .from("owner_attention_queue")
    .select("contact_id, created_at, reason, reference_type, reference_id")
    .eq("business_id", businessId)
    .is("resolved_at", null)
    .not("contact_id", "is", null)
    .order("created_at", { ascending: true });
  if (attentionError) throw new Error(`Failed to load attention queue: ${attentionError.message}`);

  if (!attentionRows || attentionRows.length === 0) return [];

  // First occurrence per contact_id is the oldest, since attentionRows is already sorted
  // created_at ascending -- no need for a separate min() pass.
  const oldestByContact = new Map<string, OldestAttentionItem>();
  const countByContact = new Map<string, number>();
  for (const row of attentionRows) {
    if (!oldestByContact.has(row.contact_id!)) {
      oldestByContact.set(row.contact_id!, {
        createdAt: row.created_at,
        reason: row.reason,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
      });
    }
    countByContact.set(row.contact_id!, (countByContact.get(row.contact_id!) ?? 0) + 1);
  }
  const contactIds = [...oldestByContact.keys()];

  const messageReferenceIds = [...new Set([...oldestByContact.values()].filter((v) => v.referenceType === "message" && v.referenceId).map((v) => v.referenceId!))];

  const [{ data: contacts, error: contactsError }, { data: lastMessages, error: messagesError }, { data: referencedMessages, error: referencedError }] =
    await Promise.all([
      supabase.from("contacts").select("id, name, pipeline_stages(stage_label)").in("id", contactIds),
      supabase
        .from("messages")
        .select("contact_id, content, created_at")
        .eq("business_id", businessId)
        .eq("direction", "inbound")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false }),
      messageReferenceIds.length > 0
        ? supabase.from("messages").select("id, content, created_at").eq("business_id", businessId).in("id", messageReferenceIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (contactsError) throw new Error(`Failed to load contacts: ${contactsError.message}`);
  if (messagesError) throw new Error(`Failed to load messages: ${messagesError.message}`);
  if (referencedError) throw new Error(`Failed to load referenced messages: ${referencedError.message}`);

  const latestMessageByContact = new Map<string, { content: string | null; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!latestMessageByContact.has(m.contact_id)) latestMessageByContact.set(m.contact_id, m);
  }
  const referencedMessageById = new Map((referencedMessages ?? []).map((m) => [m.id, m]));
  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));

  return contactIds
    .map((contactId) => {
      const contact = contactById.get(contactId);
      const oldest = oldestByContact.get(contactId)!;
      const referenced = oldest.referenceType === "message" && oldest.referenceId ? referencedMessageById.get(oldest.referenceId) : null;
      // Falls back to the contact's most recent inbound message only when the triggering
      // item has no message to point to (a reminder-related reason) -- never as a silent
      // substitute for a referenced message that simply hasn't loaded.
      const fallback = latestMessageByContact.get(contactId);
      const displayMessage = referenced ?? fallback;
      return {
        contactId,
        contactName: contact?.name ?? "Unnamed contact",
        stageLabel: contact?.pipeline_stages?.stage_label ?? null,
        lastMessage: displayMessage?.content ?? "No messages yet",
        lastMessageAt: displayMessage?.created_at ?? null,
        oldestUnresolvedAt: oldest.createdAt,
        unresolvedCount: countByContact.get(contactId)!,
        reason: oldest.reason,
      };
    })
    .sort((a, b) => a.oldestUnresolvedAt.localeCompare(b.oldestUnresolvedAt));
}
