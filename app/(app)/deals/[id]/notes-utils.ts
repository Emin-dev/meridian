// Marker that separates user-authored notes from the AI win/loss insight
// stored in the same notes column.
export const WIN_LOSS_MARKER = "\n\n---WIN_LOSS_INSIGHT---\n";

/** Returns the user-authored portion of notes (before the marker). */
export function extractUserNotes(notes: string | null): string | null {
  if (!notes) return null;
  const idx = notes.indexOf(WIN_LOSS_MARKER);
  return idx >= 0 ? notes.slice(0, idx) || null : notes;
}

/** Returns the AI insight portion of notes (after the marker), or null. */
export function extractWinLossInsight(notes: string | null): string | null {
  if (!notes) return null;
  const idx = notes.indexOf(WIN_LOSS_MARKER);
  if (idx < 0) return null;
  return notes.slice(idx + WIN_LOSS_MARKER.length) || null;
}
