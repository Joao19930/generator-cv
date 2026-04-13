import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function exportPDF(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Element #${elementId} not found`)

  // Temporarily reset transform for capture
  const originalTransform = element.style.transform
  const originalTransformOrigin = element.style.transformOrigin
  element.style.transform = 'none'
  element.style.transformOrigin = 'unset'

  try {
    let canvas: HTMLCanvasElement

    try {
      // Primeira tentativa: com CORS (para imagens do Cloudinary, etc.)
      canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,        // false + useCORS: evita canvas tainted
        backgroundColor: '#ffffff',
        width: 794,
        height: element.scrollHeight,
        logging: false,
        imageTimeout: 10000,
      })
    } catch (corsErr) {
      // Segunda tentativa: sem restrições CORS (imagem pode ficar em baixa qualidade)
      console.warn('[exportPDF] CORS attempt failed, retrying without CORS:', corsErr)
      canvas = await html2canvas(element, {
        scale: 2,
        useCORS: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        height: element.scrollHeight,
        logging: false,
        // Ignorar imagens cross-origin que não tenham CORS
        onclone: (doc) => {
          doc.querySelectorAll('img').forEach((img: HTMLImageElement) => {
            // Se a imagem for cross-origin, escondê-la para evitar erro
            if (img.src && !img.src.startsWith(window.location.origin) &&
                !img.src.startsWith('data:')) {
              img.style.display = 'none'
            }
          })
        },
      })
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    // A4 dimensions in mm
    const pdfWidth = 210
    const pdfHeight = 297

    const canvasHeightMM = (canvas.height / canvas.width) * pdfWidth
    const totalPages = Math.ceil(canvasHeightMM / pdfHeight)

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage()

      const srcY = page * (canvas.width * (pdfHeight / pdfWidth))
      const srcH = canvas.width * (pdfHeight / pdfWidth)

      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = Math.min(srcH, canvas.height - srcY)
      const ctx = pageCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(canvas, 0, srcY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height)
      }
      const pageImg = pageCanvas.toDataURL('image/jpeg', 0.92)
      const pageHeightMM = (pageCanvas.height / canvas.width) * pdfWidth
      pdf.addImage(pageImg, 'JPEG', 0, 0, pdfWidth, pageHeightMM)
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
  } finally {
    element.style.transform = originalTransform
    element.style.transformOrigin = originalTransformOrigin
  }
}
