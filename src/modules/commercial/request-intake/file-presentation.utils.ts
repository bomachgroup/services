export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function fileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url, window.location.origin).pathname
    const segment = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? 'Document')
    return (
      segment.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '') ||
      segment
    )
  } catch {
    const segment = url.split('/').filter(Boolean).pop() ?? 'Document'
    return decodeURIComponent(segment)
  }
}

export function fileTypeLabel(fileName: string) {
  const type = contentTypeFromFileName(fileName).toLowerCase()
  const name = fileName.toLowerCase()
  if (type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(name)) return 'Image'
  if (type.includes('pdf') || name.endsWith('.pdf')) return 'PDF'
  if (type.includes('word') || /\.(doc|docx)$/.test(name)) return 'Word document'
  if (type.includes('text') || /\.(txt|csv|rtf)$/.test(name)) return 'Text file'
  const extension = name.split('.').pop()
  return extension ? extension.toUpperCase() : 'Document'
}

export function contentTypeFromFileName(fileName: string) {
  const name = fileName.toLowerCase()
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(name)) {
    const extension = name.split('.').pop() ?? 'png'
    return `image/${extension === 'jpg' ? 'jpeg' : extension}`
  }
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (/\.(doc|docx)$/.test(name)) {
    return name.endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/msword'
  }
  if (/\.(txt|csv|rtf)$/.test(name)) return 'text/plain'
  return ''
}

function isLikelyFileUrl(value: string) {
  const trimmed = value.trim()
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/media/')
}

export function collectFileAnswerUrls(value: unknown, fieldType?: string) {
  if (fieldType === 'file') {
    if (typeof value === 'string' && value.trim()) return [value.trim()]
    if (Array.isArray(value)) {
      return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    }
    return []
  }

  if (typeof value === 'string' && isLikelyFileUrl(value)) return [value.trim()]
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string' && isLikelyFileUrl(item))
      .map((item) => item.trim())
  }
  return []
}

export function isImageContentType(contentType: string, fileName: string) {
  const type = contentType.toLowerCase()
  const name = fileName.toLowerCase()
  return type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(name)
}

export function isPdfContentType(contentType: string, fileName: string) {
  const type = contentType.toLowerCase()
  const name = fileName.toLowerCase()
  return type.includes('pdf') || name.endsWith('.pdf')
}
