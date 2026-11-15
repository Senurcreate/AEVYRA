import { ArrowUpRight, AudioLines, Plus, RadioTower, ScanLine } from 'lucide-react'
import { project } from '../data/project'
import { earthStories } from '../data/earthStories'

const stages = [
  [RadioTower, 'We Observe Earth', 'NASA Earth visualizations reveal patterns across our changing planet.'],
  [ScanLine, 'We Interpret the Data', 'Machine learning groups pixels by brightness or color to extract features from the Night Lights and Aerosols images.'],
  [AudioLines, 'We Turn Data Into Sound', 'Sonification maps numbers to musical parameters such as pitch. The Night Lights demo lets you hear this using a sample index.'],
]

const questions = [
  ['What is Aevyra?', 'Aevyra is an interactive project that explores changes on Earth through NASA imagery, image analysis, and sound.'],
  ['How does Aevyra turn data into sound?', 'Sonification assigns numerical values to properties of a sound, such as pitch. You can hear this in the Night Lights demo.'],
  ['Are these sounds recorded by NASA?', 'Aevyra generates the demo tones in your browser from an illustrative index. The annual Night Lights images and their pixel statistics have separate sources.'],
  ['Which Earth datasets are included?', 'Night Lights has annual global maps. GEOS Aerosols has selected frames from a model visualization. DYAMOND Global Carbon Dioxide currently has a NASA preview and its original color scale.'],
  ['What do the colors represent?', 'Each story explains its own colors below the playback controls. They show nighttime illumination, aerosol groups, or modeled carbon dioxide in the NASA DYAMOND preview.'],
  ['Where does the scientific information come from?', 'The credits link to NASA’s Scientific Visualization Studio. The Night Lights and Aerosols figures summarize pixels in the project’s analyzed images.'],
]

function FAQ() {
  return <div className="faq">
    <h3>Frequently asked questions</h3>
    <div className="faq-list">{questions.map(([question, answer]) =>
      <details key={question}><summary>{question}<Plus size={17} aria-hidden="true" /></summary><p>{answer}</p></details>,
    )}</div>
  </div>
}

export default function Science() {
  return <>
    <section id="science" className="shell science section-space" aria-labelledby="science-title">
      <div className="section-heading science-heading">
        <h2 id="science-title">The Science<br />Behind the Sound</h2>
      </div>
      <ol className="process" aria-label="From Earth observations to sound">
        {stages.map(([Icon, label, description], index) => <li key={label}>
          <div className="angular-glass process-card h-full">
            <div className="process-step" aria-hidden="true">
              <span className="instrument-label">0{index + 1}</span>
              <Icon size={21} strokeWidth={1.45} />
            </div>
            <h3>{label}</h3>
            <p>{description}</p>
          </div>
        </li>)}
      </ol>
    </section>
    <div className="shell section-space">
      <div className="science-details">
        <div className="credits">
          <h3>Credits</h3>
          <p>Created by the {project.team} for the NASA Space Apps Challenge.</p>
          <p>Hero photograph by Abhishek Mishra via Unsplash. NASA Earth Observatory’s Blue Marble Next Generation provides the globe texture.</p>
          <a href={project.earthMapUrl}>Blue Marble map <ArrowUpRight size={14} aria-hidden="true" /></a>
          {earthStories.map(({ path, source }) => <a key={path} href={source.url}>{source.label} <ArrowUpRight size={14} aria-hidden="true" /></a>)}
        </div>
        <FAQ />
      </div>
    </div>
  </>
}
