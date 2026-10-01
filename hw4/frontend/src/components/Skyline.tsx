// Collegiate-Gothic skyline: a tall tower with a spire, pointed-arch windows and pinnacles,
// drawn in soft blues with a few gold touches so the hero stays light and airy.
export default function Skyline() {
  return (
    <svg className="skyline" viewBox="0 0 800 100" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <pattern id="arch" width="18" height="26" patternUnits="userSpaceOnUse">
          <path d="M5 22 V11 a4 4 0 0 1 8 0 V22 Z" fill="#f6efdd" opacity="0.85" />
        </pattern>
        {/* one campus block, 800 x 230 units, drawn small three times (the middle copy mirrored) */}
        <g id="campus-block">
        {/* far layer */}
        <g fill="#e3eaf4">
          <rect x="0" y="120" width="90" height="110" />
          <path d="M110 230 V95 l14 -30 l14 30 V230 Z" />
          <rect x="270" y="105" width="120" height="125" />
          <rect x="560" y="95" width="100" height="135" />
          <path d="M690 230 V88 l16 -32 l16 32 V230 Z" />
        </g>

        {/* middle layer: college halls with battlements */}
        <g fill="#c5d4e8">
          <path d="M150 230 V128 h10 v-10 h10 v10 h10 v-10 h10 v10 h10 v-10 h10 v10 h10 V230 Z" />
          <path d="M430 230 V120 h12 v-10 h12 v10 h12 v-10 h12 v10 h12 v-10 h12 v10 h12 V230 Z" />
          <path d="M600 230 V132 h10 v-10 h10 v10 h10 v-10 h10 v10 h10 V230 Z" />
        </g>
        <rect x="150" y="128" width="100" height="102" fill="url(#arch)" />
        <rect x="430" y="120" width="132" height="110" fill="url(#arch)" />

        {/* hero tower */}
        <g fill="#9db7d8">
          <rect x="318" y="48" width="64" height="182" />
          <path d="M312 48 h76 l-38 -46 Z" />
          <rect x="306" y="46" width="88" height="8" />
          <rect x="312" y="30" width="8" height="18" />
          <rect x="380" y="30" width="8" height="18" />
          <path d="M312 30 l4 -12 l4 12 Z M380 30 l4 -12 l4 12 Z" />
        </g>
        <g fill="#f6efdd">
          <path d="M340 110 V88 a10 10 0 0 1 20 0 V110 Z" />
          <path d="M340 168 V146 a10 10 0 0 1 20 0 V168 Z" />
          <path d="M344 60 V50 a6 6 0 0 1 12 0 V60 Z" />
        </g>
        <path d="M350 2 v-2" stroke="#c9a24a" strokeWidth="3" />
        <circle cx="350" cy="3" r="3.5" fill="#c9a24a" />

        {/* ground line */}
        <rect x="0" y="222" width="800" height="8" fill="#9db7d8" />
        <rect x="0" y="222" width="800" height="2" fill="#c9a24a" />
        </g>
      </defs>
      <use href="#campus-block" transform="scale(0.43)" />
      <use href="#campus-block" transform="translate(688 0) scale(-0.43 0.43)" />
      <use href="#campus-block" transform="translate(688 0) scale(0.43)" />
    </svg>
  )
}
