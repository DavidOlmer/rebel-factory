import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Agents from './pages/Agents'
import AgentDetail from './pages/AgentDetail'
import CreateAgent from './pages/CreateAgent'
import Sprints from './pages/Sprints'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agents/:id" element={<AgentDetail />} />
        <Route path="/agents/new" element={<CreateAgent />} />
        <Route path="/sprints" element={<Sprints />} />
      </Routes>
    </Layout>
  )
}
