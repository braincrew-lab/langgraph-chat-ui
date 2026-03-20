/**
 * Renders a filename with middle truncation so the extension is always visible.
 * e.g. "very-long-filename-that-goes-on....pdf"
 */
export function TruncatedFileName({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const dotIndex = name.lastIndexOf(".");
  // No extension or dot at start (hidden file) — just truncate normally
  if (dotIndex <= 0) {
    return <span className={`truncate ${className ?? ""}`}>{name}</span>;
  }

  const stem = name.slice(0, dotIndex);
  const ext = name.slice(dotIndex); // includes the dot, e.g. ".pdf"

  return (
    <span className={`flex min-w-0 ${className ?? ""}`}>
      <span className="truncate">{stem}</span>
      <span className="shrink-0">{ext}</span>
    </span>
  );
}
