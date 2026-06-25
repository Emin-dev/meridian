"use client";

import { useState, useRef } from "react";
import type { KeyboardEvent, ChangeEvent } from "react";
import { tagColor } from "./tag-color";

interface Props {
  name: string;
  defaultValue?: string[];
}

export default function TagInput({ name, defaultValue = [] }: Props) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) {
      setInput("");
      return;
    }
    setTags((prev) => [...prev, tag]);
    setInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val.includes(",")) {
      const before = val.split(",")[0];
      addTag(before);
    } else {
      setInput(val);
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
      <div
        className="flex min-h-[38px] flex-wrap gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(tag)}`}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="opacity-60 hover:opacity-100 leading-none"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "Add tags…" : ""}
          className="min-w-[80px] flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-500 outline-none"
        />
      </div>
      <p className="mt-1 text-xs text-neutral-600">Press Enter or , to add a tag</p>
    </div>
  );
}
