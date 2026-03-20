import { create } from 'zustand'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export interface PersonalInfo {
  fullName: string
  jobTitle: string
  email: string
  phone: string
  address: string
  linkedin: string
  website: string
  nationality: string
  birthDate: string
  photo: string | null
  showNationality: boolean
  showBirthDate: boolean
}

export interface Experience {
  id: string
  company: string
  role: string
  location: string
  startDate: string
  endDate: string
  current: boolean
  description: string
}

export interface Education {
  id: string
  institution: string
  degree: string
  field: string
  startDate: string
  endDate: string
  description: string
}

export type SkillLevel = 'Básico' | 'Intermédio' | 'Avançado' | 'Expert'

export interface Skill {
  id: string
  name: string
  level: SkillLevel
}

export interface Language {
  id: string
  name: string
  level: string
}

export interface Certification {
  id: string
  name: string
  issuer: string
  date: string
  url: string
}

export interface CustomSection {
  id: string
  title: string
  content: string
}

export type TemplateType = 'executive' | 'modern' | 'classic' | 'creative'
export type LineSpacingType = 'compact' | 'normal' | 'spacious'

interface DataSnapshot {
  personal: PersonalInfo
  summary: string
  experience: Experience[]
  education: Education[]
  skills: Skill[]
  languages: Language[]
  certifications: Certification[]
  customSections: CustomSection[]
  sectionOrder: string[]
  template: TemplateType
  primaryColor: string
  fontFamily: string
  fontSize: number
  lineSpacing: LineSpacingType
}

export interface CVState extends DataSnapshot {
  id: string | null
  title: string
  zoom: number
  past: DataSnapshot[]
  future: DataSnapshot[]

  setTitle: (t: string) => void
  setPersonal: (p: Partial<PersonalInfo>) => void
  setSummary: (s: string) => void
  addExperience: () => void
  updateExperience: (id: string, data: Partial<Experience>) => void
  removeExperience: (id: string) => void
  addEducation: () => void
  updateEducation: (id: string, data: Partial<Education>) => void
  removeEducation: (id: string) => void
  addSkill: (name: string, level?: string) => void
  updateSkill: (id: string, data: Partial<Skill>) => void
  removeSkill: (id: string) => void
  addLanguage: () => void
  updateLanguage: (id: string, data: Partial<Language>) => void
  removeLanguage: (id: string) => void
  addCertification: () => void
  updateCertification: (id: string, data: Partial<Certification>) => void
  removeCertification: (id: string) => void
  addCustomSection: () => void
  updateCustomSection: (id: string, data: Partial<CustomSection>) => void
  removeCustomSection: (id: string) => void
  setSectionOrder: (order: string[]) => void
  setTemplate: (t: TemplateType) => void
  setPrimaryColor: (c: string) => void
  setFontFamily: (f: string) => void
  setFontSize: (s: number) => void
  setLineSpacing: (s: LineSpacingType) => void
  setZoom: (z: number) => void
  undo: () => void
  redo: () => void
  loadFromStorage: () => void
  loadFromData: (data: any) => void
}

const DEFAULT_PERSONAL: PersonalInfo = {
  fullName: '',
  jobTitle: '',
  email: '',
  phone: '',
  address: '',
  linkedin: '',
  website: '',
  nationality: '',
  birthDate: '',
  photo: null,
  showNationality: false,
  showBirthDate: false,
}

const DEFAULT_SECTION_ORDER = [
  'personal',
  'summary',
  'experience',
  'education',
  'skills',
  'languages',
  'certifications',
]

function getSnapshot(state: CVState): DataSnapshot {
  return {
    personal: { ...state.personal },
    summary: state.summary,
    experience: state.experience.map(e => ({ ...e })),
    education: state.education.map(e => ({ ...e })),
    skills: state.skills.map(s => ({ ...s })),
    languages: state.languages.map(l => ({ ...l })),
    certifications: state.certifications.map(c => ({ ...c })),
    customSections: state.customSections.map(s => ({ ...s })),
    sectionOrder: [...state.sectionOrder],
    template: state.template,
    primaryColor: state.primaryColor,
    fontFamily: state.fontFamily,
    fontSize: state.fontSize,
    lineSpacing: state.lineSpacing,
  }
}

const MAX_HISTORY = 30
const STORAGE_KEY = 'cv_editor_data'

export const useCVStore = create<CVState>((set, get) => {
  function pushHistory(prevSnapshot: DataSnapshot) {
    set(s => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), prevSnapshot],
      future: [],
    }))
  }

  function withHistory<T extends Partial<DataSnapshot>>(updater: (s: CVState) => T) {
    const prev = getSnapshot(get())
    set(s => ({ ...updater(s), past: [...s.past.slice(-(MAX_HISTORY - 1)), prev], future: [] }))
    saveToStorage()
  }

  function saveToStorage() {
    const s = get()
    const data: DataSnapshot & { id: string | null; title: string } = {
      id: s.id,
      title: s.title,
      personal: s.personal,
      summary: s.summary,
      experience: s.experience,
      education: s.education,
      skills: s.skills,
      languages: s.languages,
      certifications: s.certifications,
      customSections: s.customSections,
      sectionOrder: s.sectionOrder,
      template: s.template,
      primaryColor: s.primaryColor,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      lineSpacing: s.lineSpacing,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {}
  }

  return {
    id: null,
    title: 'O meu CV',
    personal: { ...DEFAULT_PERSONAL },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    customSections: [],
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    template: 'executive',
    primaryColor: '#1a2e4a',
    fontFamily: 'Inter',
    fontSize: 11,
    lineSpacing: 'normal',
    zoom: 0.85,
    past: [],
    future: [],

    setTitle: (t) => { set({ title: t }); saveToStorage() },

    setPersonal: (p) => withHistory(s => ({ personal: { ...s.personal, ...p } })),

    setSummary: (summary) => withHistory(() => ({ summary })),

    addExperience: () => withHistory(s => ({
      experience: [...s.experience, {
        id: uid(), company: '', role: '', location: '',
        startDate: '', endDate: '', current: false, description: ''
      }]
    })),

    updateExperience: (id, data) => withHistory(s => ({
      experience: s.experience.map(e => e.id === id ? { ...e, ...data } : e)
    })),

    removeExperience: (id) => withHistory(s => ({
      experience: s.experience.filter(e => e.id !== id)
    })),

    addEducation: () => withHistory(s => ({
      education: [...s.education, {
        id: uid(), institution: '', degree: '', field: '',
        startDate: '', endDate: '', description: ''
      }]
    })),

    updateEducation: (id, data) => withHistory(s => ({
      education: s.education.map(e => e.id === id ? { ...e, ...data } : e)
    })),

    removeEducation: (id) => withHistory(s => ({
      education: s.education.filter(e => e.id !== id)
    })),

    addSkill: (name, level = 'Intermédio') => withHistory(s => ({
      skills: [...s.skills, { id: uid(), name, level: level as SkillLevel }]
    })),

    updateSkill: (id, data) => withHistory(s => ({
      skills: s.skills.map(sk => sk.id === id ? { ...sk, ...data } : sk)
    })),

    removeSkill: (id) => withHistory(s => ({
      skills: s.skills.filter(sk => sk.id !== id)
    })),

    addLanguage: () => withHistory(s => ({
      languages: [...s.languages, { id: uid(), name: '', level: 'B2' }]
    })),

    updateLanguage: (id, data) => withHistory(s => ({
      languages: s.languages.map(l => l.id === id ? { ...l, ...data } : l)
    })),

    removeLanguage: (id) => withHistory(s => ({
      languages: s.languages.filter(l => l.id !== id)
    })),

    addCertification: () => withHistory(s => ({
      certifications: [...s.certifications, {
        id: uid(), name: '', issuer: '', date: '', url: ''
      }]
    })),

    updateCertification: (id, data) => withHistory(s => ({
      certifications: s.certifications.map(c => c.id === id ? { ...c, ...data } : c)
    })),

    removeCertification: (id) => withHistory(s => ({
      certifications: s.certifications.filter(c => c.id !== id)
    })),

    addCustomSection: () => withHistory(s => ({
      customSections: [...s.customSections, { id: uid(), title: 'Nova Secção', content: '' }],
      sectionOrder: [...s.sectionOrder, `custom_${uid()}`],
    })),

    updateCustomSection: (id, data) => withHistory(s => ({
      customSections: s.customSections.map(cs => cs.id === id ? { ...cs, ...data } : cs)
    })),

    removeCustomSection: (id) => withHistory(s => ({
      customSections: s.customSections.filter(cs => cs.id !== id),
      sectionOrder: s.sectionOrder.filter(key => !key.startsWith('custom_') || s.customSections.find(cs => cs.id === id && `custom_${id}` === key) === undefined)
    })),

    setSectionOrder: (sectionOrder) => withHistory(() => ({ sectionOrder })),

    setTemplate: (template) => withHistory(() => ({ template })),

    setPrimaryColor: (primaryColor) => withHistory(() => ({ primaryColor })),

    setFontFamily: (fontFamily) => withHistory(() => ({ fontFamily })),

    setFontSize: (fontSize) => withHistory(() => ({ fontSize })),

    setLineSpacing: (lineSpacing) => withHistory(() => ({ lineSpacing })),

    setZoom: (zoom) => set({ zoom }),

    undo: () => {
      const { past, future } = get()
      if (past.length === 0) return
      const prev = past[past.length - 1]
      const current = getSnapshot(get())
      set({
        ...prev,
        past: past.slice(0, -1),
        future: [current, ...future.slice(0, MAX_HISTORY - 1)],
      })
      saveToStorage()
    },

    redo: () => {
      const { past, future } = get()
      if (future.length === 0) return
      const next = future[0]
      const current = getSnapshot(get())
      set({
        ...next,
        past: [...past.slice(-(MAX_HISTORY - 1)), current],
        future: future.slice(1),
      })
      saveToStorage()
    },

    loadFromStorage: () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const data = JSON.parse(raw)
        set(s => ({
          ...s,
          ...data,
          past: [],
          future: [],
        }))
      } catch {}
    },

    loadFromData: (data: any) => {
      if (!data) return
      const content = data.contentJson
        ? (typeof data.contentJson === 'string' ? JSON.parse(data.contentJson) : data.contentJson)
        : (data.content ? (typeof data.content === 'string' ? JSON.parse(data.content) : data.content) : {})

      set(s => ({
        ...s,
        id: data.id ? String(data.id) : s.id,
        title: data.title || data.Title || s.title,
        personal: { ...s.personal, ...(content.personal || {}) },
        summary: content.summary ?? s.summary,
        experience: content.experience ?? s.experience,
        education: content.education ?? s.education,
        skills: content.skills ?? s.skills,
        languages: content.languages ?? s.languages,
        certifications: content.certifications ?? s.certifications,
        customSections: content.customSections ?? s.customSections,
        sectionOrder: content.sectionOrder ?? s.sectionOrder,
        template: content.template ?? data.templateSlug ?? s.template,
        primaryColor: content.primaryColor ?? s.primaryColor,
        fontFamily: content.fontFamily ?? s.fontFamily,
        fontSize: content.fontSize ?? s.fontSize,
        lineSpacing: content.lineSpacing ?? s.lineSpacing,
        past: [],
        future: [],
      }))
    },
  }
})
