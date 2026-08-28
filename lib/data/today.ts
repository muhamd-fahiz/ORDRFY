import { createServiceRoleClient } from "@/lib/db/server";
import type { VerticalKey } from "@/lib/design/verticals";

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
  businessId: string;
  businessName: string;
  vertical: VerticalKey;
  unresolvedAttentionCount: number;
  contacts: TodayViewContact[];
}

export interface BusinessOption {
  id: string;
  name: string;
  vertical: VerticalKey;
}

/**
 * Reads via the service-role client, bypassing RLS -- a deliberate, temporary choice for
 * this preview-only route. There is no owner-login flow yet (CLAUDE.md known blocker #10:
 * "Admin owner-account creation/invite flow is not built"), so there is no real
 * authenticated business-owner session for an RLS-scoped client to run under. Once that
 * exists, this must be rewritten against createRlsClient() -- reading arbitrary businesses'
 * data via service-role is never acceptable in the real owner-facing app.
 */
export async function listBusinessOptions(): Promise<BusinessOption[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, vertical")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(`Failed to list businesses: ${error.message}`);
  return (data ?? []) as BusinessOption[];
}

export async function getTodayViewData(businessId: string): Promise<TodayViewData | null> {
  const supabase = createServiceRoleClient();

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name, vertical")
    .eq("id", businessId)
    .is("deleted_at", null)
    .maybeSingle();
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business) return null;

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

  // Latest inbound message per contact -- messages is ordered created_at desc above, so the
  // first occurrence per contact_id wins.
  const latestMessageByContact = new Map<string, { content: string | null; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!latestMessageByContact.has(m.contact_id)) latestMessageByContact.set(m.contact_id, m);
  }

  const attentionContactIds = new Set((attentionRows ?? []).map((r) => r.contact_id as string));

  return {
    businessId: business.id,
    businessName: business.name,
    vertical: business.vertical as VerticalKey,
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
