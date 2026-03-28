export function StatusBanner({
  message,
  tone,
}: {
  message?: string;
  tone?: string;
}) {
  if (!message) {
    return null;
  }

  const styles =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>
      {message}
    </div>
  );
}
