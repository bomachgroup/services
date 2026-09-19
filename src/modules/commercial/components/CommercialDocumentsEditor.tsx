import { IconRefresh, IconTrash, IconUpload, IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

import { uploadFile } from '@/shared/api/file-upload'

import { FileTypeIcon } from '../request-intake/file-presentation'
import { formatBytes } from '../request-intake/file-presentation.utils'
import type { CommercialAttachment } from '../quotation/quotation.types'

interface UploadDraft {
  id: string
  file: File
  status: 'uploading' | 'failed'
  message?: string
}

function attachmentFromFile(file: File, fileUrl: string, sortOrder: number): CommercialAttachment {
  return {
    label: file.name.replace(/\.[^.]+$/, '') || file.name,
    fileName: file.name,
    fileUrl,
    contentType: file.type,
    fileSizeBytes: file.size,
    sortOrder,
  }
}

export function CommercialDocumentsEditor({
  attachments,
  error,
  onChange,
  onBusyChange,
  onClearError,
}: {
  attachments: CommercialAttachment[]
  error?: string | undefined
  onChange: (attachments: CommercialAttachment[]) => void
  onBusyChange: (busy: boolean) => void
  onClearError: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const attachmentsRef = useRef(attachments)
  const [drafts, setDrafts] = useState<UploadDraft[]>([])

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  useEffect(() => {
    onBusyChange(drafts.some((draft) => draft.status === 'uploading'))
  }, [drafts, onBusyChange])

  const setDraftList = (next: UploadDraft[] | ((current: UploadDraft[]) => UploadDraft[])) => {
    setDrafts(next)
  }

  const startUpload = async (file: File, existingDraftId?: string) => {
    onClearError()
    const id = existingDraftId ?? `${file.name}-${file.size}-${Date.now()}`
    setDraftList((current) => [
      ...current.filter((draft) => draft.id !== id),
      { id, file, status: 'uploading' },
    ])
    try {
      const fileUrl = await uploadFile(file)
      const nextAttachments = [
        ...attachmentsRef.current,
        attachmentFromFile(file, fileUrl, attachmentsRef.current.length * 10),
      ]
      attachmentsRef.current = nextAttachments
      onChange(nextAttachments)
      setDraftList((current) => current.filter((draft) => draft.id !== id))
    } catch (error) {
      setDraftList((current) => [
        ...current.filter((draft) => draft.id !== id),
        {
          id,
          file,
          status: 'failed',
          message:
            error instanceof Error
              ? error.message
              : 'The document could not be uploaded. Please try again.',
        },
      ])
    }
  }

  const handleFiles = (files: FileList | null) => {
    Array.from(files ?? []).forEach((file) => void startUpload(file))
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="commercial-documents-editor" data-invalid={Boolean(error)}>
      <div className="commercial-form-section-heading">
        <div>
          <h3>Supporting documents</h3>
          <p>Attach proposals, schedules, scope notes, or supporting files.</p>
        </div>
        <button
          type="button"
          className="commercial-btn commercial-btn-sm"
          onClick={() => inputRef.current?.click()}
        >
          <IconUpload size={14} />
          Add document
        </button>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        multiple
        onChange={(event) => handleFiles(event.target.files)}
      />
      {attachments.length || drafts.length ? (
        <div className="commercial-document-list">
          {attachments.map((attachment, index) => (
            <div className="commercial-document-row" key={`${attachment.fileUrl}-${index}`}>
              <FileTypeIcon fileName={attachment.fileName} contentType={attachment.contentType} />
              <div>
                <b>{attachment.label || attachment.fileName}</b>
                <span>
                  {attachment.fileName} · {formatBytes(attachment.fileSizeBytes)}
                </span>
              </div>
              <button
                type="button"
                className="commercial-icon-button"
                onClick={() =>
                  onChange(attachments.filter((_item, itemIndex) => itemIndex !== index))
                }
                aria-label="Remove document"
              >
                <IconTrash size={16} />
              </button>
            </div>
          ))}
          {drafts.map((draft) => (
            <div
              className="commercial-document-row commercial-document-row--pending"
              key={draft.id}
            >
              <FileTypeIcon fileName={draft.file.name} contentType={draft.file.type} />
              <div>
                <b>{draft.file.name}</b>
                {draft.status === 'uploading' ? (
                  <>
                    <span role="status">Uploading</span>
                    <div
                      className="commercial-upload-progress"
                      role="progressbar"
                      aria-label={`Uploading ${draft.file.name}`}
                    >
                      <div className="commercial-upload-progress-bar" />
                    </div>
                  </>
                ) : (
                  <span role="status">{draft.message ?? 'Upload failed.'}</span>
                )}
              </div>
              {draft.status === 'failed' ? (
                <button
                  type="button"
                  className="commercial-icon-button"
                  onClick={() => void startUpload(draft.file, draft.id)}
                  aria-label="Retry upload"
                >
                  <IconRefresh size={16} />
                </button>
              ) : null}
              <button
                type="button"
                className="commercial-icon-button"
                onClick={() =>
                  setDraftList((current) => current.filter((item) => item.id !== draft.id))
                }
                aria-label="Remove upload"
              >
                {draft.status === 'uploading' ? <IconX size={16} /> : <IconTrash size={16} />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="commercial-upload-empty">No documents attached yet.</div>
      )}
      {error ? <small className="commercial-field-error">{error}</small> : null}
    </div>
  )
}
