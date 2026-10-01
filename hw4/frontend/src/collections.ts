export type CollectionKey = 'colleges' | 'sports' | 'schools' | 'family' | 'warm'

export interface CollectionInfo {
  key: CollectionKey
  title: string
  blurb: string
  number: string
}

export const COLLECTIONS: CollectionInfo[] = [
  { key: 'colleges', number: '01', title: 'Residential Colleges', blurb: 'Rep your college crest, from Berkeley to Trumbull, on crews, quarter-zips and fleeces for the walk across Old Campus.' },
  { key: 'sports', number: '02', title: 'Varsity Sports', blurb: 'Cheer on hockey, sailing, fencing, squash and more in team-lettered layers, from the stands at Ingalls Rink.' },
  { key: 'schools', number: '03', title: 'Graduate Schools', blurb: 'You earned the degree. Now wear it at commencement: Law, Medicine, Art, Nursing and beyond.' },
  { key: 'family', number: '04', title: 'Yale Family', blurb: 'For the proud mom, dad, grandpa or cousin in the stands at the Yale Bowl.' },
]

export const WARM_LAYERS: CollectionInfo = {
  key: 'warm',
  number: '',
  title: 'Warm layers',
  blurb: 'Hoodies and full-zip fleece jackets built for long afternoons at the Bowl.',
}

const ALL = [...COLLECTIONS, WARM_LAYERS]

export function findCollection(key: string | null): CollectionInfo | null {
  return ALL.find((c) => c.key === key) ?? null
}
