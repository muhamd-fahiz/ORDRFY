import { requireReadyOwnerSession } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";
import { getContactsList } from "@/lib/data/contacts-list";
import { formatRelativeTime } from "@/lib/design/format-time";
import { ContactsList } from "./contacts-list";

export default async function ContactsListPage() {
  const session = await requireReadyOwnerSession();
  const supabase = await createRlsClient();
  const data = await getContactsList(supabase, session.businessId, session.vertical);

  return (
    <div className="mx-auto max-w-sm px-4 py-6">
      <h1 className="mb-4 font-display text-xl font-bold text-ink">Contacts</h1>
      {data.contacts.length === 0 ? (
        <p className="font-app text-sm text-ink-70">
          No contacts yet. They&apos;ll appear here as soon as a customer messages you on WhatsApp or Instagram.
        </p>
      ) : (
        // formatRelativeTime() reads Date.now() -- computed here, once, on the server, and
        // passed down as a plain string. Calling it directly inside ContactsList (a client
        // component) instead would re-run it during browser hydration too, using the
        // browser's own clock -- a real hydration mismatch whenever that clock disagrees
        // with the server's by even a little, confirmed happening on a real phone.
        <ContactsList
          stages={data.stages}
          contacts={data.contacts.map((c) => ({ ...c, timeLabel: formatRelativeTime(c.lastMessageAt) }))}
        />
      )}
    </div>
  );
}
