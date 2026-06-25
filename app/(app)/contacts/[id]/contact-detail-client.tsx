"use client";

import { useState } from "react";
import type { Contact } from "@/db/schema";
import EditContactForm from "./edit-contact-form";
import ContactDetailTabs from "./contact-detail-tabs";
import { tagColor } from "../tag-color";

/** Fields visible in the contact page header */
export type ContactHeaderUpdate = Pick<
  Contact,
  "name" | "title" | "company" | "tags"
>;

interface Props {
  initialContact: Contact;
  /** Server-rendered overview panel content EXCEPT the edit form */
  notesSlot: React.ReactNode;
  dealsSlot: React.ReactNode;
  tasksSlot: React.ReactNode;
  aiPanel: React.ReactNode;
  activityPanel: React.ReactNode;
}

export default function ContactDetailClient({
  initialContact,
  notesSlot,
  dealsSlot,
  tasksSlot,
  aiPanel,
  activityPanel,
}: Props) {
  const [contact, setContact] = useState(initialContact);
  // Incremented only on rollback so the form remounts with old defaultValues.
  const [formVersion, setFormVersion] = useState(0);

  function handleSaved(updates: ContactHeaderUpdate) {
    setContact((prev) => ({ ...prev, ...updates }));
  }

  function handleRollback(snapshot: Contact) {
    setContact(snapshot);
    setFormVersion((v) => v + 1);
  }

  const overviewPanel = (
    <>
      {/* Contact details form */}
      <div className="card p-4 sm:p-5">
        <h3 className="mb-4 text-sm font-medium text-neutral-300">
          Contact details
        </h3>
        <EditContactForm
          key={formVersion}
          contact={contact}
          onSaved={handleSaved}
          onRollback={handleRollback}
        />
      </div>
      {notesSlot}
      {dealsSlot}
      {tasksSlot}
    </>
  );

  return (
    <>
      {/* ── Contact header (rendered from local state) ──────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="mt-1 truncate text-xl font-semibold text-neutral-100">
            {contact.name}
          </h1>
          {(contact.title || contact.company) && (
            <p className="mt-0.5 text-sm text-neutral-400">
              {[contact.title, contact.company].filter(Boolean).join(" · ")}
            </p>
          )}
          {(contact.tags ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(contact.tags ?? []).map((t) => (
                <span
                  key={t}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(t)}`}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabbed content ──────────────────────────────────────────────────── */}
      <ContactDetailTabs
        overviewPanel={overviewPanel}
        aiPanel={aiPanel}
        activityPanel={activityPanel}
      />
    </>
  );
}
