// Hand-drawn SVG illustrations for the landing page. Kept self-contained
// (no external image requests) so the page never depends on a third-party
// image host being up, and every illustration matches the site's palette
// exactly instead of relying on generic stock photography.

import type { ReactNode } from "react";

export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 460"
      className={className}
      role="img"
      aria-label="Illustration of a sunset over the ocean with a plane leaving a dotted flight path over distant mountains"
    >
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6D9A8" />
          <stop offset="45%" stopColor="#F0B27A" />
          <stop offset="100%" stopColor="#E8935C" />
        </linearGradient>
        <linearGradient id="hero-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2F5457" />
          <stop offset="100%" stopColor="#1F3A3D" />
        </linearGradient>
        <radialGradient id="hero-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE9C2" />
          <stop offset="100%" stopColor="#E8A94C" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="600" height="300" fill="url(#hero-sky)" />
      <circle cx="300" cy="190" r="70" fill="url(#hero-sun)" />

      {/* distant mountains */}
      <path d="M-20 260 L110 140 L200 230 L300 120 L420 250 L520 170 L640 260 Z" fill="#9C4A22" opacity="0.55" />
      <path d="M-20 280 L140 190 L260 270 L380 170 L520 280 L640 220 L640 300 L-20 300 Z" fill="#7C3A1D" opacity="0.7" />

      {/* sea */}
      <rect x="0" y="300" width="600" height="160" fill="url(#hero-sea)" />
      <path d="M0 320 Q75 310 150 320 T300 320 T450 320 T600 320" stroke="#F6D9A8" strokeOpacity="0.25" strokeWidth="3" fill="none" />
      <path d="M0 350 Q75 340 150 350 T300 350 T450 350 T600 350" stroke="#F6D9A8" strokeOpacity="0.18" strokeWidth="3" fill="none" />
      <path d="M0 380 Q75 370 150 380 T300 380 T450 380 T600 380" stroke="#F6D9A8" strokeOpacity="0.12" strokeWidth="3" fill="none" />

      {/* flight path + plane */}
      <path
        d="M70 260 C 180 120, 340 90, 470 70"
        fill="none"
        stroke="#FAF6EF"
        strokeWidth="2.5"
        strokeDasharray="1 10"
        strokeLinecap="round"
      />
      <g transform="translate(470 70) rotate(-18)">
        <path
          d="M0 0 L34 6 L14 12 L10 24 L4 22 L6 10 L-14 4 Z"
          fill="#FAF6EF"
        />
      </g>
    </svg>
  );
}

function IllustrationFrame({
  children,
  bg,
}: {
  children: ReactNode;
  bg: string;
}) {
  return (
    <svg viewBox="0 0 200 150" className="destination-art" role="presentation">
      <rect x="0" y="0" width="200" height="150" fill={bg} />
      {children}
    </svg>
  );
}

const PALM_FROND_ANGLES = [-75, -35, 0, 35, 75];

export function BeachIllustration() {
  return (
    <IllustrationFrame bg="#F0B27A">
      <circle cx="160" cy="34" r="20" fill="#FFE9C2" />
      <path d="M0 110 Q50 90 100 108 T200 100 V150 H0 Z" fill="#1F3A3D" opacity="0.85" />
      <path d="M0 128 Q50 112 100 126 T200 120 V150 H0 Z" fill="#2F5457" />

      {/* palm trunk */}
      <path
        d="M46 132 C 40 108, 36 88, 44 64 C 46 60, 50 60, 52 64 C 56 90, 52 110, 50 132 Z"
        fill="#7C3A1D"
      />

      {/* palm fronds, fanned around the top of the trunk */}
      <g transform="translate(46 62)">
        {PALM_FROND_ANGLES.map((angle) => (
          <path
            key={angle}
            d="M0 0 C -16 -22 -34 -28 -48 -24 C -30 -14 -14 -8 0 0 Z"
            fill="#355e3b"
            transform={`rotate(${angle})`}
          />
        ))}
      </g>
    </IllustrationFrame>
  );
}

export function MountainIllustration() {
  return (
    <IllustrationFrame bg="#E8935C">
      <circle cx="40" cy="32" r="16" fill="#FFE9C2" />
      <path d="M-10 130 L60 50 L100 96 L130 66 L210 130 Z" fill="#1F3A3D" opacity="0.9" />
      <path d="M60 50 L74 70 L46 70 Z" fill="#FAF6EF" opacity="0.85" />
      <path d="M130 66 L142 84 L118 84 Z" fill="#FAF6EF" opacity="0.85" />
      <path d="M-10 140 L40 100 L80 132 L120 96 L160 132 L210 108 V150 H-10 Z" fill="#2F5457" />
    </IllustrationFrame>
  );
}

export function CityIllustration() {
  return (
    <IllustrationFrame bg="#9C4A22">
      <rect x="20" y="60" width="26" height="80" fill="#1F3A3D" />
      <rect x="54" y="40" width="30" height="100" fill="#2F5457" />
      <rect x="92" y="70" width="24" height="70" fill="#1F3A3D" />
      <rect x="124" y="30" width="34" height="110" fill="#2F5457" />
      <rect x="166" y="58" width="22" height="82" fill="#1F3A3D" />
      {[62, 66, 96, 132, 128, 136, 172].map((x, i) => (
        <rect key={i} x={x} y={54 + (i % 3) * 18} width="8" height="8" fill="#FFE9C2" opacity="0.8" />
      ))}
      <path d="M124 30 L141 8 L158 30 Z" fill="#1F3A3D" />
    </IllustrationFrame>
  );
}

export function CultureIllustration() {
  return (
    <IllustrationFrame bg="#2F5457">
      <circle cx="164" cy="30" r="14" fill="#FFE9C2" opacity="0.9" />
      <path d="M100 40 L130 70 H70 Z" fill="#E8935C" />
      <rect x="76" y="70" width="48" height="12" fill="#F0B27A" />
      <rect x="86" y="82" width="8" height="46" fill="#9C4A22" />
      <rect x="106" y="82" width="8" height="46" fill="#9C4A22" />
      <rect x="60" y="128" width="80" height="10" fill="#9C4A22" />
      <circle cx="30" cy="118" r="10" fill="#E8935C" opacity="0.9" />
      <circle cx="170" cy="112" r="8" fill="#E8935C" opacity="0.7" />
    </IllustrationFrame>
  );
}

export function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4.5 4v-4H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
      <path d="M8 10h8M8 13.2h5" />
    </svg>
  );
}

export function CompassIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-2.2 5.8L9 17l2.2-5.8L15 9Z" />
    </svg>
  );
}

export function TicketIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.2a1.7 1.7 0 0 0 0 3.2v1.6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.6a1.7 1.7 0 0 0 0-3.2Z" />
      <path d="M14 6.5v11" strokeDasharray="2.2 2.4" />
    </svg>
  );
}

export function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </svg>
  );
}

export function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3Z" />
    </svg>
  );
}

export function BoltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 3 5 13.5h5.5L11 21l8-10.5h-5.5L13 3Z" />
    </svg>
  );
}

export function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M21 12.5c0 .6-.4 1-1 1h-5.6l-3 6.5-1.6-.5 1.5-6h-4l-2 2.6-1.3-.4 1-3.7-1-3.7 1.3-.4 2 2.6h4l-1.5-6 1.6-.5 3 6.5H20c.6 0 1 .4 1 1Z" />
    </svg>
  );
}
