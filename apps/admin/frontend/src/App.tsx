import { BrowserRouter as Router, Routes, Route } from 'react-router'
import Navigation from './components/Navigation'
import LetterList from './components/LetterList'
import LetterView from './components/LetterView'
import ModernizationDashboard from './components/ModernizationDashboard'

const App = () => (
  <Router>
    <div className="min-h-screen bg-parchment-light">
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<LetterList />} />
          <Route path="/letters/:id" element={<LetterView />} />
          <Route path="/modernisering" element={<ModernizationDashboard />} />
        </Routes>
      </main>
    </div>
  </Router>
)

export default App
