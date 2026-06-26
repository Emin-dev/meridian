import { SparklesIcon } from "@/components/icons";
import AskForm from "./ask-form";

export default function AskPage() {
  const hasDb = !!process.env.DATABASE_URL;
  const hasKey = !!process.env.DEEPSEEK_API_KEY;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <SparklesIcon size={20} className="text-[var(--accent)]" aria-hidden="true" />
          <h2 className="text-title2 font-semibold text-[var(--ink-1)]">Ask your CRM</h2>
        </div>
        <p className="mt-1 text-footnote text-[var(--ink-2)]">
          Ask questions in plain language and get AI-powered answers with links to matching contacts and deals.
        </p>
      </div>

      <AskForm hasDb={hasDb} hasKey={hasKey} />
    </div>
  );
}
