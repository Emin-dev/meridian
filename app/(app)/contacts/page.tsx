import Link from "next/link";
import { getDb, schema } from "@/db";
import NewContactModal from "./new-contact-modal";

export default async function ContactsPage() {
  const db = getDb();
  const contacts = db
    ? await db.select().from(schema.contacts).orderBy(schema.contacts.createdAt)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">Contacts</h2>
          <p className="mt-1 text-sm text-neutral-400">Manage your leads and customers.</p>
        </div>
        <NewContactModal hasDb={!!db} />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            All Contacts
          </p>
        </div>

        {contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <p className="text-sm text-neutral-400">
              {db ? "No contacts yet." : "Database not connected."}
            </p>
            <p className="text-xs text-neutral-600">
              {db
                ? "Click “New contact” to add your first contact."
                : "Set DATABASE_URL to connect your Neon database."}
            </p>
            {db && <NewContactModal hasDb={!!db} />}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Name
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Email
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Phone
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Company
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Title
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-neutral-800 last:border-0 transition-colors hover:bg-neutral-800/40"
                  >
                    <td className="px-5 py-3 font-medium text-neutral-100">
                      <Link
                        href={`/contacts/${c.id}`}
                        className="hover:text-indigo-400 transition-colors"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-neutral-400">{c.email ?? "—"}</td>
                    <td className="px-5 py-3 text-neutral-400">{c.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-neutral-400">{c.company ?? "—"}</td>
                    <td className="px-5 py-3 text-neutral-400">{c.title ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
