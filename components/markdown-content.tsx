import React from "react";

function isSafeHref(url: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(url.trim());
}

type Block =
  | { type: "paragraph"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "heading"; level: 1 | 2 | 3; text: string };

function parseInline(text: string, keyBase: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    const k = `${keyBase}-${i++}`;
    if (match[2] != null) {
      result.push(
        <strong key={k} className="font-semibold text-[var(--ink-1)]">
          {match[2]}
        </strong>
      );
    } else if (match[3] != null) {
      result.push(
        <em key={k} className="italic text-[var(--ink-2)]">
          {match[3]}
        </em>
      );
    } else if (match[4] != null) {
      result.push(
        <code
          key={k}
          className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono text-xs text-[var(--ink-2)]"
        >
          {match[4]}
        </code>
      );
    } else if (match[5] != null && match[6] != null) {
      if (isSafeHref(match[6])) {
        result.push(
          <a
            key={k}
            href={match[6]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline hover:text-[var(--accent-hover)]"
          >
            {match[5]}
          </a>
        );
      } else {
        result.push(match[0]);
      }
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  return result;
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    const h3 = line.match(/^###\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h1 = line.match(/^#\s+(.+)/);
    if (h3) {
      blocks.push({ type: "heading", level: 3, text: h3[1] });
      i++;
      continue;
    }
    if (h2) {
      blocks.push({ type: "heading", level: 2, text: h2[1] });
      i++;
      continue;
    }
    if (h1) {
      blocks.push({ type: "heading", level: 1, text: h1[1] });
      i++;
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#/.test(lines[i]) &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", lines: paraLines });
    }
  }

  return blocks;
}

export default function MarkdownContent({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  if (blocks.length === 0) return null;

  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const bk = `b${bi}`;

        if (block.type === "heading") {
          const cls =
            block.level === 1
              ? "text-sm font-semibold text-[var(--ink-1)]"
              : block.level === 2
                ? "text-sm font-medium text-[var(--ink-1)]"
                : "text-xs font-medium text-[var(--ink-2)] uppercase tracking-wide";
          return (
            <p key={bk} className={cls}>
              {parseInline(block.text, bk)}
            </p>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={bk} className="ml-4 list-disc space-y-0.5">
              {block.items.map((item, ii) => (
                <li
                  key={`${bk}-${ii}`}
                  className="text-sm text-[var(--ink-1)] leading-relaxed"
                >
                  {parseInline(item, `${bk}-li${ii}`)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={bk} className="ml-4 list-decimal space-y-0.5">
              {block.items.map((item, ii) => (
                <li
                  key={`${bk}-${ii}`}
                  className="text-sm text-[var(--ink-1)] leading-relaxed"
                >
                  {parseInline(item, `${bk}-li${ii}`)}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={bk} className="text-sm text-[var(--ink-1)] leading-relaxed">
            {block.lines.flatMap((line, li) => {
              const nodes = parseInline(line, `${bk}-l${li}`);
              return li < block.lines.length - 1
                ? [...nodes, <br key={`${bk}-br${li}`} />]
                : nodes;
            })}
          </p>
        );
      })}
    </div>
  );
}
