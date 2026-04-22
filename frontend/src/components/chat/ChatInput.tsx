import { useState, FormEvent, KeyboardEvent, ChangeEvent, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event as unknown as FormEvent<HTMLFormElement>);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
  };

  return (
    <div className="border-t border-gray-200 bg-white/80 backdrop-blur-xl transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                className="min-h-[52px] max-h-[200px] w-full resize-none rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 pr-12 leading-6 text-gray-900 transition-all duration-200 placeholder:text-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400"
                value={message}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Hãy nhập câu hỏi của bạn. Trợ lý sẽ tự tìm ngữ cảnh tài liệu phù hợp."
                disabled={disabled}
                rows={1}
              />

              {message.length > 0 && (
                <div className="absolute bottom-2 right-2 text-xs text-gray-400 dark:text-gray-500">
                  {message.length}
                </div>
              )}
            </div>

            <button
              type="submit"
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
                message.trim() && !disabled
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
              }`}
              disabled={disabled || !message.trim()}
            >
              {disabled ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Nhấn Enter để gửi, Shift + Enter để xuống dòng</span>
            {disabled && (
              <span className="flex items-center gap-1 text-blue-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Đang chờ phản hồi...
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
