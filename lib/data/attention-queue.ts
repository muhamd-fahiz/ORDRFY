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
}

/**
 * Every unresolved owner_attention_queue item, grouped by contact and sorted
 * oldest-waiting-first (ADR-0006: "Oldest-unresolved-first ... a single query"). This is
 * the screen Today's 10-contact-by-recency cap cannot substitute for: a contact who hasn't
 * messaged recently but still has an old unresolved item would sort out of Today's list
 * entirely, while the count badge (a separate, unbounded query) kept counting them --
 * making that item invisible-but-counted. This screen has no such cap.
 */
export async function getAttentionQueue(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<AttentionQueueRow[]> {
  const { data: attentionRows, error: attentionError } = await supabase
    .from("owner_attention_queue")
    .select("contact_id, created_at")
    .eq("business_id", businessId)
    .is("resolved_at", null)
    .not("contact_id", "is", null)
    .order("created_at", { ascending: true });
  if (attentionError) throw new Error(`Failed to load attention queue: ${attentionError.message}`);

  if (!attentionRows || attentionRows.length === 0) return [];

  // First occurrence per contact_id is the oldest, since attentionRows is already sorted
  // created_at ascending -- no need for a separate min() pass.
  const oldestByContact = new Map<string, string>();
  const countByContact = new Map<string, number>();
  for (const row of attentionRows) {
    if (!oldestByContact.has(row.contact_id!)) oldestByContact.set(row.contact_id!, row.created_at);
    countByContact.set(row.contact_id!, (countByContact.get(row.contact_id!) ?? 0) + 1);
  }
  const contactIds = [...oldestByContact.keys()];

  const [{ data: contacts, error: contactsError }, { data: lastMessages, error: messagesError }] = await Promise.all([
    supabase.from("contacts").select("id, name, pipeline_stages(stage_label)").in("id", contactIds),
    supabase
      .from("messages")
      .select("contact_id, content, created_at")
      .eq("business_id", businessId)
      .eq("direction", "inbound")
      .in("contact_id", contactIds)
      .order("created_at", { ascending: false }),
  ]);
  if (contactsError) throw new Error(`Failed to load contacts: ${contactsError.message}`);
  if (messagesError) throw new Error(`Failed to load messages: ${messagesError.message}`);

  const latestMessageByContact = new Map<string, { content: string | null; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!latestMessageByContact.has(m.contact_id)) latestMessageByContact.set(m.contact_id, m);
  }
  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));

  return contactIds
    .map((contactId) => {
      const contact = contactById.get(contactId);
      const lastMessage = latestMessageByContact.get(contactId);
      return {
        contactId,
        contactName: contact?.name ?? "Unnamed contact",
        stageLabel: contact?.pipeline_stages?.stage_label ?? null,
        lastMessage: lastMessage?.content ?? "No messages yet",
        lastMessageAt: lastMessage?.created_at ?? null,
        oldestUnresolvedAt: oldestByContact.get(contactId)!,
        unresolvedCount: countByContact.get(contactId)!,
      };
    })
    .sort((a, b) => a.oldestUnresolvedAt.localeCompare(b.oldestUnresolvedAt));
}
