import { BrowserRouter as Router, Routes, Route } from 'react-router'
import Navigation from './components/Navigation'
import LetterList from './components/LetterList'
import LetterView from './components/LetterView'

const App = () => (
  <Router>
    <div className="min-h-screen bg-parchment-light">
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<LetterList />} />
          <Route path="/letters/:id" element={<LetterView />} />
        </Routes>
      </main>
    </div>
  </Router>
)

export default App
