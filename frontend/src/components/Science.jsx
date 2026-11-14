import { ArrowUpRight, AudioLines, Plus, RadioTower, ScanLine } from 'lucide-react'
import { project } from '../data/project'

const stages = [
  [RadioTower, 'We Observe Earth', 'Satellites collect information about our changing planet.'],
  [ScanLine, 'We Interpret the Data', 'Scientific measurements help us understand changes across years and regions.'],
  [AudioLines, 'We Turn Data Into Sound', 'Measurements are translated into sound, allowing us to hear patterns and changes.'],
]

function FAQ({ dataset }) {
  const questions = [
    ['What am I listening to?', 'You hear sonification. It turns numerical values into audible differences.'],
    ['Are these actual sounds recorded from Earth?', 'The sounds are generated from numerical values. In the demo, those values are synthetic.'],
    ['Where does the scientific data come from?', dataset?.demo ? 'The demo uses synthetic values. Its Earth imagery comes from NASA’s Blue Marble collections.' :
      dataset?.source ? 'See the dataset attribution in the credits below.' : 'The team’s dataset attribution is pending.'],
    ['Why does the sound change over time?', dataset?.methodology || 'The final sonification mapping will describe how the sound changes with the measurements.'],
    ['How are the regions selected?', 'Use the region list or choose a marker on the globe. The project dataset defines the available regions.'],
    ['What does the baseline sound represent?', dataset?.baselineDescription || 'The project’s baseline definition is pending.'],
    ['Can I explore different years?', 'Select any year from 2012 to 2023. The explorer indicates where a measurement, sound, or image is unavailable.'],
  ]

  return <div className="faq">
    <h3>Frequently asked questions</h3>
    <div className="faq-list">{questions.map(([question, answer]) =>
      <details key={question}><summary>{question}<Plus size={17} aria-hidden="true" /></summary><p>{answer}</p></details>,
    )}</div>
  </div>
}

export default function Science({ dataset }) {
  return <section id="science" className="shell science section-space" aria-labelledby="science-title">
    <div className="section-heading science-heading">
      <h2 id="science-title">The Science<br />Behind the Sound</h2>
    </div>
    <ol className="process" aria-label="From Earth observations to sound">
      {stages.map(([Icon, label, description], index) => <li key={label} className="angular-glass process-card">
        <div className="process-step" aria-hidden="true">
          <span className="instrument-label">0{index + 1}</span>
          <Icon size={21} strokeWidth={1.45} />
        </div>
        <h3>{label}</h3>
        <p>{description}</p>
      </li>)}
    </ol>
    <div className="science-details">
      <div className="credits">
        <h3>Credits</h3>
        <p>Created by the {project.team} for the NASA Space Apps Challenge.</p>
        <p>Hero photograph by Abhishek Mishra via Unsplash. The global demo frames use an Earth portrait by Reto Stöckli and Robert Simmon. Globe texture and regional views come from NASA Earth Observatory’s Blue Marble Next Generation.</p>
        <a href={project.earthPortraitUrl}>Blue Marble portrait <ArrowUpRight size={14} aria-hidden="true" /></a>
        <a href={project.earthMapUrl}>Blue Marble map <ArrowUpRight size={14} aria-hidden="true" /></a>
        {dataset?.source && <a href={dataset.source.url}>{dataset.source.label} <ArrowUpRight size={14} aria-hidden="true" /></a>}
      </div>
      <FAQ dataset={dataset} />
    </div>
  </section>
}
