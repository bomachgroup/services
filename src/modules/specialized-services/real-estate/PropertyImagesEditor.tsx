import { IconPhoto, IconPlus, IconRefresh, IconTrash, IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

import { uploadFile } from '@/shared/api/file-upload'
import { presentError } from '@/shared/errors'
import { fileNameFromUrl } from '@/modules/commercial/request-intake/file-presentation.utils'

type FailedImage = {
  id: string
  file: File
  error: string
}

type PendingImage = {
  id: string
  file: File
}

const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg'])

function imageTypeError(file: File) {
  return ACCEPTED_IMAGE_TYPES.has(file.type) ? null : 'Use a PNG, JPG, or JPEG image.'
}

export function PropertyImagesEditor({
  value,
  onChange,
}: {
  value: string[]
  onChange: (value: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const valueRef = useRef(value)
  const uploadAttemptRef = useRef(new Map<string, number>())
  const uploadIdRef = useRef(0)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [failedImages, setFailedImages] = useState<FailedImage[]>([])

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const updateValue = (nextValue: string[]) => {
    valueRef.current = nextValue
    onChange(nextValue)
  }

  const uploadImage = async (file: File, id: string) => {
    const validationError = imageTypeError(file)
    if (validationError) {
      setFailedImages((current) => [
        ...current.filter((item) => item.id !== id),
        { id, file, error: validationError },
      ])
      return
    }

    const attempt = (uploadAttemptRef.current.get(id) ?? 0) + 1
    uploadAttemptRef.current.set(id, attempt)
    setFailedImages((current) => current.filter((item) => item.id !== id))
    setPendingImages((current) => [...current.filter((item) => item.id !== id), { id, file }])

    try {
      const url = await uploadFile(file)
      if (uploadAttemptRef.current.get(id) !== attempt) return
      updateValue([...valueRef.current, url])
      setFailedImages((current) => current.filter((item) => item.id !== id))
    } catch (error) {
      if (uploadAttemptRef.current.get(id) !== attempt) return
      setFailedImages((current) => [
        ...current.filter((item) => item.id !== id),
        { id, file, error: presentError(error, 'form-submit').message },
      ])
    } finally {
      if (uploadAttemptRef.current.get(id) === attempt) {
        uploadAttemptRef.current.delete(id)
        setPendingImages((current) => current.filter((item) => item.id !== id))
      }
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file, index) => {
      uploadIdRef.current += 1
      const id = `${file.name}-${file.lastModified}-${uploadIdRef.current}-${index}`
      void uploadImage(file, id)
    })
  }

  const removePendingImage = (id: string) => {
    uploadAttemptRef.current.delete(id)
    setPendingImages((current) => current.filter((item) => item.id !== id))
  }

  const uploading = pendingImages.length

  return (
    <section className="commercial-form-section specialized-inline-editor">
      <div className="commercial-form-section-heading">
        <div>
          <h3>Property images</h3>
          <p>Add clear property photos for the inventory record and detail view.</p>
        </div>
        <button
          type="button"
          className="commercial-btn"
          disabled={uploading > 0}
          onClick={() => inputRef.current?.click()}
        >
          <IconPlus size={15} /> Add images
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        hidden
        onChange={(event) => {
          handleFiles(event.currentTarget.files)
          event.currentTarget.value = ''
        }}
      />

      {value.length || pendingImages.length || failedImages.length ? (
        <div className="specialized-property-image-editor-grid">
          {pendingImages.map((item) => (
            <article
              className="specialized-property-image-editor-card specialized-property-image-editor-card--uploading"
              key={item.id}
              aria-busy="true"
            >
              <div className="specialized-property-image-editor-fallback" aria-hidden="true">
                <IconPhoto size={22} />
                <span>Uploading</span>
              </div>
              <div className="specialized-property-image-editor-card-footer">
                <span title={item.file.name}>{item.file.name}</span>
                <button
                  type="button"
                  className="commercial-icon-btn"
                  aria-label={`Cancel ${item.file.name} upload`}
                  onClick={() => removePendingImage(item.id)}
                >
                  <IconX size={15} />
                </button>
              </div>
              <div
                className="commercial-upload-progress specialized-property-image-editor-progress"
                role="progressbar"
                aria-label={`Uploading ${item.file.name}`}
              >
                <div className="commercial-upload-progress-bar" />
              </div>
            </article>
          ))}
          {value.map((url) => (
            <article className="specialized-property-image-editor-card" key={url}>
              <img
                src={url}
                alt={fileNameFromUrl(url)}
                onError={(event) => {
                  event.currentTarget.hidden = true
                  event.currentTarget.nextElementSibling?.removeAttribute('hidden')
                }}
              />
              <div className="specialized-property-image-editor-fallback" hidden>
                <IconPhoto size={22} />
                <span>Image unavailable</span>
              </div>
              <div className="specialized-property-image-editor-card-footer">
                <span title={fileNameFromUrl(url)}>{fileNameFromUrl(url)}</span>
                <button
                  type="button"
                  className="commercial-icon-btn"
                  aria-label={`Remove ${fileNameFromUrl(url)}`}
                  onClick={() => updateValue(valueRef.current.filter((item) => item !== url))}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            </article>
          ))}
          {failedImages.map((item) => (
            <article
              className="specialized-property-image-editor-card specialized-property-image-editor-card--failed"
              key={item.id}
            >
              <div className="specialized-property-image-editor-fallback" aria-hidden="true">
                <IconPhoto size={22} />
              </div>
              <div className="specialized-property-image-editor-card-footer">
                <span className="specialized-property-image-editor-error">
                  <strong title={item.file.name}>{item.file.name}</strong>
                  <small>{item.error}</small>
                </span>
                <button
                  type="button"
                  className="commercial-icon-btn"
                  aria-label={`Retry ${item.file.name}`}
                  onClick={() => void uploadImage(item.file, item.id)}
                >
                  <IconRefresh size={15} />
                </button>
                <button
                  type="button"
                  className="commercial-icon-btn"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() =>
                    setFailedImages((current) => current.filter((entry) => entry.id !== item.id))
                  }
                >
                  <IconTrash size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="commercial-empty">No property images added yet.</div>
      )}
    </section>
  )
}
