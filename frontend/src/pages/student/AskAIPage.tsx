import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';
import type { ChatMessage } from '../../types';

const WELCOME: ChatMessage = {
  role: 'assistant',
  content: "Hello! I'm CampusAssist AI 🎓 — your smart help desk assistant. I can help you with admissions, fees, exams, appointments, office locations, and more. How can I assist you today?",
  timestamp: new Date().toISOString(),
};

export default function AskAIPage() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);
    setLoading(true);
    try {
      const data = await aiApi.chat(text, sessionId);
      setSessionId(data.session_id);
      const aiMsg: ChatMessage = { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() };
      setMessages(m => [...m, aiMsg]);
    } catch {
      toast.error('Failed to get a response. Please try again.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => {
    setMessages([WELCOME]);
    setSessionId(undefined);
    inputRef.current?.focus();
  };

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U';

  return (
    <div style={{ height: 'calc(100vh - var(--header-height) - 4rem)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bot size={22} /> Ask AI Assistant
          </h1>
          <p className="page-subtitle">Get instant answers to your campus queries</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={clearChat}>
          <RefreshCw size={14} /> New Chat
        </button>
      </div>

      {/* Chat container */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-bubble-wrapper ${msg.role === 'user' ? 'user' : ''}`}>
              <div className={`chat-bubble-avatar ${msg.role === 'user' ? 'user-av' : 'bot-av'}`}>
                {msg.role === 'user' ? initials : <Bot size={14} />}
              </div>
              <div className={`chat-bubble ${msg.role}`}>{msg.content}</div>
            </div>
          ))}
          {loading && (
            <div className="chat-bubble-wrapper">
              <div className="chat-bubble-avatar bot-av"><Bot size={14} /></div>
              <div className="chat-bubble assistant">
                <div className="chat-typing">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Type your question… (Press Enter to send)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button className="chat-send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Quick prompts */}
      <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {['How do I register?', 'Where is the Finance office?', 'How do I get my transcript?', 'Book an appointment'].map(q => (
          <button
            key={q}
            className="btn btn-secondary btn-sm"
            onClick={() => { setInput(q); inputRef.current?.focus(); }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
