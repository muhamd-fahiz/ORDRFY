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
  /** Every phone number / @handle across this contact's channel identities, for client-side
   *  search only -- never rendered as-is (no masking/redaction applied here). */
  searchText: string;
}

export interface ContactsListData {
  stages: ContactsListStage[];
  contacts: ContactsListRow[];
}

/**
 * The full roster, not just the recently-active contacts lib/data/today.ts caps at 10 --
 * this is the "find anyone, not just who needs attention today" screen, so no MAX_CONTACTS
 * limit. Filtering by pipeline stage plus a plain client-side name/phone/handle substring
 * match (ContactsList's own searchText field) over that same already-loaded array -- not
 * the full-text/universal search CLAUDE.md's "what NOT to build" list excludes, which means
 * a dedicated search index/ranking system, not a plain filter over data already in memory.
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
  const safeContactIds = contactIds.length > 0 ? contactIds : ["00000000-0000-0000-0000-000000000000"];

  const [{ data: lastMessages, error: messagesError }, { data: identities, error: identitiesError }] = await Promise.all([
    supabase
      .from("messages")
      .select("contact_id, content, created_at")
      .eq("business_id", businessId)
      .eq("direction", "inbound")
      .in("contact_id", safeContactIds)
      .order("created_at", { ascending: false }),
    supabase.from("contact_channel_identities").select("contact_id, phone_number, display_handle").eq("business_id", businessId).in("contact_id", safeContactIds),
  ]);
  if (messagesError) throw new Error(`Failed to load messages: ${messagesError.message}`);
  if (identitiesError) throw new Error(`Failed to load contact identities: ${identitiesError.message}`);

  const latestMessageByContact = new Map<string, { content: string | null; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!latestMessageByContact.has(m.contact_id)) latestMessageByContact.set(m.contact_id, m);
  }

  const searchTextByContact = new Map<string, string>();
  for (const identity of identities ?? []) {
    const existing = searchTextByContact.get(identity.contact_id) ?? "";
    searchTextByContact.set(identity.contact_id, `${existing} ${identity.phone_number ?? ""} ${identity.display_handle ?? ""}`);
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
        searchText: `${c.name ?? ""} ${searchTextByContact.get(c.id) ?? ""}`.toLowerCase(),
      };
    }),
  };
}
