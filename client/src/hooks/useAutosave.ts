import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useCVStore } from '../store/cvStore'

const STORAGE_KEY = 'cv_editor_data'

export function useAutosave(cvId: string | null, token: string | null) {
  const store = useCVStore()
  const lastSavedRef = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const snapshot = JSON.stringify({
      personal: store.personal,
      summary: store.summary,
      experience: store.experience,
      education: store.education,
      skills: store.skills,
      languages: store.languages,
      certifications: store.certifications,
      customSections: store.customSections,
      sectionOrder: store.sectionOrder,
      template: store.template,
      primaryColor: store.primaryColor,
      fontFamily: store.fontFamily,
      fontSize: store.fontSize,
      lineSpacing: store.lineSpacing,
      title: store.title,
    })

    if (snapshot === lastSavedRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      lastSavedRef.current = snapshot

      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...JSON.parse(snapshot), id: store.id }))
      } catch {}

      // Save to API if available
      if (cvId && token) {
        try {
          const contentJson = {
            personal: store.personal,
            summary: store.summary,
            experience: store.experience,
            education: store.education,
            skills: store.skills,
            languages: store.languages,
            certifications: store.certifications,
            customSections: store.customSections,
            sectionOrder: store.sectionOrder,
            template: store.template,
            primaryColor: store.primaryColor,
            fontFamily: store.fontFamily,
            fontSize: store.fontSize,
            lineSpacing: store.lineSpacing,
          }
          await fetch(`/api/cv/${cvId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: store.title,
              contentJson: JSON.stringify(contentJson),
              templateName: store.template,
            }),
          })
        } catch {}
      }

      const now = new Date()
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      toast.success(`Guardado às ${timeStr}`, {
        id: 'autosave',
        duration: 2000,
        icon: '✓',
      })
    }, 2000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [
    store.personal,
    store.summary,
    store.experience,
    store.education,
    store.skills,
    store.languages,
    store.certifications,
    store.customSections,
    store.sectionOrder,
    store.template,
    store.primaryColor,
    store.fontFamily,
    store.fontSize,
    store.lineSpacing,
    store.title,
    cvId,
    token,
  ])
}
