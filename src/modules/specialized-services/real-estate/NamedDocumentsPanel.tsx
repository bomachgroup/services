import { IconFile, IconFileSpreadsheet, IconFileText, IconFileTypePdf, IconPhoto } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'

import {
  DocumentPreviewModal,
  type PreviewDocument,
} from '@/modules/commercial/request-intake/DocumentPreviewModal'

import type { NamedDocument } from './real-estate.types'

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

function isFileReference(value: string): boolean {
  return value.startsWith('http') || value.startsWith('/') || value.startsWith('blob:')
}

/**
 * Read-only viewer for documents already attached to an estate record.
 * Shows every named document collected for the estate; each one opens the
 * in-app preview modal (inline image/PDF) with a new-tab fallback.
 */
export function NamedDocumentsPanel({ documents }: { documents: NamedDocument[] }) {
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
                  fileName: document.file,
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
                  {document.createdAt ? new Date(document.createdAt).toLocaleDateString() : '—'}
                </time>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="specialized-estate-documents-empty">
          No documents collected for this estate yet.
        </p>
      )}

      {previewDocument ? (
        <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />
      ) : null}
    </div>
  )
}
