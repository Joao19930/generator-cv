import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function exportPDF(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Elemento #${elementId} não encontrado`)

  // ── 1. Resetar transforms em TODOS os ancestrais (incluindo o wrapper zoom) ──
  type SavedStyle = { el: HTMLElement; transform: string; transformOrigin: string }
  const savedStyles: SavedStyle[] = []

  let node: HTMLElement | null = element
  while (node) {
    const computed = window.getComputedStyle(node)
    if (computed.transform && computed.transform !== 'none' && computed.transform !== 'matrix(1, 0, 0, 1, 0, 0)') {
      savedStyles.push({ el: node, transform: node.style.transform, transformOrigin: node.style.transformOrigin })
      node.style.transform = 'none'
      node.style.transformOrigin = 'top left'
    }
    node = node.parentElement
  }

  // ── 2. Injectar CSS temporário que neutraliza letter-spacing para html2canvas ──
  // html2canvas não renderiza letter-spacing correctamente — as letras sobrepõem-se.
  const styleTag = document.createElement('style')
  styleTag.id = '__pdf-export-fix__'
  styleTag.textContent = `
    #${elementId} *, #${elementId} {
      letter-spacing: normal !important;
      word-spacing: normal !important;
    }
  `
  document.head.appendChild(styleTag)

  // Forçar reflow para que o CSS seja aplicado antes da captura
  void element.offsetHeight

  const elWidth  = Math.max(element.offsetWidth,  794)
  const elHeight = Math.max(element.scrollHeight, element.offsetHeight, 100)

  try {
    let canvas: HTMLCanvasElement

    const opts = {
      scale: 2,
      backgroundColor: '#ffffff',
      width: Math.round(elWidth),
      height: Math.round(elHeight),
      logging: false,
      imageTimeout: 10000,
    }

    try {
      canvas = await html2canvas(element, { ...opts, useCORS: true, allowTaint: false })
    } catch {
      canvas = await html2canvas(element, {
        ...opts,
        useCORS: false,
        allowTaint: true,
        onclone: (_doc: Document, el: HTMLElement) => {
          el.querySelectorAll('img').forEach((img: HTMLImageElement) => {
            if (img.src && !img.src.startsWith(window.location.origin) && !img.src.startsWith('data:')) {
              img.style.visibility = 'hidden'
            }
          })
        },
      })
    }

    if (!canvas.width || !canvas.height) {
      throw new Error('Canvas vazio — o elemento pode estar oculto ou sem conteúdo')
    }

    const pdfWidth  = 210
    const pdfHeight = 297
    const pxPerMM   = canvas.width / pdfWidth
    const canvasHeightMM = canvas.height / pxPerMM
    const totalPages = Math.max(1, Math.ceil(canvasHeightMM / pdfHeight))

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage()

      const srcY = page * pdfHeight * pxPerMM
      const srcH = Math.min(pdfHeight * pxPerMM, canvas.height - srcY)
      if (srcH <= 0) break

      const pageCanvas = document.createElement('canvas')
      pageCanvas.width  = canvas.width
      pageCanvas.height = Math.ceil(srcH)

      const ctx = pageCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, pageCanvas.height)
      }

      const pageImg      = pageCanvas.toDataURL('image/jpeg', 0.92)
      const pageHeightMM = pageCanvas.height / pxPerMM

      if (pageHeightMM > 0 && isFinite(pageHeightMM)) {
        pdf.addImage(pageImg, 'JPEG', 0, 0, pdfWidth, pageHeightMM)
      }
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)

  } finally {
    // Restaurar todos os transforms
    for (const s of savedStyles) {
      s.el.style.transform       = s.transform
      s.el.style.transformOrigin = s.transformOrigin
    }
    // Remover CSS temporário
    document.getElementById('__pdf-export-fix__')?.remove()
  }
}
