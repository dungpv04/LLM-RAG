import { useCallback, useEffect, useRef, useState } from 'react';
import { chatService } from '../services/chatService';
import type { ChatSession, Message, StreamData, UseChatReturn } from '../types';

const STORAGE_KEY = 'chat_sessions';

function createDraftSession(): ChatSession {
  const timestamp = new Date().toISOString();

  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    messages: [],
    streaming: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    preview: 'Cuộc trò chuyện mới',
  };
}

export function useChat(): UseChatReturn {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatSession[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    return [createDraftSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatSession[];
        if (Array.isArray(parsed) && parsed[0]?.id) {
          return parsed[0].id;
        }
      } catch {
        return '';
      }
    }

    return '';
  });
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamingSessionIdRef = useRef<string | null>(null);

  const currentSession = sessions.find((session) => session.id === activeSessionId) || sessions[0] || null;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (!activeSessionId && sessions[0]?.id) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  const updateSession = useCallback((sessionId: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions((previous) =>
      previous.map((session) => (session.id === sessionId ? updater(session) : session)),
    );
  }, []);

  const cleanupStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (streamingSessionIdRef.current) {
      updateSession(streamingSessionIdRef.current, (session) => ({
        ...session,
        streaming: false,
        updatedAt: new Date().toISOString(),
      }));
      streamingSessionIdRef.current = null;
    }
  }, [updateSession]);

  const sendMessage = useCallback(async (message: string) => {
    if (!currentSession) {
      return;
    }

    cleanupStream();

    const sessionId = currentSession.id;
    setError(null);

    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    updateSession(sessionId, (session) => ({
      ...session,
      messages: [...session.messages, userMessage],
      streaming: true,
      preview: session.preview === 'Cuộc trò chuyện mới' ? message.slice(0, 60) : session.preview,
      updatedAt: new Date().toISOString(),
    }));

    streamingSessionIdRef.current = sessionId;

    try {
      if (sessionId.startsWith('draft-')) {
        await chatService.newSession();
      }

      let fullAnswer = '';

      eventSourceRef.current = new EventSource(chatService.streamUrl(message), {
        withCredentials: true,
      });

      eventSourceRef.current.onmessage = (event) => {
        if (streamingSessionIdRef.current !== sessionId) {
          cleanupStream();
          return;
        }

        const data: StreamData = JSON.parse(event.data);

        if (data.type === 'token') {
          fullAnswer += data.content || '';

          setSessions((previous) =>
            previous.map((session) => {
              if (session.id !== sessionId) {
                return session;
              }

              const messages = [...session.messages];
              const lastMessage = messages[messages.length - 1];

              if (lastMessage?.role === 'assistant') {
                messages[messages.length - 1] = {
                  ...lastMessage,
                  content: fullAnswer,
                };
              } else {
                messages.push({
                  role: 'assistant',
                  content: fullAnswer,
                  timestamp: new Date().toISOString(),
                });
              }

              return {
                ...session,
                messages,
                updatedAt: new Date().toISOString(),
              };
            }),
          );
        } else if (data.type === 'metadata') {
          setSessions((previous) =>
            previous.map((session) => {
              if (session.id !== sessionId) {
                return session;
              }

              const messages = [...session.messages];
              const lastMessage = messages[messages.length - 1];

              if (lastMessage?.role === 'assistant') {
                messages[messages.length - 1] = {
                  ...lastMessage,
                  sources: data.sources,
                  strategy: data.strategy,
                  strategy_reasoning: data.strategy_reasoning,
                };
              }

              return {
                ...session,
                messages,
                updatedAt: new Date().toISOString(),
              };
            }),
          );
        } else if (data.type === 'done') {
          if (data.session_id) {
            setSessions((previous) =>
              previous.map((session) =>
                session.id === sessionId
                  ? {
                      ...session,
                      id: data.session_id!,
                      streaming: false,
                      updatedAt: new Date().toISOString(),
                    }
                  : session,
              ),
            );
            setActiveSessionId(data.session_id);
          }

          cleanupStream();
        } else if (data.type === 'error') {
          setError(data.message || 'Đã xảy ra lỗi');
          cleanupStream();
        }
      };

      eventSourceRef.current.onerror = () => {
        setError('Lỗi kết nối');
        cleanupStream();
      };
    } catch (err) {
      setError((err as Error).message);
      cleanupStream();
    }
  }, [cleanupStream, currentSession, updateSession]);

  const switchToSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setError(null);
  }, []);

  const createNewChat = useCallback(() => {
    cleanupStream();
    const newSession = createDraftSession();
    setSessions((previous) => [newSession, ...previous]);
    setActiveSessionId(newSession.id);
    setError(null);
  }, [cleanupStream]);

  const deleteSession = useCallback((sessionId: string) => {
    if (streamingSessionIdRef.current === sessionId) {
      cleanupStream();
    }

    setSessions((previous) => {
      const filtered = previous.filter((session) => session.id !== sessionId);
      if (filtered.length === 0) {
        const fallback = createDraftSession();
        setActiveSessionId(fallback.id);
        return [fallback];
      }

      if (sessionId === activeSessionId) {
        setActiveSessionId(filtered[0].id);
      }

      return filtered;
    });
  }, [activeSessionId, cleanupStream]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    sessions,
    activeSessionId,
    currentSession,
    error,
    sendMessage,
    switchToSession,
    createNewChat,
    deleteSession,
  };
}
