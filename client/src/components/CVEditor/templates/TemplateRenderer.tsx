import React from 'react'
import { useCVStore } from '../../../store/cvStore'
import ExecutiveTemplate from './ExecutiveTemplate'
import ModernTemplate from './ModernTemplate'
import ClassicTemplate from './ClassicTemplate'
import CreativeTemplate from './CreativeTemplate'

export default function TemplateRenderer() {
  const template = useCVStore(s => s.template)

  switch (template) {
    case 'modern': return <ModernTemplate />
    case 'classic': return <ClassicTemplate />
    case 'creative': return <CreativeTemplate />
    case 'executive':
    default:
      return <ExecutiveTemplate />
  }
}
