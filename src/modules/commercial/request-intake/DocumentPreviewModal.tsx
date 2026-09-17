import { IconDownload, IconExternalLink, IconX } from '@tabler/icons-react'
import { useState } from 'react'

import { FileTypeIcon } from './file-presentation'
import {
  contentTypeFromFileName,
  fileNameFromUrl,
  fileTypeLabel,
  isImageContentType,
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
  // Clean display name: never show raw URLs or uuid prefixes in the UI.
  const cleanFileName = document.fileName?.trim() || fileNameFromUrl(document.fileUrl)
  const contentType = document.contentType?.trim() || contentTypeFromFileName(cleanFileName) || ''
  const friendlyType = fileTypeLabel(cleanFileName)
  const title = document.label?.trim() || cleanFileName
  const isImage = isImageContentType(contentType, cleanFileName)
  // No HEAD probe and no reset effect: images report real failures via
  // <img onError>, everything else shows the action card. The failed URL is
  // tracked so switching documents clears the error without an effect.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const loadFailed = failedUrl != null && failedUrl === document.fileUrl

  return (
    <div
      className="commercial-modal-backdrop commercial-modal-backdrop--nested commercial-modal-backdrop--preview"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="commercial-modal commercial-modal--preview commercial-document-preview"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${title}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="commercial-modal-header commercial-document-preview-header">
          <div className="commercial-document-preview-title">
            <FileTypeIcon fileName={cleanFileName} contentType={contentType} size={22} />
            <div>
              <h2>{title}</h2>
              <p>
                {cleanFileName}{' '}
                <span className="commercial-document-type-badge">{friendlyType}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="commercial-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </header>

        <div className="commercial-document-preview-body">
          {isImage && !loadFailed ? (
            <img
              src={document.fileUrl}
              alt={title}
              className="commercial-document-preview-image"
              onError={() => setFailedUrl(document.fileUrl)}
            />
          ) : loadFailed ? (
            <div className="commercial-document-preview-fallback">
              <div className="commercial-document-preview-fallback-icon">
                <FileTypeIcon fileName={cleanFileName} contentType={contentType} size={28} />
              </div>
              <strong>{title}</strong>
              <span className="commercial-document-type-badge">{friendlyType}</span>
              <p>
                This file couldn’t be loaded for inline viewing. Open it in a new tab or download it
                instead.
              </p>
            </div>
          ) : (
            <div className="commercial-document-preview-fallback">
              <div className="commercial-document-preview-fallback-icon">
                <FileTypeIcon fileName={cleanFileName} contentType={contentType} size={28} />
              </div>
              <strong>{title}</strong>
              <span className="commercial-document-type-badge">{friendlyType}</span>
              <p>
                {isImage
                  ? 'Image preview unavailable.'
                  : 'Inline preview isn’t available for this file type. Open it in a new tab or download it to view.'}
              </p>
            </div>
          )}
        </div>

        <footer className="commercial-modal-footer">
          <a href={document.fileUrl} target="_blank" rel="noreferrer" className="commercial-btn">
            <IconExternalLink size={14} />
            Open in new tab
          </a>
          <a
            href={document.fileUrl}
            download={cleanFileName}
            className="commercial-btn commercial-btn-primary"
          >
            <IconDownload size={14} />
            Download
          </a>
          <button type="button" className="commercial-btn" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>
  )
}
