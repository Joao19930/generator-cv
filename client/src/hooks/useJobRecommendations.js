import { useState, useEffect, useCallback, useRef } from 'react'
import { useResumeStore } from './useResumeStore'

const MOCK_JOBS = [
  { id: 'j1', role: 'Analyst — M&A Advisory', company: 'McKinsey & Company', location: 'Lisboa', type: 'Full-time', salary: '45.000–65.000 €', source: 'LinkedIn', logo: 'MC', logoColor: '#1B3D6F', logoText: '#fff', daysAgo: 2, requiredSkills: ['Excel', 'PowerPoint', 'Financial Modeling', 'Valuation', 'DCF'] },
  { id: 'j2', role: 'Audit Associate', company: 'Deloitte Portugal', location: 'Lisboa', type: 'Full-time', salary: '30.000–40.000 €', source: 'Indeed', logo: 'D', logoColor: '#86BC25', logoText: '#fff', daysAgo: 1, requiredSkills: ['IFRS', 'Excel', 'Audit', 'Risk Assessment', 'Big Four'] },
  { id: 'j3', role: 'Investment Banking Analyst', company: 'Goldman Sachs', location: 'Remoto', type: 'Full-time', salary: '80.000–120.000 €', source: 'Glassdoor', logo: 'GS', logoColor: '#1D4B78', logoText: '#fff', daysAgo: 3, requiredSkills: ['DCF', 'LBO', 'M&A', 'Capital Markets', 'Bloomberg'] },
  { id: 'j4', role: 'Tax Consultant', company: 'KPMG Portugal', location: 'Porto', type: 'Full-time', salary: '28.000–38.000 €', source: 'InfoJobs', logo: 'KP', logoColor: '#00338D', logoText: '#fff', daysAgo: 5, requiredSkills: ['IRC', 'IVA', 'Tax Compliance', 'Excel', 'Big Four'] },
  { id: 'j5', role: 'Strategy Consultant', company: 'BCG', location: 'Lisboa', type: 'Full-time', salary: '60.000–90.000 €', source: 'LinkedIn', logo: 'BCG', logoColor: '#009B77', logoText: '#fff', daysAgo: 4, requiredSkills: ['Strategy', 'PowerPoint', 'Data Analysis', 'MBB', 'Python'] },
  { id: 'j6', role: 'Risk Analyst', company: 'JPMorgan Chase', location: 'Remoto', type: 'Full-time', salary: '55.000–80.000 €', source: 'EURES', logo: 'JP', logoColor: '#003087', logoText: '#fff', daysAgo: 6, requiredSkills: ['Risk Management', 'VaR', 'Basel III', 'Python', 'SQL'] },
  { id: 'j7', role: 'Advisory Consultant', company: 'PwC Portugal', location: 'Lisboa', type: 'Full-time', salary: '32.000–45.000 €', source: 'Glassdoor', logo: 'PwC', logoColor: '#D04A02', logoText: '#fff', daysAgo: 2, requiredSkills: ['Consulting', 'Excel', 'Project Management', 'Big Four', 'Communication'] },
  { id: 'j8', role: 'Corporate Finance Associate', company: 'Bain & Company', location: 'Lisboa', type: 'Full-time', salary: '65.000–95.000 €', source: 'LinkedIn', logo: 'BC', logoColor: '#CC0000', logoText: '#fff', daysAgo: 7, requiredSkills: ['Financial Modeling', 'PE', 'Due Diligence', 'MBB', 'Excel'] },
]

const SOURCES = ['LinkedIn', 'Indeed', 'Glassdoor', 'InfoJobs', 'EURES']
const SOURCE_COLORS = { LinkedIn: '#0077B5', Indeed: '#003A9B', Glassdoor: '#0CAA41', InfoJobs: '#FF6600', EURES: '#1B3D6F' }
const FILTERS = ['Todos', 'Lisboa', 'Remoto', 'Big Four', 'Banca', 'Recentes']

function calcMatch(job, userSkills) {
  if (!userSkills.length) return 0
  const flat = userSkills.flatMap(s => s.items || []).map(s => s.toLowerCase())
  const matched = job.requiredSkills.filter(s => flat.some(u => u.includes(s.toLowerCase()) || s.toLowerCase().includes(u)))
  return Math.round((matched.length / job.requiredSkills.length) * 100)
}

export function useJobRecommendations(isPremium) {
  const title = useResumeStore(s => s.personalInfo.title)
  const skills = useResumeStore(s => s.skills)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeSources, setActiveSources] = useState(new Set(SOURCES))
  const [activeFilter, setActiveFilter] = useState('Todos')
  const [savedJobs, setSavedJobs] = useState(new Set())
  const timer = useRef(null)

  useEffect(() => {
    if (!isPremium || title.length <= 2) return
    clearTimeout(timer.current)
    setLoading(true)
    timer.current = setTimeout(() => {
      const withScores = MOCK_JOBS.map(j => ({ ...j, matchScore: calcMatch(j, skills) }))
        .sort((a, b) => b.matchScore - a.matchScore)
      setJobs(withScores)
      setLoading(false)
    }, 800)
    return () => clearTimeout(timer.current)
  }, [title, skills, isPremium])

  const toggleSource = useCallback((source) => {
    setActiveSources(prev => {
      const n = new Set(prev)
      n.has(source) ? n.delete(source) : n.add(source)
      return n
    })
  }, [])

  const toggleSave = useCallback((jobId) => {
    setSavedJobs(prev => {
      const n = new Set(prev)
      n.has(jobId) ? n.delete(jobId) : n.add(jobId)
      return n
    })
  }, [])

  const filteredJobs = jobs.filter(j => {
    if (!activeSources.has(j.source)) return false
    if (activeFilter === 'Todos') return true
    if (activeFilter === 'Lisboa') return j.location === 'Lisboa'
    if (activeFilter === 'Remoto') return j.location === 'Remoto'
    if (activeFilter === 'Big Four') return ['Deloitte Portugal', 'KPMG Portugal', 'PwC Portugal', 'EY'].includes(j.company)
    if (activeFilter === 'Banca') return ['Goldman Sachs', 'JPMorgan Chase', 'Morgan Stanley'].includes(j.company)
    if (activeFilter === 'Recentes') return j.daysAgo <= 3
    return true
  })

  return { jobs: filteredJobs, loading, activeSources, activeFilter, savedJobs, toggleSource, toggleSave, setActiveFilter, SOURCE_COLORS, SOURCES, FILTERS }
}
