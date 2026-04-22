import { useCallback, useEffect, useRef, useState } from 'react';
import { chatService } from '../services/chatService';
import type {
  ChatSession,
  ChatSessionSummaryResponse,
  Message,
  StreamData,
  UseChatReturn,
} from '../types';

function createDraftSession(sessionId?: string): ChatSession {
  const timestamp = new Date().toISOString();

  return {
    id: sessionId || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    messages: [],
    streaming: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    preview: 'Cuộc trò chuyện mới',
  };
}

function mapSessionSummary(session: ChatSessionSummaryResponse): ChatSession {
  return {
    id: session.session_id,
    messages: [],
    streaming: false,
    createdAt: session.created_at || new Date().toISOString(),
    updatedAt: session.last_active || session.created_at || new Date().toISOString(),
    preview: session.preview || 'Cuộc trò chuyện mới',
  };
}

export function useChat(userId: string | null): UseChatReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamingSessionIdRef = useRef<string | null>(null);

  const currentSession = sessions.find((session) => session.id === activeSessionId) || sessions[0] || null;

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

  const loadSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setActiveSessionId('');
      return;
    }

    const response = await chatService.listSessions();
    const nextSessions = response.sessions.map(mapSessionSummary);
    setSessions(nextSessions);
    setActiveSessionId((previous) => {
      if (previous && nextSessions.some((session) => session.id === previous)) {
        return previous;
      }
      return nextSessions[0]?.id || '';
    });
  }, [userId]);

  const loadHistory = useCallback(async (sessionId: string) => {
    const history = await chatService.getHistory(sessionId);
    updateSession(sessionId, (session) => ({
      ...session,
      messages: history.messages,
      updatedAt: new Date().toISOString(),
    }));
  }, [updateSession]);

  useEffect(() => {
    cleanupStream();
    setError(null);
    void loadSessions();
  }, [cleanupStream, loadSessions, userId]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    const targetSession = sessions.find((session) => session.id === activeSessionId);
    if (!targetSession) {
      return;
    }

    if (targetSession.messages.length === 0 && !targetSession.streaming) {
      void loadHistory(activeSessionId).catch((err: Error) => {
        setError(err.message);
      });
    }
  }, [activeSessionId, loadHistory, sessions]);

  const sendMessage = useCallback(async (message: string) => {
    if (!userId) {
      return;
    }

    cleanupStream();
    setError(null);

    let targetSession = currentSession;
    if (!targetSession) {
      const created = await chatService.newSession();
      targetSession = createDraftSession(created.session_id);
      setSessions([targetSession]);
      setActiveSessionId(created.session_id);
    }

    const sessionId = targetSession.id;
    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    if (!sessions.some((session) => session.id === sessionId)) {
      setSessions([targetSession]);
    }

    updateSession(sessionId, (session) => ({
      ...session,
      messages: [...session.messages, userMessage],
      streaming: true,
      preview: session.preview === 'Cuộc trò chuyện mới' ? message.slice(0, 60) : session.preview,
      updatedAt: new Date().toISOString(),
    }));

    streamingSessionIdRef.current = sessionId;

    try {
      let fullAnswer = '';

      eventSourceRef.current = new EventSource(chatService.streamUrlForSession(message, sessionId), {
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
          updateSession(sessionId, (session) => ({
            ...session,
            streaming: false,
            updatedAt: new Date().toISOString(),
          }));
          streamingSessionIdRef.current = null;
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          void loadSessions().catch(() => undefined);
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
  }, [cleanupStream, currentSession, loadSessions, sessions, updateSession, userId]);

  const switchToSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setError(null);
  }, []);

  const createNewChat = useCallback(async () => {
    if (!userId) {
      return;
    }

    cleanupStream();
    setError(null);

    try {
      const response = await chatService.newSession();
      const newSession = createDraftSession(response.session_id);
      setSessions((previous) => [newSession, ...previous]);
      setActiveSessionId(newSession.id);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [cleanupStream, userId]);

  const deleteSession = useCallback((sessionId: string) => {
    void (async () => {
      if (streamingSessionIdRef.current === sessionId) {
        cleanupStream();
      }

      try {
        await chatService.deleteSession(sessionId);
        setSessions((previous) => {
          const filtered = previous.filter((session) => session.id !== sessionId);
          if (sessionId === activeSessionId) {
            setActiveSessionId(filtered[0]?.id || '');
          }
          return filtered;
        });
      } catch (err) {
        setError((err as Error).message);
      }
    })();
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
