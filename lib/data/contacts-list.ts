import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

export interface ContactsListStage {
  id: string;
  stageLabel: string;
}

export interface ContactsListRow {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string | null;
  stageId: string | null;
  stageLabel: string | null;
}

export interface ContactsListData {
  stages: ContactsListStage[];
  contacts: ContactsListRow[];
}

/**
 * The full roster, not just the recently-active contacts lib/data/today.ts caps at 10 --
 * this is the "find anyone, not just who needs attention today" screen, so no MAX_CONTACTS
 * limit. No text search (full-text/universal search are both explicitly out of V1 scope,
 * CLAUDE.md's "what NOT to build" list) -- filtering by pipeline stage instead, since that's
 * real structured data the product already has, not a search feature to build.
 */
export async function getContactsList(
  supabase: SupabaseClient<Database>,
  businessId: string,
  vertical: string,
): Promise<ContactsListData> {
  const [
    { data: contacts, error: contactsError },
    { data: businessStages, error: businessStagesError },
    { data: verticalDefaultStages, error: verticalStagesError },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, last_inbound_at, pipeline_stages(id, stage_label)")
      .eq("business_id", businessId)
      .order("last_inbound_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("pipeline_stages")
      .select("id, stage_label, sort_order")
      .eq("business_id", businessId)
      .order("sort_order"),
    supabase
      .from("pipeline_stages")
      .select("id, stage_label, sort_order")
      .is("business_id", null)
      .eq("vertical", vertical)
      .order("sort_order"),
  ]);
  if (contactsError) throw new Error(`Failed to load contacts: ${contactsError.message}`);
  if (businessStagesError) throw new Error(`Failed to load business pipeline stages: ${businessStagesError.message}`);
  if (verticalStagesError) throw new Error(`Failed to load vertical default pipeline stages: ${verticalStagesError.message}`);

  const stages: ContactsListStage[] =
    businessStages && businessStages.length > 0
      ? businessStages.map((s) => ({ id: s.id, stageLabel: s.stage_label }))
      : (verticalDefaultStages ?? []).map((s) => ({ id: s.id, stageLabel: s.stage_label }));

  const contactIds = (contacts ?? []).map((c) => c.id);
  const { data: lastMessages, error: messagesError } = await supabase
    .from("messages")
    .select("contact_id, content, created_at")
    .eq("business_id", businessId)
    .eq("direction", "inbound")
    .in("contact_id", contactIds.length > 0 ? contactIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });
  if (messagesError) throw new Error(`Failed to load messages: ${messagesError.message}`);

  const latestMessageByContact = new Map<string, { content: string | null; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!latestMessageByContact.has(m.contact_id)) latestMessageByContact.set(m.contact_id, m);
  }

  return {
    stages,
    contacts: (contacts ?? []).map((c) => {
      const lastMessage = latestMessageByContact.get(c.id);
      return {
        id: c.id,
        name: c.name ?? "Unnamed contact",
        lastMessage: lastMessage?.content ?? "No messages yet",
        lastMessageAt: lastMessage?.created_at ?? c.last_inbound_at,
        stageId: c.pipeline_stages?.id ?? null,
        stageLabel: c.pipeline_stages?.stage_label ?? null,
      };
    }),
  };
}
