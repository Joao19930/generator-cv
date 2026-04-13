import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function exportPDF(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Elemento #${elementId} não encontrado`)

  // Garantir que o elemento tem dimensões reais antes de capturar
  const rect = element.getBoundingClientRect()
  const elWidth  = Math.max(rect.width,  element.offsetWidth,  794)
  const elHeight = Math.max(rect.height, element.offsetHeight, element.scrollHeight, 100)

  // Temporariamente resetar transform para a captura
  const originalTransform       = element.style.transform
  const originalTransformOrigin = element.style.transformOrigin
  element.style.transform       = 'none'
  element.style.transformOrigin = 'unset'

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
      // Primeira tentativa: com CORS (para imagens Cloudinary, etc.)
      canvas = await html2canvas(element, { ...opts, useCORS: true, allowTaint: false })
    } catch (corsErr) {
      // Fallback: esconder imagens cross-origin e tentar sem CORS
      console.warn('[exportPDF] CORS falhou, a tentar sem imagens externas:', corsErr)
      canvas = await html2canvas(element, {
        ...opts,
        useCORS: false,
        allowTaint: true,
        onclone: (_doc: Document, el: HTMLElement) => {
          el.querySelectorAll('img').forEach((img: HTMLImageElement) => {
            if (img.src && !img.src.startsWith(window.location.origin) &&
                !img.src.startsWith('data:')) {
              img.style.visibility = 'hidden'
            }
          })
        },
      })
    }

    // Validar dimensões do canvas
    if (!canvas.width || !canvas.height) {
      throw new Error('Canvas vazio — o elemento pode estar oculto ou sem conteúdo')
    }

    // A4 em mm
    const pdfWidth  = 210
    const pdfHeight = 297

    // Altura real em mm correspondente ao canvas completo
    const canvasHeightMM = (canvas.height / canvas.width) * pdfWidth
    const totalPages = Math.max(1, Math.ceil(canvasHeightMM / pdfHeight))

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage()

      const pxPerMM   = canvas.width / pdfWidth
      const srcY      = page * pdfHeight * pxPerMM
      const srcH      = Math.min(pdfHeight * pxPerMM, canvas.height - srcY)

      if (srcH <= 0) break

      const pageCanvas = document.createElement('canvas')
      pageCanvas.width  = canvas.width
      pageCanvas.height = Math.ceil(srcH)

      const ctx = pageCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, pageCanvas.height)
      }

      const pageImg      = pageCanvas.toDataURL('image/jpeg', 0.92)
      const pageHeightMM = (pageCanvas.height / canvas.width) * pdfWidth

      // Proteger contra valores inválidos
      if (pageHeightMM > 0 && isFinite(pageHeightMM)) {
        pdf.addImage(pageImg, 'JPEG', 0, 0, pdfWidth, pageHeightMM)
      }
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
  } finally {
    element.style.transform       = originalTransform
    element.style.transformOrigin = originalTransformOrigin
  }
}
