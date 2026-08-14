import { useState } from 'react'
import { Home, Camera, MessageSquare } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Analyze from './pages/Analyze'
import Coach from './pages/Coach'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('home')
  
  // Mock Gamification State
  const [userLevel, setUserLevel] = useState(2)
  const [userProgress, setUserProgress] = useState(65)
  const [analyzedSpaces, setAnalyzedSpaces] = useState(3)

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Dashboard level={userLevel} progress={userProgress} spaces={analyzedSpaces} />
      case 'analyze':
        return <Analyze onAnalyzeComplete={() => {
          setAnalyzedSpaces(prev => prev + 1)
          setUserProgress(prev => Math.min(prev + 15, 100))
          if (userProgress + 15 >= 100) {
            setUserLevel(prev => prev + 1)
            setUserProgress(0)
          }
        }} />
      case 'coach':
        return <Coach />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="app-container">
      <div className="content-area">
        {renderContent()}
      </div>
      
      <nav className="bottom-nav">
        <button 
          className={`btn nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <Home size={24} />
          <span>Inicio</span>
        </button>
        <button 
          className={`btn nav-item ${activeTab === 'analyze' ? 'active' : ''}`}
          onClick={() => setActiveTab('analyze')}
        >
          <Camera size={24} />
          <span>Analizar</span>
        </button>
        <button 
          className={`btn nav-item ${activeTab === 'coach' ? 'active' : ''}`}
          onClick={() => setActiveTab('coach')}
        >
          <MessageSquare size={24} />
          <span>Coach</span>
        </button>
      </nav>
    </div>
  )
}

export default App
