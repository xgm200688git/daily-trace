"use client";

import { useState, useTransition } from "react";

interface CopyButtonProps {
  value: string;
}

export function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-black/20 hover:text-black"
      onClick={() =>
        startTransition(async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        })
      }
    >
      {isPending ? "复制中..." : copied ? "已复制" : "复制内容"}
    </button>
  );
}
