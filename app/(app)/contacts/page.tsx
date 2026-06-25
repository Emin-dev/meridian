export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">Contacts</h2>
          <p className="mt-1 text-sm text-neutral-400">Manage your leads and customers.</p>
        </div>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500">
          Add Contact
        </button>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">All Contacts</p>
        </div>
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-neutral-500">No contacts yet. Add your first contact to get started.</p>
        </div>
      </div>
    </div>
  );
}
