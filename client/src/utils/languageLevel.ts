const LEVEL_LABELS: Record<string, string> = {
  'Nativo':  'Nativo',
  'C2':      'Fluente',
  'C1':      'Avançado',
  'B2':      'Intermédio Superior',
  'B1':      'Intermédio',
  'A2':      'Elementar',
  'A1':      'Iniciante',
}

/** Devolve apenas o rótulo descritivo sem o código (ex: "B2" → "Intermédio Superior") */
export function langLabel(level: string): string {
  return LEVEL_LABELS[level] ?? level
}
