import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { nightLights } from './data/earthStories'
import './styles/global.css'

const legacySections = ['#experience', '#compare']
const { pathname, search, hash } = window.location

if (pathname === '/' && legacySections.includes(hash)) {
  window.location.replace(nightLights.path + search + hash)
} else if (pathname !== '/' && hash === '#science') {
  window.location.replace('/' + search + hash)
} else {
  createRoot(document.getElementById('root')).render(<App />)
}
