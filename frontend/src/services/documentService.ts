import { api } from './api';
import type {
  DocumentAdminListResponse,
  DocumentContent,
  DocumentDeleteResponse,
  DocumentUploadResponse,
} from '../types';

interface DocumentListResponse {
  documents: string[];
}

export const documentService = {
  async list(): Promise<string[]> {
    const data = await api.get<DocumentListResponse>('/chat/documents');
    return data.documents || [];
  },

  async listAdmin() {
    const data = await api.get<DocumentAdminListResponse>('/documents/admin');
    return data.documents;
  },

  async getContent(documentName: string): Promise<DocumentContent> {
    return api.get<DocumentContent>(`/documents/${encodeURIComponent(documentName)}/content`);
  },

  async upload(file: File): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return api.postForm<DocumentUploadResponse>('/documents/upload/file', formData);
  },

  async delete(documentName: string): Promise<DocumentDeleteResponse> {
    return api.delete<DocumentDeleteResponse>(`/documents/${encodeURIComponent(documentName)}`);
  },
};
