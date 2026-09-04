import { IconExternalLink, IconX } from '@tabler/icons-react'

import { FileTypeIcon } from './file-presentation'
import {
  contentTypeFromFileName,
  fileNameFromUrl,
  isImageContentType,
  isPdfContentType,
} from './file-presentation.utils'

export interface PreviewDocument {
  fileUrl: string
  fileName?: string
  contentType?: string
  label?: string
}

export function FileDocumentRow({
  fileUrl,
  fileName,
  contentType,
  title,
  subtitle,
  onOpen,
}: {
  fileUrl: string
  fileName?: string
  contentType?: string
  title?: string
  subtitle?: string
  onOpen: () => void
}) {
  const resolvedFileName = fileName?.trim() || fileNameFromUrl(fileUrl)
  const resolvedContentType = contentType?.trim() || contentTypeFromFileName(resolvedFileName)
  const resolvedTitle = title?.trim() || resolvedFileName
  const resolvedSubtitle = subtitle?.trim() || resolvedContentType || 'View document'

  return (
    <button type="button" className="commercial-attachment-row" onClick={onOpen}>
      <div className="commercial-upload-item-icon">
        <FileTypeIcon fileName={resolvedFileName} contentType={resolvedContentType} />
      </div>
      <div className="commercial-attachment-meta">
        <div className="commercial-attachment-name">{resolvedTitle}</div>
        <div className="commercial-attachment-sub">{resolvedSubtitle}</div>
      </div>
      <span className="commercial-attachment-action" aria-hidden="true">
        <IconExternalLink size={16} />
      </span>
    </button>
  )
}

export function DocumentPreviewModal({
  document,
  onClose,
}: {
  document: PreviewDocument
  onClose: () => void
}) {
  const fileName = document.fileName?.trim() || fileNameFromUrl(document.fileUrl)
  const contentType =
    document.contentType?.trim() || contentTypeFromFileName(fileName) || 'Document'
  const title = document.label?.trim() || fileName
  const isImage = isImageContentType(contentType, fileName)
  const isPdf = isPdfContentType(contentType, fileName)

  return (
    <div
      className="commercial-modal-backdrop commercial-modal-backdrop--nested commercial-modal-backdrop--preview"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="commercial-modal commercial-modal--preview"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${title}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="commercial-modal-header">
          <div>
            <h2>{title}</h2>
            <p>{fileName}</p>
          </div>
          <button type="button" className="commercial-modal-close" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </header>

        <div className="commercial-document-preview-body">
          {isImage ? (
            <img src={document.fileUrl} alt={title} className="commercial-document-preview-image" />
          ) : isPdf ? (
            <iframe
              src={document.fileUrl}
              title={title}
              className="commercial-document-preview-frame"
            />
          ) : (
            <div className="commercial-document-preview-fallback">
              <div className="commercial-document-preview-fallback-icon">
                <FileTypeIcon fileName={fileName} contentType={contentType} size={28} />
              </div>
              <strong>{fileName}</strong>
              <p>Preview is not available for this file type. Open it in a new tab to view.</p>
            </div>
          )}
        </div>

        <footer className="commercial-modal-footer">
          <a
            href={document.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="commercial-btn"
          >
            <IconExternalLink size={14} />
            Open in new tab
          </a>
          <button type="button" className="commercial-btn commercial-btn-primary" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>
  )
}
