import type { CreateDeliverableInput, UpdateDeliverableInput } from './deliverable.types'

export type DeliverableCreateField =
  | 'title'
  | 'version'
  | 'fileUrl'
  | 'fileSizeBytes'
  | 'clientVisible'

export type DeliverableFieldError = {
  field: DeliverableCreateField
  message: string
}

function validDocumentUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateDeliverableCreate(input: CreateDeliverableInput): DeliverableFieldError | null {
  if (!input.title.trim()) return { field: 'title', message: 'Deliverable title is required.' }
  if (!input.version.trim()) return { field: 'version', message: 'Version is required.' }
  if (!input.fileUrl.trim()) return { field: 'fileUrl', message: 'Document is required.' }
  if (!validDocumentUrl(input.fileUrl.trim()))
    return { field: 'fileUrl', message: 'Document must be a valid uploaded file URL.' }
  if ((input.fileSizeBytes ?? 0) < 0)
    return { field: 'fileSizeBytes', message: 'File size cannot be negative.' }
  if (input.approvalMode === 'client' && !input.clientVisible) {
    return {
      field: 'clientVisible',
      message: 'Client approval requires the deliverable to be visible to the client.',
    }
  }
  return null
}

export function validateDeliverableUpdate(input: UpdateDeliverableInput) {
  if (input.title !== undefined && !input.title.trim()) return 'Deliverable title is required.'
  if (input.version !== undefined && !input.version.trim()) return 'Version is required.'
  if (input.fileUrl !== undefined) {
    if (!input.fileUrl.trim()) return 'Document URL is required.'
    if (!validDocumentUrl(input.fileUrl.trim()))
      return 'Document URL must be a valid http or https URL.'
  }
  if (input.fileSizeBytes !== undefined && input.fileSizeBytes < 0)
    return 'File size cannot be negative.'
  return ''
}
