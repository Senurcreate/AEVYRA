import { ArrowUpRight, ImageOff } from 'lucide-react'
import { earthStories } from '../data/earthStories'
import { ObservationImage } from './explorer/EarthFrame'

export default function EarthStories({ currentStory }) {
  const id = currentStory ? 'related-stories' : 'earth-stories'
  const stories = earthStories.filter(story => story !== currentStory)
  return <section id={id} className={'shell comparison section-space' + (currentStory ? ' related-stories' : '')} aria-labelledby={id + '-title'}>
    <div className="section-heading compare-heading">
      <div><h2 id={id + '-title'}>{currentStory ? 'Explore Another Earth Story' : 'Choose an Earth Story'}</h2></div>
    </div>
    <ul className="process">
      {stories.map(({ path, title, headline, subtitle, cover }) => {
        const titleId = path.slice(1) + '-title'
        return <li key={path}>
          <a className="angular-glass process-card group block h-full" href={path} aria-labelledby={titleId + '-dataset ' + titleId} aria-describedby={titleId + '-description'}>
            <div className="aspect-video overflow-hidden">
              {cover ? <ObservationImage image={cover} className="h-full w-full object-cover" /> : <div className="frame-empty">
                <ImageOff size={24} aria-hidden="true" /><span>Preview unavailable</span>
              </div>}
            </div>
            <div className="mt-3 flex items-start justify-between gap-2">
              <div>
                <span id={titleId + '-dataset'} className="instrument-label">{title}</span>
                <h3 id={titleId} className="group-hover:text-[var(--ice)]">{headline}</h3>
              </div>
              <ArrowUpRight className="shrink-0 text-[var(--ice)]" size={16} aria-hidden="true" />
            </div>
            <p id={titleId + '-description'}>{subtitle}</p>
          </a>
        </li>
      })}
    </ul>
  </section>
}
