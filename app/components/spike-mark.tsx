// Anthropic radial spike-mark — a small asterisk-like glyph used as the
// brand wordmark prefix and as an inline content marker. Rendered as inline
// SVG so it inherits `currentColor`.
export function SpikeMark({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={`spike-mark ${className}`}
    >
      {/* Four tapered spokes radiating from center. */}
      <path d="M12 1.5 L13.6 9.5 Q12 11 10.4 9.5 Z" />
      <path d="M12 22.5 L10.4 14.5 Q12 13 13.6 14.5 Z" />
      <path d="M1.5 12 L9.5 10.4 Q11 12 9.5 13.6 Z" />
      <path d="M22.5 12 L14.5 13.6 Q13 12 14.5 10.4 Z" />
      {/* Four shorter diagonal spokes for the 8-point burst. */}
      <path d="M4.6 4.6 L9.9 8.5 Q9 9 8.5 9.9 Z" />
      <path d="M19.4 19.4 L14.1 15.5 Q15 15 15.5 14.1 Z" />
      <path d="M19.4 4.6 L15.5 9.9 Q15 9 14.1 8.5 Z" />
      <path d="M4.6 19.4 L8.5 14.1 Q9 15 9.9 15.5 Z" />
    </svg>
  );
}
