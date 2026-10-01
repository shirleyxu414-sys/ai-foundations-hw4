// Large line icons for the home-page feature cards. They use currentColor, so CSS sets the blue.
const base = { width: 44, height: 44, viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export function MedalIcon() {
  return (
    <svg {...base}>
      <path d="M15 4 L22 19 M33 4 L26 19" />
      <path d="M15 4 h8 M25 4 h8" />
      <circle cx="24" cy="31" r="11.5" />
      <polygon points="24,24.5 26.2,29 31,29.6 27.5,32.9 28.4,37.6 24,35.3 19.6,37.6 20.5,32.9 17,29.6 21.8,29" fill="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

export function RulerIcon() {
  return (
    <svg {...base}>
      <g transform="rotate(-35 24 24)">
        <rect x="3" y="15" width="42" height="18" rx="3" />
        <path d="M10 15 v7 M16 15 v5 M22 15 v7 M28 15 v5 M34 15 v7 M40 15 v5" />
      </g>
    </svg>
  )
}

export function RobotIcon() {
  return (
    <svg {...base}>
      <path d="M24 14 V7" />
      <circle cx="24" cy="5.5" r="2.4" fill="currentColor" />
      <rect x="9" y="14" width="30" height="25" rx="7" />
      <path d="M4.5 23 v8 M43.5 23 v8" />
      <circle cx="18" cy="25" r="3" fill="currentColor" />
      <circle cx="30" cy="25" r="3" fill="currentColor" />
      <path d="M17.5 32.5 h13" />
    </svg>
  )
}

export function SpeechBubbleIcon() {
  return (
    <svg {...base} width={20} height={20} strokeWidth={3}>
      <path d="M8 8 h32 a4 4 0 0 1 4 4 v17 a4 4 0 0 1 -4 4 H25 l-10 8 v-8 h-7 a4 4 0 0 1 -4 -4 V12 a4 4 0 0 1 4 -4 Z" />
      <circle cx="16" cy="21" r="1.8" fill="currentColor" />
      <circle cx="24" cy="21" r="1.8" fill="currentColor" />
      <circle cx="32" cy="21" r="1.8" fill="currentColor" />
    </svg>
  )
}

export function HouseIcon() {
  return (
    <svg {...base}>
      <path d="M5 23 L24 7 L43 23" />
      <path d="M10 20 V40 H38 V20" />
      <path d="M20 40 V29 H28 V40" />
      <path d="M33 13 V8 h4 v9" />
    </svg>
  )
}

export function HockeyStickIcon() {
  return (
    <svg {...base}>
      <path d="M12 5 L27 35" />
      <path d="M27 35 Q28.5 40 34 40 H45" />
      <ellipse cx="17" cy="42" rx="5.5" ry="2.6" fill="currentColor" />
    </svg>
  )
}

export function GradCapIcon() {
  return (
    <svg {...base}>
      <path d="M24 9 L45 19 L24 29 L3 19 Z" />
      <path d="M12 24.5 V33 Q24 41 36 33 V24.5" />
      <path d="M41 21 V33" />
      <circle cx="41" cy="35.5" r="2.4" fill="currentColor" />
    </svg>
  )
}

export function FamilyIcon() {
  return (
    <svg {...base}>
      <circle cx="13" cy="12" r="5" />
      <path d="M4.5 37 V30 Q4.5 22.5 13 22.5 Q21.5 22.5 21.5 30 V37" />
      <circle cx="35" cy="12" r="5" />
      <path d="M26.5 37 V30 Q26.5 22.5 35 22.5 Q43.5 22.5 43.5 30 V37" />
      <circle cx="24" cy="27" r="3.8" />
      <path d="M17.5 43 V38.5 Q17.5 33.5 24 33.5 Q30.5 33.5 30.5 38.5 V43" />
    </svg>
  )
}

export function BuildingIcon() {
  return (
    <svg {...base}>
      <rect x="10" y="6" width="28" height="35" rx="2" />
      <path d="M17 14 h4 M27 14 h4 M17 21 h4 M27 21 h4 M17 28 h4 M27 28 h4" />
      <path d="M20 41 V34 h8 v7" />
      <path d="M5 41 h38" />
    </svg>
  )
}

export function TShirtIcon() {
  return (
    <svg {...base}>
      <path d="M17 6 L5 12 L9.5 22 L15 19.5 V41 H33 V19.5 L38.5 22 L43 12 L31 6 C30 10 27.5 12 24 12 C20.5 12 18 10 17 6 Z" />
    </svg>
  )
}

export function PawIcon() {
  return (
    <svg {...base}>
      <path d="M24 23 c-6.5 0 -11.5 5 -11.5 10.5 c0 4.2 3.2 6.5 6.4 6.5 c2 0 3.4 -1 5.1 -1 s3.1 1 5.1 1 c3.2 0 6.4 -2.3 6.4 -6.5 C35.5 28 30.5 23 24 23 Z" />
      <circle cx="10.5" cy="21" r="3.6" fill="currentColor" />
      <circle cx="18" cy="12.5" r="3.6" fill="currentColor" />
      <circle cx="30" cy="12.5" r="3.6" fill="currentColor" />
      <circle cx="37.5" cy="21" r="3.6" fill="currentColor" />
    </svg>
  )
}
