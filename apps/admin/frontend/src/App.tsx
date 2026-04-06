import { BrowserRouter as Router, Routes, Route } from 'react-router'
import Navigation from './components/Navigation'
import LetterList from './components/LetterList'
import LetterView from './components/LetterView'
import PersonList from './components/PersonList'
import PersonEditor from './components/PersonEditor'
import ImageList from './components/ImageList'
import ImageEditor from './components/ImageEditor'
import PlaceList from './components/PlaceList'
import PlaceEditor from './components/PlaceEditor'

const App = () => (
  <Router>
    <div className="min-h-screen bg-parchment-light">
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<LetterList />} />
          <Route path="/letters/:id" element={<LetterView />} />
          <Route path="/personer" element={<PersonList />} />
          <Route path="/personer/:id" element={<PersonEditor />} />
          <Route path="/billeder" element={<ImageList />} />
          <Route path="/billeder/:id" element={<ImageEditor />} />
          <Route path="/steder" element={<PlaceList />} />
          <Route path="/steder/:name" element={<PlaceEditor />} />
        </Routes>
      </main>
    </div>
  </Router>
)

export default App
