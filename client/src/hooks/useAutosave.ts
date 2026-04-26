import { useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useCVStore } from '../store/cvStore'

const STORAGE_KEY = 'cv_editor_data'

function buildContentJson(store: ReturnType<typeof useCVStore.getState>) {
  return {
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
    funcaoArea: store.funcaoArea,
    habilidades: store.habilidades,
    cursos: store.cursos,
    interesses: store.interesses,
  }
}

export function useAutosave(cvId: string | null, token: string | null, onSaved?: () => void) {
  const store = useCVStore()
  const lastSavedRef = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs para ter valores actuais nos event listeners sem re-registar
  const cvIdRef  = useRef(cvId)
  const tokenRef = useRef(token)
  const storeRef = useRef(store)
  cvIdRef.current  = cvId
  tokenRef.current = token
  storeRef.current = store

  // Guarda imediatamente na BD com keepalive (funciona mesmo em page unload/close)
  const flushToApi = useCallback(() => {
    const id  = cvIdRef.current
    const tok = tokenRef.current
    const s   = storeRef.current
    if (!id || !tok) return
    try {
      fetch(`/api/cv/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          title: s.title,
          contentJson: buildContentJson(s), // objeto — o servidor faz JSON.stringify
          templateName: s.template,
          status: 'draft',
        }),
        keepalive: true, // garante envio mesmo após fechar a página
      }).catch(() => {})
    } catch {}
  }, [])

  // Guardar quando a página fica escondida: ecrã apaga, tab muda, browser fecha, app em background
  useEffect(() => {
    const handleHide = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      flushToApi()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') handleHide()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', handleHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', handleHide)
    }
  }, [flushToApi])

  // Autosave normal com debounce de 2s após cada alteração
  useEffect(() => {
    const snapshot = JSON.stringify({
      personal:       store.personal,
      summary:        store.summary,
      experience:     store.experience,
      education:      store.education,
      skills:         store.skills,
      languages:      store.languages,
      certifications: store.certifications,
      customSections: store.customSections,
      sectionOrder:   store.sectionOrder,
      template:       store.template,
      primaryColor:   store.primaryColor,
      fontFamily:     store.fontFamily,
      fontSize:       store.fontSize,
      lineSpacing:    store.lineSpacing,
      title:          store.title,
      funcaoArea:     store.funcaoArea,
      habilidades:    store.habilidades,
      cursos:         store.cursos,
      interesses:     store.interesses,
    })

    if (snapshot === lastSavedRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      lastSavedRef.current = snapshot

      // localStorage — síncrono, nunca se perde
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...JSON.parse(snapshot),
          id: store.id ?? cvId,
        }))
        onSaved?.()
      } catch {}

      // API — assíncrono, com debounce
      if (cvId && token) {
        try {
          await fetch(`/api/cv/${cvId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              title: store.title,
              contentJson: buildContentJson(store), // objeto — o servidor faz JSON.stringify
              templateName: store.template,
              status: 'draft',
            }),
          })
        } catch {}
      }

      const now = new Date()
      const t = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      toast.success(`Guardado às ${t}`, { id: 'autosave', duration: 2000, icon: '✓' })
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
    store.funcaoArea,
    store.habilidades,
    store.cursos,
    store.interesses,
    cvId,
    token,
  ])
}
