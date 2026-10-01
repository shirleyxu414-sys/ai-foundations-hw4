import { Link } from 'react-router-dom'
import Skyline from '../components/Skyline'
import { OPEN_CHAT_EVENT } from '../chatEvents'
import { SpeechBubbleIcon, FamilyIcon, GradCapIcon, HockeyStickIcon, HouseIcon, MedalIcon, RobotIcon, RulerIcon } from '../components/PerkIcons'
import { COLLECTIONS } from '../collections'

const COLLECTION_ICONS = {
  colleges: <HouseIcon />,
  sports: <HockeyStickIcon />,
  schools: <GradCapIcon />,
  family: <FamilyIcon />,
} as const

const PERKS = [
  { title: 'XS through XXL', text: 'Each style comes in six sizes, so the whole crew can match.', icon: <RulerIcon />, tone: 'navy' },
  { title: 'Officially licensed', text: 'Every piece is authorized Yale merchandise, not a knock-off.', icon: <MedalIcon />, tone: 'featured' },
  { title: 'Straight from the stockroom', text: 'Our chatbot checks real prices and live stock before it answers.', icon: <RobotIcon />, tone: 'gold' },
]

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Officially licensed · Made for Elis</p>
          <h1>
            <span className="hero-line">Wear your corner</span>
            <span className="hero-line">
              of <span className="accent">Yale</span>
            </span>
          </h1>
          <p className="lede">
            Your residential college crest, your varsity team, the grad school that finally let you
            graduate: Campus Customs has gear for all of it. Browse the racks, or ask our chatbot
            what's in stock in your size.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-primary">Browse the catalogue</Link>
            <button
              type="button"
              className="btn btn-ghost"
              title="Chat with Bulldog Bot"
              onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))}
            >
              <SpeechBubbleIcon />
              Ask Bulldog Bot
            </button>
          </div>
        </div>
        <Skyline />
        <Link to="/products/champion-reverse-weave-hoodie-1" className="hero-product" aria-label="Featured: Champion Reverse Weave Hoodie">
          <img src="/media/products/champion-reverse-weave-hoodie-1.jpg" alt="Navy Champion Reverse Weave Yale hoodie" width={340} height={340} />
        </Link>
      </section>

      <section className="section">
        <h2 className="section-title">Find your people</h2>
        <div className="collection-grid">
          {COLLECTIONS.map((c) => (
            <Link to={`/products?collection=${c.key}`} key={c.key} className="collection-card">
              <span className="card-num" aria-hidden="true">{c.number}</span>
              <span className="card-icon">{COLLECTION_ICONS[c.key as keyof typeof COLLECTION_ICONS]}</span>
              <h3>{c.title}</h3>
              <p>{c.blurb}</p>
              <span className="card-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="promo-band">
          <div>
            <p className="eyebrow">Game day forecast: chilly</p>
            <h2>Layer up before kickoff</h2>
            <p className="lede">Heavyweight hoodies and full-zip fleeces built for long afternoons at the Bowl.</p>
          </div>
          <Link to="/products?collection=warm" className="btn btn-primary">Shop warm layers</Link>
        </div>
      </section>

      <section className="section">
        <div className="perk-grid">
          {PERKS.map((p) => (
            <div key={p.title} className={`perk perk-${p.tone}`}>
              <span className="perk-icon">{p.icon}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
