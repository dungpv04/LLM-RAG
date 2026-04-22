import { api } from './api';
import type { ChatResponse } from '../types';

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

  async newSession(): Promise<SessionResponse> {
    return api.post<SessionResponse>('/chat/new', {});
  },
};
