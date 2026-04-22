import { LogOut, MessageSquare, Moon, Plus, Shield, Sun } from 'lucide-react';
import type { HeaderProps } from '../../types';

export function Header({
  theme,
  onToggleTheme,
  onNewChat,
  user,
  currentView,
  onNavigate,
  onLogout,
}: HeaderProps) {
  return (
    <header className="relative flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 px-6 backdrop-blur-xl transition-all duration-300 dark:border-gray-800 dark:bg-gray-900/80">
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/20">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">TLU Assistant</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {user.role === 'admin' ? 'Không gian quản trị và trò chuyện an toàn' : 'Trợ lý trò chuyện an toàn theo vai trò'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden rounded-2xl bg-gray-100 p-1 dark:bg-gray-800 sm:flex">
          <button
            onClick={() => onNavigate('chat')}
            className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition ${
              currentView === 'chat'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            >
              <MessageSquare className="h-4 w-4" />
            Trò chuyện
          </button>
          {user.role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition ${
                currentView === 'admin'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Shield className="h-4 w-4" />
              Quản trị
            </button>
          )}
        </div>

        <button
          onClick={onToggleTheme}
          className="group flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 transition-all duration-300 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5 text-gray-700 transition-transform duration-500 group-hover:rotate-180 dark:text-gray-300" />
          ) : (
            <Moon className="h-5 w-5 text-gray-700 transition-transform duration-500 group-hover:-rotate-12 dark:text-gray-300" />
          )}
        </button>

        <button
          onClick={onNewChat}
          className="group flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 font-medium text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Cuộc trò chuyện mới</span>
        </button>

        <button
          onClick={onLogout}
          className="flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-700 transition hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:text-gray-200 dark:hover:border-red-400/40 dark:hover:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden lg:inline">{user.email || 'Đăng xuất'}</span>
        </button>
      </div>
    </header>
  );
}
