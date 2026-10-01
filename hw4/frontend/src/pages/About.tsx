import { BuildingIcon, GradCapIcon, PawIcon, TShirtIcon } from '../components/PerkIcons'
import { OPEN_CHAT_EVENT } from '../chatEvents'

const CARDS = [
  {
    title: 'Who we are',
    text: 'Campus Customs is an online shop for officially licensed Yale apparel. We make the clothes people actually wear to class, to practice and to reunions.',
    icon: <BuildingIcon />,
  },
  {
    title: 'Who we dress',
    text: 'Students repping their residential college, athletes and their fans, grad students and alumni, and the families who travel to cheer them on.',
    icon: <GradCapIcon />,
  },
  {
    title: 'What’s on the racks',
    text: 'Tees, crewnecks, hoodies, quarter-zips and fleece jackets, each in sizes XS to XXL, with college crests, team marks and school wordmarks.',
    icon: <TShirtIcon />,
  },
]

const BANNER = {
  title: 'A chatbot that checks first',
  text: 'Ask our shopping assistant about a style, a color or your size. It looks up price and stock in our store database before answering, so you get facts, not guesses.',
}

export default function About() {
  return (
    <section className="section about-section">
      <p className="eyebrow">Our story</p>
      <h1>About Us</h1>
      <p className="lede">
        We think school spirit should be easy to find and comfortable to wear. That's the whole idea
        behind Campus Customs.
      </p>
      <div className="about-row">
        {CARDS.map((c) => (
          <div key={c.title} className="panel about-card">
            <span className="card-icon">{c.icon}</span>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
          </div>
        ))}
      </div>
      <div className="about-banner">
        <span className="banner-icon">
          <PawIcon />
        </span>
        <div>
          <h3>{BANNER.title}</h3>
          <p>{BANNER.text}</p>
        </div>
      </div>
      <p className="about-footnote">
        Questions about an order?{' '}
        <button type="button" className="btn btn-gold" onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))}>
          Start a chat with our assistant
        </button>{' '}
        and it'll point you in the right direction. 💙
      </p>
    </section>
  )
}
