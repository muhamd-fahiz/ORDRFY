// One small line-icon per vertical. Purely decorative/presentational -- these are not the
// source of truth for which verticals exist (that's the `verticals` table); this is a
// display-layer lookup only, keyed the same way (fashion|tutor|service|baker|gift).

type IconProps = { className?: string };

const shared = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function FashionIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <path d="M6 3l3 4-1 3 4 11 4-11-1-3 3-4" />
    </svg>
  );
}

export function TutorIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export function ServiceIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function BakerIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <path d="M4 21v-6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6" />
      <path d="M4 21h16M12 3v4M9 7c0-1.5 1.5-2 3-2s3 .5 3 2" />
    </svg>
  );
}

export function GiftIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <rect x="3" y="8" width="18" height="13" rx="1" />
      <path d="M12 8v13M3 8l4-5h10l4 5M7.5 3a2 2 0 1 0 4.5 5M16.5 3a2 2 0 1 1-4.5 5" />
    </svg>
  );
}
