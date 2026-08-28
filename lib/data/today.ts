import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

const MAX_CONTACTS = 10;

export interface TodayViewContact {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string | null;
  stageLabel: string | null;
  hasUnresolvedAttention: boolean;
}

export interface TodayViewData {
  unresolvedAttentionCount: number;
  contacts: TodayViewContact[];
}

/**
 * Reads through an RLS-scoped client (createRlsClient()) -- every query below is naturally
 * confined to the caller's own business via the tenant-isolation policies on contacts/
 * messages/owner_attention_queue (business_id in (select business_id from
 * business_memberships where user_id = auth.uid())), so businessId is only needed to filter
 * within that already-narrowed row set, never to widen it. This replaces an earlier version
 * that read via the service-role client because there was no owner session to scope to yet
 * (see git history) -- do not go back to that pattern now that one exists.
 */
export async function getTodayViewData(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<TodayViewData> {
  const { count: unresolvedAttentionCount, error: attentionCountError } = await supabase
    .from("owner_attention_queue")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .is("resolved_at", null);
  if (attentionCountError) throw new Error(`Failed to count attention items: ${attentionCountError.message}`);

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, name, last_inbound_at, pipeline_stages(stage_label)")
    .eq("business_id", businessId)
    .order("last_inbound_at", { ascending: false, nullsFirst: false })
    .limit(MAX_CONTACTS);
  if (contactsError) throw new Error(`Failed to load contacts: ${contactsError.message}`);

  const contactIds = (contacts ?? []).map((c) => c.id);

  const [{ data: lastMessages, error: messagesError }, { data: attentionRows, error: attentionRowsError }] =
    await Promise.all([
      supabase
        .from("messages")
        .select("contact_id, content, created_at")
        .eq("business_id", businessId)
        .eq("direction", "inbound")
        .in("contact_id", contactIds.length > 0 ? contactIds : ["00000000-0000-0000-0000-000000000000"])
        .order("created_at", { ascending: false }),
      supabase
        .from("owner_attention_queue")
        .select("contact_id")
        .eq("business_id", businessId)
        .is("resolved_at", null)
        .not("contact_id", "is", null),
    ]);
  if (messagesError) throw new Error(`Failed to load messages: ${messagesError.message}`);
  if (attentionRowsError) throw new Error(`Failed to load attention rows: ${attentionRowsError.message}`);

  const latestMessageByContact = new Map<string, { content: string | null; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!latestMessageByContact.has(m.contact_id)) latestMessageByContact.set(m.contact_id, m);
  }

  const attentionContactIds = new Set((attentionRows ?? []).map((r) => r.contact_id as string));

  return {
    unresolvedAttentionCount: unresolvedAttentionCount ?? 0,
    contacts: (contacts ?? []).map((c) => {
      const lastMessage = latestMessageByContact.get(c.id);
      return {
        id: c.id,
        name: c.name ?? "Unnamed contact",
        lastMessage: lastMessage?.content ?? "No messages yet",
        lastMessageAt: lastMessage?.created_at ?? c.last_inbound_at,
        stageLabel: c.pipeline_stages?.stage_label ?? null,
        hasUnresolvedAttention: attentionContactIds.has(c.id),
      };
    }),
  };
}
