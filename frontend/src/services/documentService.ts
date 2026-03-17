import { api } from './api';

interface DocumentListResponse {
  documents: string[];
}

interface UploadResponse {
  filename: string;
  message: string;
}

export const documentService = {
  async list(): Promise<string[]> {
    const data = await api.get<DocumentListResponse>('/documents/');
    return data.documents || [];
  },

  async upload(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/documents/upload/file', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  },

  async delete(documentName: string): Promise<void> {
    return api.delete<void>(`/documents/${documentName}`);
  },
};