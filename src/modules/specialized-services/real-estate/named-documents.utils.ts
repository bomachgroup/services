import type { NamedDocument } from './real-estate.types'

export function isFileReference(value: string): boolean {
  return value.startsWith('http') || value.startsWith('/') || value.startsWith('blob:')
}

export function hasViewableDocuments(documents: NamedDocument[]): boolean {
  return documents.some((document) => isFileReference(document.file))
}
