import { useScrollToBottom } from '../../hooks/useScrollToBottom';
import { Message } from './Message';
import { StreamingIndicator } from './StreamingIndicator';
import type { Message as MessageType } from '../../types';

interface ChatMessagesProps {
  messages: MessageType[];
  streaming: boolean;
  sessionId: string;
}

export function ChatMessages({ messages, streaming, sessionId }: ChatMessagesProps) {
  const messagesEndRef = useScrollToBottom<HTMLDivElement>({
    dependencies: [messages, streaming, sessionId],
    behavior: 'smooth',
  });

  return (
    <div
      ref={messagesEndRef}
      className="chat-messages h-full overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8"
      key={sessionId}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {messages.length === 0 && !streaming && (
          <div className="animate-[fadeIn_0.5s_ease-out]">
            <div className="rounded-[2rem] bg-white px-6 py-6 text-gray-800 shadow-md dark:bg-gray-900 dark:text-gray-300">
              <p className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Hỏi tự nhiên, không cần chọn tài liệu.
              </p>
              <p className="mb-4">
                TLU Assistant sẽ tự động chọn ngữ cảnh tài liệu phù hợp. Bạn chỉ cần mô tả câu hỏi hoặc vấn đề cần hỗ trợ.
              </p>
              <ul className="ml-6 space-y-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                <li>Giải thích quy định, chính sách và điều khoản</li>
                <li>Câu hỏi về thủ tục, thời hạn và điều kiện áp dụng</li>
                <li>Đối chiếu thông tin giữa nhiều tài liệu nội bộ</li>
                <li>Tri thức do quản trị viên quản lý mà không cần người dùng biết tên file</li>
              </ul>
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const shouldAnimate =
            message.role === 'assistant' &&
            index === messages.length - 1 &&
            streaming;

          return (
            <Message
              key={`${sessionId}-msg-${index}`}
              message={message}
              index={index}
              skipTypewriter={!shouldAnimate}
            />
          );
        })}

        {streaming && <StreamingIndicator key={`${sessionId}-streaming`} />}
      </div>
    </div>
  );
}
