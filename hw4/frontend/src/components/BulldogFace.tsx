// Friendly bulldog mascot face: floppy blue ears, wrinkled brow, underbite and a gold collar tag.
export default function BulldogFace({ size = 36 }: { size?: number }) {
  return (
    <svg className="bulldog" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Bulldog Bot mascot">
      <path d="M9 13 Q1 30 14 38 Q19 25 17 11 Z" fill="#00356b" />
      <path d="M55 13 Q63 30 50 38 Q45 25 47 11 Z" fill="#00356b" />
      <ellipse cx="32" cy="34" rx="21" ry="20" fill="#fdfbf6" stroke="#00356b" strokeWidth="2.5" />
      <path d="M22 20 q4 -3 8 0 M34 20 q4 -3 8 0" stroke="#00356b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="28" r="3.2" fill="#00356b" />
      <circle cx="40" cy="28" r="3.2" fill="#00356b" />
      <circle cx="25" cy="27" r="1.1" fill="#fff" />
      <circle cx="41" cy="27" r="1.1" fill="#fff" />
      <ellipse cx="32" cy="41" rx="13" ry="9.5" fill="#f0e6cc" stroke="#00356b" strokeWidth="2" />
      <ellipse cx="32" cy="36" rx="5.5" ry="3.6" fill="#00356b" />
      <path d="M32 39.5 v3.5 M23.5 42 q4.2 6.5 8.5 1 q4.3 5.5 8.5 -1" stroke="#00356b" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M26 46 l1.7 -4.2 l1.7 4.2 Z M34.6 46 l1.7 -4.2 l1.7 4.2 Z" fill="#fff" stroke="#00356b" strokeWidth="1" strokeLinejoin="round" />
      <path d="M15 54 Q32 63 49 54" stroke="#c9a24a" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="59" r="2.6" fill="#c9a24a" stroke="#7f5f14" strokeWidth="0.8" />
    </svg>
  )
}
