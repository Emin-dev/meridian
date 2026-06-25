"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface OwnerFilterProps {
  owners: string[];
  selected: string;
}

export default function OwnerFilter({ owners, selected }: OwnerFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("owner", e.target.value);
    } else {
      params.delete("owner");
    }
    router.push(`?${params.toString()}`);
  }

  if (owners.length === 0) return null;

  return (
    <select
      value={selected}
      onChange={handleChange}
      className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 focus:border-indigo-500 focus:outline-none"
      aria-label="Filter by owner"
    >
      <option value="">All owners</option>
      {owners.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
