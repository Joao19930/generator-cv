import { create } from 'zustand'

const uid = () => Math.random().toString(36).slice(2, 9)

const initialPersonalInfo = {
  name: '', title: '', email: '', phone: '', location: '', linkedin: '', summary: ''
}

export const useResumeStore = create((set, get) => ({
  personalInfo: { ...initialPersonalInfo },
  experience: [],
  education: [],
  skills: [],
  template: 'bigfour',

  updatePersonalInfo: (field, value) =>
    set(s => ({ personalInfo: { ...s.personalInfo, [field]: value } })),

  addExperience: () =>
    set(s => ({ experience: [...s.experience, { id: uid(), company: '', role: '', startDate: '', endDate: '', current: false, bullets: [''] }] })),

  updateExperience: (id, field, value) =>
    set(s => ({ experience: s.experience.map(e => e.id === id ? { ...e, [field]: value } : e) })),

  removeExperience: (id) =>
    set(s => ({ experience: s.experience.filter(e => e.id !== id) })),

  updateBullet: (expId, idx, value) =>
    set(s => ({ experience: s.experience.map(e => e.id === expId ? { ...e, bullets: e.bullets.map((b, i) => i === idx ? value : b) } : e) })),

  addBullet: (expId) =>
    set(s => ({ experience: s.experience.map(e => e.id === expId ? { ...e, bullets: [...e.bullets, ''] } : e) })),

  removeBullet: (expId, idx) =>
    set(s => ({ experience: s.experience.map(e => e.id === expId ? { ...e, bullets: e.bullets.filter((_, i) => i !== idx) } : e) })),

  addEducation: () =>
    set(s => ({ education: [...s.education, { id: uid(), institution: '', degree: '', field: '', year: '', gpa: '' }] })),

  updateEducation: (id, field, value) =>
    set(s => ({ education: s.education.map(e => e.id === id ? { ...e, [field]: value } : e) })),

  removeEducation: (id) =>
    set(s => ({ education: s.education.filter(e => e.id !== id) })),

  addSkillCategory: () =>
    set(s => ({ skills: [...s.skills, { id: uid(), category: '', items: [] }] })),

  updateSkillCategory: (id, field, value) =>
    set(s => ({ skills: s.skills.map(sk => sk.id === id ? { ...sk, [field]: field === 'items' ? value : value } : sk) })),

  removeSkillCategory: (id) =>
    set(s => ({ skills: s.skills.filter(sk => sk.id !== id) })),

  setTemplate: (t) => set({ template: t }),

  applyAISuggestion: (field, value) => {
    const parts = field.split('.')
    if (parts[0] === 'personalInfo') {
      set(s => ({ personalInfo: { ...s.personalInfo, [parts[1]]: value } }))
    }
  },

  getResumeJSON: () => {
    const { personalInfo, experience, education, skills, template } = get()
    return { personalInfo, experience, education, skills, template }
  }
}))
