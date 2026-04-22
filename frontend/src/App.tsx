import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  FileText,
  Loader2,
  LogIn,
  Shield,
  Upload,
} from 'lucide-react';
import { Header } from './components/layout/Header';
import { ChatContainer } from './components/chat/ChatContainer';
import { HistoryPanel } from './components/history/HistoryPanel';
import { useChat } from './hooks/useChatManager';
import { useTheme } from './hooks/useTheme';
import { authService } from './services/authService';
import { documentService } from './services/documentService';
import type {
  AuthUser,
  DocumentContent,
  DocumentSummary,
  Source,
} from './types';

type AuthMode = 'login' | 'signup';
type ViewMode = 'chat' | 'admin';

function AuthScreen({
  mode,
  loading,
  error,
  onModeChange,
  onSubmit,
  theme,
  onToggleTheme,
}: {
  mode: AuthMode;
  loading: boolean;
  error: string | null;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (payload: { email: string; password: string; fullName?: string }) => Promise<void>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      email,
      password,
      fullName: mode === 'signup' ? fullName.trim() || undefined : undefined,
    });
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="fixed inset-0 bg-white dark:bg-gray-950 transition-colors duration-300" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.20),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(8,145,178,0.16),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(8,145,178,0.14),transparent_28%)]" />

      <div className="relative z-10 min-h-screen px-6 py-8">
        <div className="mx-auto flex max-w-6xl justify-end">
          <button
            onClick={onToggleTheme}
            className="rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-sm text-gray-700 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-200"
          >
            {theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
          </button>
        </div>

        <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
              <Shield className="h-4 w-4" />
              Truy cập an toàn theo vai trò
            </div>

            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-5xl">
                TLU Assistant hỗ trợ hỏi đáp cho người dùng và quản lý tài liệu cho quản trị viên.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-gray-600 dark:text-gray-300 sm:text-lg">
                Người dùng chỉ cần đăng nhập và đặt câu hỏi. Quản trị viên có thêm công cụ tải lên,
                kiểm tra và quản lý kho tài liệu đứng sau trợ lý.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-gray-200 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Trải nghiệm chat mượt hơn</p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Giao diện được tối ưu để người dùng tập trung vào câu hỏi và phản hồi.
                </p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Không cần chọn tài liệu</p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Người dùng chỉ gửi câu hỏi. Hệ thống sẽ tự tìm tài liệu phù hợp ở phía sau.
                </p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Quản trị tập trung</p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Tải lên PDF, xem nội dung trích xuất và xóa tài liệu ngay trên một màn hình.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-6 shadow-2xl shadow-blue-500/10 backdrop-blur dark:border-gray-800 dark:bg-gray-900/85 dark:shadow-black/30 sm:p-8">
            <div className="mb-6 flex rounded-2xl bg-gray-100 p-1 dark:bg-gray-800">
              <button
                onClick={() => onModeChange('login')}
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  mode === 'login'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                Đăng nhập
              </button>
              <button
                onClick={() => onModeChange('signup')}
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  mode === 'signup'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                Tạo tài khoản
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Họ và tên
                  </span>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    placeholder="Nguyen Van A"
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Mật khẩu
                  </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="Tối thiểu 6 ký tự"
                  required
                />
              </label>

              {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-600 font-medium text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-600 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {mode === 'login' ? 'Đăng nhập để tiếp tục' : 'Tạo tài khoản'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function SideInsights({ latestSources }: { latestSources: Source[] }) {
  return (
    <aside className="hidden w-[300px] border-r border-gray-200 bg-gray-50/80 transition-colors dark:border-gray-800 dark:bg-gray-900/60 lg:block">
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-200 px-5 py-5 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Cách trợ lý hoạt động</p>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Bạn chỉ cần hỏi tự nhiên. Hệ thống sẽ tự chọn tài liệu liên quan và trả lời kèm nguồn tham chiếu.
          </p>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
              Trải nghiệm mới
            </p>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>Đặt câu hỏi trực tiếp mà không cần chọn tài liệu.</li>
              <li>Giao diện phân theo vai trò cho người dùng và quản trị viên.</li>
              <li>Đăng nhập bằng cookie để các API bảo vệ hoạt động ngay trên trình duyệt.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Trích dẫn gần đây</p>
            {latestSources.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Nguồn tham chiếu của câu trả lời gần nhất sẽ hiển thị ở đây.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {latestSources.slice(0, 4).map((source, index) => (
                  <div
                    key={`${source.document || 'source'}-${index}`}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/80"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {source.document || `Nguồn ${index + 1}`}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Trang {source.page_range || 'N/A'}
                    </p>
                    <p className="mt-2 line-clamp-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
                      {source.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function AdminView({
  documents,
  loading,
  uploadLoading,
  selectedDocument,
  documentContent,
  contentLoading,
  error,
  onRefresh,
  onUpload,
  onSelectDocument,
  onDeleteDocument,
}: {
  documents: DocumentSummary[];
  loading: boolean;
  uploadLoading: boolean;
  selectedDocument: string | null;
  documentContent: DocumentContent | null;
  contentLoading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onSelectDocument: (name: string) => Promise<void>;
  onDeleteDocument: (name: string) => Promise<void>;
}) {
  return (
    <div className="flex-1 overflow-hidden bg-white transition-colors dark:bg-gray-950">
      <div className="grid h-full min-h-0 xl:grid-cols-[360px_1fr]">
        <div className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900/60 xl:border-b-0 xl:border-r">
          <div className="flex h-full flex-col">
            <div className="border-b border-gray-200 px-5 py-5 dark:border-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tài liệu quản trị</h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    Tải lên PDF, kiểm tra nội dung trích xuất và xóa tài liệu không còn dùng.
                  </p>
                </div>
                <button
                  onClick={() => {
                    void onRefresh();
                  }}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:border-blue-500 hover:text-blue-600 dark:border-gray-700 dark:text-gray-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
                >
                  Làm mới
                </button>
              </div>

              <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-blue-300 bg-blue-50 px-4 py-4 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15">
                {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploadLoading ? 'Đang tải lên...' : 'Tải lên PDF'}
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void onUpload(file);
                      event.target.value = '';
                    }
                  }}
                />
              </label>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {loading ? (
                <div className="flex h-32 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tải danh sách tài liệu...
                </div>
              ) : documents.length === 0 ? (
                <div className="rounded-3xl border border-gray-200 bg-white p-5 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                  Chưa có tài liệu nào.
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((document) => (
                    <div
                      key={document.document_name}
                      className={`rounded-3xl border p-4 transition ${
                        selectedDocument === document.document_name
                          ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
                          : 'border-gray-200 bg-white hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700'
                      }`}
                    >
                      <button
                        onClick={() => {
                          void onSelectDocument(document.document_name);
                        }}
                        className="w-full text-left"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 rounded-2xl bg-gray-100 p-2 dark:bg-gray-800">
                            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                              {document.document_name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {document.chunks_count} đoạn dữ liệu
                              {document.page_count ? ` • ${document.page_count} trang` : ''}
                            </p>
                            {document.created_at && (
                              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                Thêm lúc {new Date(document.created_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="mt-4 flex gap-2">
                        {document.public_url && (
                          <a
                            href={document.public_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-blue-500 hover:text-blue-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-300"
                          >
                            Mở PDF
                          </a>
                        )}
                        <button
                          onClick={() => {
                            void onDeleteDocument(document.document_name);
                          }}
                          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/20 dark:text-red-300 dark:hover:bg-red-500/10"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-6">
          {contentLoading ? (
            <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang tải nội dung trích xuất...
            </div>
          ) : documentContent ? (
            <div className="mx-auto max-w-4xl">
              <div className="rounded-[2rem] border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/70">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-semibold text-gray-950 dark:text-white">
                    {documentContent.document_name}
                  </h3>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                    {documentContent.chunks_count} đoạn dữ liệu
                  </span>
                  {documentContent.pages.length > 0 && (
                    <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {documentContent.pages.length} trang đã lập chỉ mục
                    </span>
                  )}
                </div>

                <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
                  <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700 dark:text-gray-200">
                    {documentContent.content}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center">
              <div className="max-w-md rounded-[2rem] border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-800 dark:bg-gray-900/60">
                <FileText className="mx-auto h-10 w-10 text-blue-600 dark:text-blue-300" />
                <p className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Hãy chọn một tài liệu để xem chi tiết
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  Khu vực này hiển thị nội dung trích xuất dùng cho truy xuất, giúp quản trị viên kiểm tra chất lượng dữ liệu tải lên.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    sessions,
    activeSessionId,
    currentSession,
    error: chatError,
    sendMessage,
    switchToSession,
    createNewChat,
    deleteSession,
  } = useChat();

  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState<ViewMode>('chat');

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<DocumentContent | null>(null);
  const [documentContentLoading, setDocumentContentLoading] = useState(false);

  const latestSources = useMemo(() => {
    const messages = currentSession?.messages ?? [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'assistant' && message.sources?.length) {
        return message.sources;
      }
    }
    return [];
  }, [currentSession]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const me = await authService.me();
        setUser(me.user);
      } catch {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!user) {
      setView('chat');
      return;
    }

    if (user.role !== 'admin' && view === 'admin') {
      setView('chat');
    }
  }, [user, view]);

  const loadAdminDocuments = async () => {
    if (user?.role !== 'admin') {
      return;
    }

    setDocumentsLoading(true);
    setAdminError(null);

    try {
      const nextDocuments = await documentService.listAdmin();
      setDocuments(nextDocuments);

      if (selectedDocument) {
        const stillExists = nextDocuments.some((item) => item.document_name === selectedDocument);
        if (!stillExists) {
          setSelectedDocument(null);
          setDocumentContent(null);
        }
      }
    } catch (error) {
      setAdminError((error as Error).message);
    } finally {
      setDocumentsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' && view === 'admin') {
      void loadAdminDocuments();
    }
  }, [user?.role, view]);

  const handleAuthSubmit = async (payload: {
    email: string;
    password: string;
    fullName?: string;
  }) => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      const response =
        authMode === 'login'
          ? await authService.login(payload.email, payload.password)
          : await authService.signup(payload.email, payload.password, payload.fullName);

      setUser(response.user);
      setView('chat');
    } catch (error) {
      setAuthError((error as Error).message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setAuthMode('login');
      setView('chat');
      setDocuments([]);
      setSelectedDocument(null);
      setDocumentContent(null);
    }
  };

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  const handleUploadDocument = async (file: File) => {
    setUploadLoading(true);
    setAdminError(null);

    try {
      const uploaded = await documentService.upload(file);
      await loadAdminDocuments();
      await handleSelectDocument(uploaded.document_name);
    } catch (error) {
      setAdminError((error as Error).message);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSelectDocument = async (documentName: string) => {
    setSelectedDocument(documentName);
    setDocumentContentLoading(true);
    setAdminError(null);

    try {
      const content = await documentService.getContent(documentName);
      setDocumentContent(content);
    } catch (error) {
      setAdminError((error as Error).message);
    } finally {
      setDocumentContentLoading(false);
    }
  };

  const handleDeleteDocument = async (documentName: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa "${documentName}" không?`)) {
      return;
    }

    setAdminError(null);

    try {
      await documentService.delete(documentName);
      if (selectedDocument === documentName) {
        setSelectedDocument(null);
        setDocumentContent(null);
      }
      await loadAdminDocuments();
    } catch (error) {
      setAdminError((error as Error).message);
    }
  };

  if (authLoading && !user) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${theme === 'dark' ? 'dark' : ''}`}>
        <div className="fixed inset-0 bg-white dark:bg-gray-950" />
        <div className="relative z-10 flex items-center gap-3 rounded-3xl border border-gray-200 bg-white px-6 py-4 text-sm text-gray-700 shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          Đang kiểm tra phiên đăng nhập...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        mode={authMode}
        loading={authLoading}
        error={authError}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError(null);
        }}
        onSubmit={handleAuthSubmit}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className={`h-screen w-full overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="fixed inset-0 bg-white dark:bg-gray-950 transition-colors duration-300" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(8,145,178,0.12),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(8,145,178,0.10),transparent_24%)]" />

      <div className="relative z-10 flex h-full flex-col">
        <Header
          theme={theme}
          onToggleTheme={toggleTheme}
          onNewChat={createNewChat}
          user={user}
          currentView={view}
          onNavigate={setView}
          onLogout={handleLogout}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {view === 'chat' ? (
            <>
              <SideInsights latestSources={latestSources} />

              <div className="min-w-0 flex-1">
                {currentSession ? (
                  <ChatContainer
                    messages={currentSession.messages}
                    streaming={currentSession.streaming}
                    onSendMessage={handleSendMessage}
                    sessionId={activeSessionId}
                  />
                ) : null}
              </div>

              <div className="hidden w-[320px] border-l border-gray-200 dark:border-gray-800 xl:block">
                <HistoryPanel
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  onSelectSession={switchToSession}
                  onDeleteSession={deleteSession}
                />
              </div>
            </>
          ) : (
            <AdminView
              documents={documents}
              loading={documentsLoading}
              uploadLoading={uploadLoading}
              selectedDocument={selectedDocument}
              documentContent={documentContent}
              contentLoading={documentContentLoading}
              error={adminError}
              onRefresh={loadAdminDocuments}
              onUpload={handleUploadDocument}
              onSelectDocument={handleSelectDocument}
              onDeleteDocument={handleDeleteDocument}
            />
          )}
        </div>

        {(chatError || adminError) && view === 'chat' && (
          <div className="fixed bottom-4 right-4 z-50 rounded-2xl bg-red-500 px-4 py-3 text-white shadow-lg">
            <p className="text-sm font-medium">{chatError || adminError}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
