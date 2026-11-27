import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Lightbulb,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

interface JetBotAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  isMobile?: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  modelBadge?: string;
}

const SAMPLE_QUESTIONS = [
  'Tại sao JetBot dùng 2 bánh chủ động và bánh xe xoay tự do (Differential Drive)?',
  'Nguyên lý hoạt động của RPLIDAR và vai trò trong việc lập bản đồ 2D SLAM?',
  'Ưu điểm của Camera CSI MIPI so với Camera cắm cổng USB trên Jetson Nano?',
  'Mạch điều khiển động cơ giao tiếp với Jetson Nano và bảo vệ bo mạch như thế nào?',
  'Code Python mẫu điều khiển động cơ JetBot tiến, lùi và quay tại chỗ?'
];

export const JetBotAIModal: React.FC<JetBotAIModalProps> = ({
  isOpen,
  onClose,
  initialQuery,
  isMobile = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'Xin chào! Tôi là Trợ lý AI Kỹ thuật CMU JetBot. Bạn có thể hỏi tôi bất kỳ câu hỏi nào về 9 linh kiện cấu tạo nên JetBot, nguyên lý hoạt động, lập trình ROS/OpenCV hoặc các bài thực hành môn CMU Lớp 10A.',
      modelBadge: 'CMU JetBot AI Advisor',
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialQuery) {
      handleSend(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToSend }),
      });
      const data = await res.json();
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: data.reply || 'Xin lỗi, không thể xử lý câu trả lời lúc này.',
        modelBadge: data.model || 'Gemini AI',
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: 'Đã xảy ra lỗi kết nối mạng. Bạn có thể thử lại sau giây lát.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isMobile ? 'p-2' : 'p-3 sm:p-6'} bg-slate-950/80 backdrop-blur-md`}>
      <div
        className={`w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
          isMobile ? 'h-[92dvh] max-h-[92dvh]' : 'h-[600px] max-h-[90vh]'
        }`}
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between ${isMobile ? 'px-3.5 py-2.5' : 'px-5 py-3.5'} bg-slate-950 border-b border-slate-800`}>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Hỏi Đáp Kỹ Thuật Robot JetBot</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded">
                  CMU 10A AI
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Giải đáp chi tiết cấu tạo, cảm biến, thị giác máy tính và lập trình tự hành
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] text-slate-400 shrink-0">Gợi ý:</span>
          {SAMPLE_QUESTIONS.slice(0, 3).map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer shrink-0 border border-slate-700/60"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'bot' && (
                <div className="w-7 h-7 rounded-lg bg-emerald-600/30 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-none shadow-md'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-bl-none shadow'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                {msg.modelBadge && (
                  <div className="mt-2 pt-1 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {msg.modelBadge}
                    </span>
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-700 text-slate-200 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 w-max">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>AI đang suy luận câu trả lời kỹ thuật...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-950 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Nhập câu hỏi về JetBot, Jetson Nano, RPLIDAR, động cơ..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Gửi</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
