"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "处理中...",
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
