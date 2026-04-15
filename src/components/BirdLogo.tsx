"use client";

/**
 * Bird character — matches the in-game canvas bird exactly.
 * Body #FFB300, wing #FF8F00, white eye + dark pupil, orange beak.
 */
export function BirdLogo({
  size = 32,
  flapping = false,
  className = "",
}: {
  size?: number;
  flapping?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 44 36"
      width={size}
      height={size * (36 / 44)}
      className={className}
      style={{ overflow: "visible" }}
    >
      {/* Body */}
      <ellipse
        cx="22"
        cy="18"
        rx="17"
        ry="13"
        fill="#FFB300"
        stroke="#E6A800"
        strokeWidth="1.5"
      />
      {/* Wing */}
      <ellipse
        cx="18"
        cy={flapping ? 14 : 21}
        rx="10"
        ry="6"
        fill="#FF8F00"
        transform={`rotate(-15 18 ${flapping ? 14 : 21})`}
        style={{ transition: "all 0.15s ease" }}
      />
      {/* Belly highlight */}
      <ellipse cx="20" cy="22" rx="9" ry="5" fill="#FFC847" opacity="0.6" />
      {/* Eye white */}
      <circle cx="30" cy="14" r="5" fill="#FFFFFF" />
      {/* Pupil */}
      <circle cx="31.5" cy="14" r="2.5" fill="#1A1A1A" />
      {/* Eye shine */}
      <circle cx="32.2" cy="13.3" r="0.9" fill="#FFFFFF" />
      {/* Beak */}
      <path d="M36 17 L44 19 L36 21 Z" fill="#FF5722" stroke="#D84315" strokeWidth="0.5" strokeLinejoin="round" />
    </svg>
  );
}
