import {
  IconFile,
  IconFileSpreadsheet,
  IconFileText,
  IconFileTypePdf,
  IconPhoto,
} from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'

import {
  DocumentPreviewModal,
  type PreviewDocument,
} from '@/modules/commercial/request-intake/DocumentPreviewModal'
import { fileNameFromUrl } from '@/modules/commercial/request-intake/file-presentation.utils'

import type { NamedDocument } from './real-estate.types'
import { isFileReference } from './named-documents.utils'

function documentIcon(document: NamedDocument): ReactNode {
  const source = `${document.name} ${document.file}`.toLowerCase()
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(source) || source.includes('image/')) {
    return <IconPhoto size={18} />
  }
  if (/\.pdf$/.test(source)) {
    return <IconFileTypePdf size={18} />
  }
  if (/\.(csv|xlsx?)$/.test(source)) {
    return <IconFileSpreadsheet size={18} />
  }
  if (/\.(docx?|txt|md)$/.test(source)) {
    return <IconFileText size={18} />
  }
  return <IconFile size={18} />
}

function documentDateLabel(value: string) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Read-only viewer for named documents attached to an estate or property.
 * Each document opens the in-app preview modal with a new-tab fallback.
 */
export function NamedDocumentsPanel({
  documents,
  entityLabel = 'estate',
}: {
  documents: NamedDocument[]
  entityLabel?: string
}) {
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null)
  const viewableDocuments = documents.filter((document) => isFileReference(document.file))

  return (
    <div className="specialized-estate-documents">
      {viewableDocuments.length ? (
        <div className="specialized-estate-document-grid">
          {viewableDocuments.map((document) => (
            <button
              key={document.id}
              type="button"
              className="specialized-estate-document-card"
              onClick={() =>
                setPreviewDocument({
                  fileUrl: document.file,
                  fileName: fileNameFromUrl(document.file),
                  label: document.name || 'Document',
                })
              }
              title={`Open ${document.name || 'document'}`}
            >
              <span className="specialized-estate-document-icon" aria-hidden="true">
                {documentIcon(document)}
              </span>
              <span className="specialized-estate-document-body">
                <strong>{document.name || 'Document'}</strong>
                <time dateTime={document.createdAt || undefined}>
                  {documentDateLabel(document.createdAt)}
                </time>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="specialized-estate-documents-empty">
          No documents collected for this {entityLabel} yet.
        </p>
      )}

      {previewDocument ? (
        <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />
      ) : null}
    </div>
  )
}
