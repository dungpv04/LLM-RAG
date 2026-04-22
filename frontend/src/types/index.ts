export interface Source {
  document?: string;
  page_range: string;
  content: string;
  similarity: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  strategy?: 'single-hop' | 'multi-hop' | string;
  strategy_reasoning?: string;
  timestamp?: string;
  isFromHistory?: boolean;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  streaming: boolean;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

export interface HistoryItem {
  id: number;
  timestamp: string;
  preview: string;
  userMessage: string;
  assistantResponse: string;
  sources: Source[];
}

export interface ChatResponse {
  session_id: string;
  answer: string;
  strategy?: 'single-hop' | 'multi-hop' | string;
  strategy_reasoning?: string;
  sources: Source[];
}

export interface StreamData {
  type: 'token' | 'metadata' | 'done' | 'error';
  content?: string;
  message?: string;
  session_id?: string;
  sources?: Source[];
  strategy?: 'single-hop' | 'multi-hop' | string;
  strategy_reasoning?: string;
}

export interface AuthUser {
  id: string;
  email?: string | null;
  role: 'admin' | 'user' | string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
}

export interface AuthResponse {
  access_token?: string | null;
  refresh_token?: string | null;
  token_type: string;
  expires_in?: number | null;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}

export interface DocumentSummary {
  document_name: string;
  chunks_count: number;
  storage_path?: string | null;
  public_url?: string | null;
  page_count?: number | null;
  created_at?: string | null;
}

export interface DocumentContent {
  document_name: string;
  content: string;
  chunks_count: number;
  storage_path?: string | null;
  public_url?: string | null;
  pages: number[];
}

export interface DocumentAdminListResponse {
  documents: DocumentSummary[];
  count: number;
}

export interface DocumentUploadResponse {
  status: string;
  document_name: string;
  chunks_processed: number;
  storage_path: string;
  public_url?: string | null;
}

export interface DocumentDeleteResponse {
  status: string;
  document_name: string;
  message: string;
}

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export interface ChatMessagesProps {
  messages: Message[];
  streaming: boolean;
  sessionId: string;
}

export interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNewChat: () => void;
  user: AuthUser;
  currentView: 'chat' | 'admin';
  onNavigate: (view: 'chat' | 'admin') => void;
  onLogout: () => void;
}

export interface HistoryPanelProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export interface MessageProps {
  message: Message;
  index: number;
  skipTypewriter?: boolean;
}

export interface UseDocumentsReturn {
  documents: string[];
  currentDocument: string | null;
  selectDocument: (docName: string) => void;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export interface UseChatReturn {
  sessions: ChatSession[];
  activeSessionId: string;
  currentSession: ChatSession | null;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  switchToSession: (sessionId: string) => void;
  createNewChat: () => void;
  deleteSession: (sessionId: string) => void;
}

export interface UseThemeReturn {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}
