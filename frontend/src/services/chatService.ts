import { api } from './api';
import type {
  ChatHistoryResponse,
  ChatResponse,
  ChatSessionListResponse,
} from '../types';

interface SessionResponse {
  session_id: string;
}

export const chatService = {
  async sendMessage(message: string, sessionId?: string): Promise<ChatResponse> {
    return api.post<ChatResponse>('/chat/send', {
      message,
      session_id: sessionId,
    });
  },

  streamUrl(message: string): string {
    return `/chat/stream?message=${encodeURIComponent(message)}`;
  },

  streamUrlForSession(message: string, sessionId: string): string {
    return `/chat/stream?message=${encodeURIComponent(message)}&session_id=${encodeURIComponent(sessionId)}`;
  },

  async newSession(): Promise<SessionResponse> {
    return api.post<SessionResponse>('/chat/new', {});
  },

  async listSessions(): Promise<ChatSessionListResponse> {
    return api.get<ChatSessionListResponse>('/chat/sessions');
  },

  async getHistory(sessionId: string): Promise<ChatHistoryResponse> {
    return api.get<ChatHistoryResponse>(`/chat/history?session_id=${encodeURIComponent(sessionId)}`);
  },

  async deleteSession(sessionId: string): Promise<{ message: string }> {
    return api.delete<{ message: string }>(`/chat/session?session_id=${encodeURIComponent(sessionId)}`);
  },
};
