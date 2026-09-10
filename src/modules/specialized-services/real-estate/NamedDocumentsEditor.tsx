import {
  IconFile,
  IconFileSpreadsheet,
  IconFileText,
  IconFileTypePdf,
  IconPhoto,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { useRef, useState, type ReactNode } from 'react'

import { uploadFile } from '@/shared/api/file-upload'
import { presentError } from '@/shared/errors'

import type { NamedDocument } from './real-estate.types'

export type EditableNamedDocument = Partial<NamedDocument> & {
  fileUrl?: string
  uploadState?: 'idle' | 'uploading' | 'ready' | 'failed'
  error?: string
}

function documentIcon(name: string, fileUrl?: string): ReactNode {
  const source = `${name} ${fileUrl ?? ''}`.toLowerCase()
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

function documentStatus(document: EditableNamedDocument) {
  if (document.uploadState === 'uploading') return 'Uploading…'
  if (document.uploadState === 'failed') return document.error || 'Upload failed'
  return null
}

export function NamedDocumentsEditor({
  value,
  onChange,
  error = '',
}: {
  value: EditableNamedDocument[]
  onChange: (value: EditableNamedDocument[]) => void
  error?: string
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [draftName, setDraftName] = useState('')
  const [adderError, setAdderError] = useState('')
  const isUploading = value.some((document) => document.uploadState === 'uploading')

  const addFile = async (file: File) => {
    const name = draftName.trim()
    if (!name) {
      setAdderError('Enter a document name before adding a file.')
      return
    }

    setAdderError('')
    const key = `${file.name}-${Date.now()}`
    const draft: EditableNamedDocument = {
      name,
      file: key,
      uploadState: 'uploading',
    }
    onChange([...value, draft])
    setDraftName('')

    try {
      const url = await uploadFile(file)
      onChange(
        [...value, draft].map((document) =>
          document.file === key
            ? { ...document, file: url, fileUrl: url, uploadState: 'ready', error: '' }
            : document,
        ),
      )
    } catch (uploadError) {
      onChange(
        [...value, draft].map((document) =>
          document.file === key
            ? {
                ...document,
                uploadState: 'failed',
                error: presentError(uploadError, 'form-submit').message,
              }
            : document,
        ),
      )
    }
  }

  const openFilePicker = () => {
    if (!draftName.trim()) {
      setAdderError('Enter a document name before adding a file.')
      return
    }
    fileInputRef.current?.click()
  }

  return (
    <section
      className={`commercial-form-section specialized-inline-editor${
        error ? ' commercial-field--invalid' : ''
      }`}
    >
      <div className="commercial-form-section-heading">
        <div>
          <h3>Documents</h3>
          <p>Name each file, then add survey plans, layouts, and approvals.</p>
        </div>
      </div>

      <div className="specialized-document-adder">
        <label className="commercial-field specialized-document-name-field">
          <span>
            Document name <em>*</em>
          </span>
          <input
            value={draftName}
            placeholder="Estate layout"
            onChange={(event) => {
              setDraftName(event.target.value)
              if (adderError) setAdderError('')
            }}
            aria-invalid={Boolean(error || adderError)}
          />
        </label>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void addFile(file)
          }}
        />
        <button
          type="button"
          className="commercial-btn specialized-document-add-btn"
          disabled={!draftName.trim() || isUploading}
          onClick={openFilePicker}
        >
          <IconPlus size={15} /> Add document
        </button>
      </div>
      {adderError ? <div className="commercial-field-error">{adderError}</div> : null}
      {error ? <small className="commercial-field-error">{error}</small> : null}

      <div className="specialized-document-list">
        {value.length ? (
          value.map((document, index) => {
            const fileUrl =
              document.fileUrl ?? (document.file?.startsWith('http') ? document.file : undefined)
            const status = documentStatus(document)

            return (
              <article
                key={`${document.id ?? document.file ?? index}`}
                className="specialized-document-card"
                data-state={document.uploadState ?? 'ready'}
              >
                <div className="specialized-document-card-icon" aria-hidden="true">
                  {documentIcon(document.name || 'Document', fileUrl)}
                </div>
                <div className="specialized-document-card-body">
                  <strong>{document.name || 'Document'}</strong>
                  {status ? <span className="specialized-document-card-meta">{status}</span> : null}
                </div>
                <div className="specialized-document-card-actions">
                  {fileUrl && document.uploadState !== 'failed' ? (
                    <a
                      className="commercial-btn commercial-btn-ghost commercial-btn-compact"
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="commercial-icon-btn"
                    aria-label={`Remove ${document.name || 'document'}`}
                    onClick={() => onChange(value.filter((_, docIndex) => docIndex !== index))}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </article>
            )
          })
        ) : (
          <div className="commercial-empty">No documents added yet.</div>
        )}
      </div>
    </section>
  )
}
