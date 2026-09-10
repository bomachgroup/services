import { apiClient } from './api-client'

export async function uploadFile(file: File, signal?: AbortSignal): Promise<string> {
  const formData = new FormData()
  formData.set('file', file)
  const payload = await apiClient.post<{ url: string }>('/others/upload-file', formData, {
    ...(signal ? { signal } : {}),
  })
  return payload.url
}
