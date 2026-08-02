import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, RefreshCw, Mic } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi, streamChat } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';
import type { ChatMessage } from '../../types';

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    "Hello! I'm CampusAssist AI 🎓 — your smart university help desk assistant. " +
    "I can answer questions about offices, fees, exams, documents, appointments, and more — " +
    "all from real university data. How can I help you today?",
  timestamp: new Date().toISOString(),
};

const QUICK_PROMPTS = [
  'How do I register for a new semester?',
  'Where is the Finance office?',
  'What documents do I need for accommodation?',
  'How do I get my transcript?',
  'Book an appointment',
];

export default function AskAIPage() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);   // waiting for first token
  const [streaming, setStreaming] = useState(false); // tokens arriving
  const [sessionId, setSessionId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll on every new message or token
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading || streaming) return;

    setInput('');
    setLoading(true);

    // Push user message immediately
    const userMsg: ChatMessage = { role: 'user', content: msg, timestamp: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);

    // Try SSE streaming first
    let streamStarted = false;

    abortRef.current = streamChat(
      msg,
      sessionId,
      // onToken — first token: stop spinner, push empty AI bubble, set streaming=true
      (token) => {
        if (!streamStarted) {
          streamStarted = true;
          setLoading(false);
          setStreaming(true);
          setMessages(m => [
            ...m,
            { role: 'assistant', content: token, timestamp: new Date().toISOString() },
          ]);
        } else {
          // Append token to last message
          setMessages(m => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, content: last.content + token };
            return copy;
          });
        }
      },
      // onDone
      (sid) => {
        setSessionId(sid);
        setStreaming(false);
        setLoading(false);
        inputRef.current?.focus();
      },
      // onError — fall back to non-streaming
      async (err) => {
        console.warn('SSE stream failed, falling back to /chat:', err);
        setLoading(true);
        setStreaming(false);
        try {
          const data = await aiApi.chat(msg, sessionId);
          setSessionId(data.session_id);
          setMessages(m => [
            ...m,
            { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() },
          ]);
        } catch {
          toast.error('Failed to get a response. Please try again.');
          // Remove the user message if we couldn't get a reply at all
          setMessages(m => m.filter((_, i) => i !== m.length - 1));
        } finally {
          setLoading(false);
          inputRef.current?.focus();
        }
      },
    );
  }, [input, loading, streaming, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([WELCOME]);
    setSessionId(undefined);
    setLoading(false);
    setStreaming(false);
    setInput('');
    inputRef.current?.focus();
  };

  const initials =
    user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U';

  const isThinking = loading && !streaming;

  return (
    <div style={{ height: 'calc(100vh - var(--header-height) - 4rem)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bot size={22} /> Ask AI Assistant
          </h1>
          <p className="page-subtitle">Powered by Google Gemini · Answers from university data</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={clearChat}>
          <RefreshCw size={14} /> New Chat
        </button>
      </div>

      {/* Chat window */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="chat-messages">
          {messages.map((msg, i) => {
            const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1;
            const showCursor = isLastAssistant && streaming;
            return (
              <div key={i} className={`chat-bubble-wrapper ${msg.role === 'user' ? 'user' : ''}`}>
                <div className={`chat-bubble-avatar ${msg.role === 'user' ? 'user-av' : 'bot-av'}`}>
                  {msg.role === 'user' ? initials : <Bot size={14} />}
                </div>
                <div className={`chat-bubble ${msg.role}`}>
                  {/* Render newlines as <br/> */}
                  {msg.content.split('\n').map((line, li) => (
                    <React.Fragment key={li}>
                      {line}
                      {li < msg.content.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                  {showCursor && <span className="chat-cursor" />}
                </div>
              </div>
            );
          })}

          {/* Three-dot spinner while waiting for first token */}
          {isThinking && (
            <div className="chat-bubble-wrapper">
              <div className="chat-bubble-avatar bot-av"><Bot size={14} /></div>
              <div className="chat-bubble assistant">
                <div className="chat-typing"><span /><span /><span /></div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Ask anything about university services… (Enter to send)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading || streaming}
          />

          {/* Voice button — placeholder, coming soon */}
          <button
            className="chat-send-btn"
            disabled
            title="Voice input — coming soon"
            style={{ opacity: 0.35, marginRight: '0.25rem' }}
          >
            <Mic size={16} />
          </button>

          <button
            className="chat-send-btn"
            onClick={() => sendMessage()}
            disabled={loading || streaming || !input.trim()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Quick-prompt chips */}
      <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {QUICK_PROMPTS.map(q => (
          <button
            key={q}
            className="btn btn-secondary btn-sm"
            disabled={loading || streaming}
            onClick={() => sendMessage(q)}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
