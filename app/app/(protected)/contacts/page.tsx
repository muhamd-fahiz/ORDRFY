import { requireReadyOwnerSession } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";
import { getContactsList } from "@/lib/data/contacts-list";
import { ContactsList } from "./contacts-list";

export default async function ContactsListPage() {
  const session = await requireReadyOwnerSession();
  const supabase = await createRlsClient();
  const data = await getContactsList(supabase, session.businessId, session.vertical);

  return (
    <div className="mx-auto max-w-sm px-4 py-6">
      <h1 className="mb-4 font-display text-xl font-bold text-ink">Contacts</h1>
      {data.contacts.length === 0 ? (
        <p className="font-app text-sm text-ink-70">No contacts yet.</p>
      ) : (
        <ContactsList stages={data.stages} contacts={data.contacts} />
      )}
    </div>
  );
}
