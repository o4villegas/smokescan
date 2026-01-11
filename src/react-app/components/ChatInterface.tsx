/**
 * ChatInterface Component
 * Follow-up conversation about the assessment
 */

import { useState, useRef, useEffect } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatInterfaceProps = {
  messages: Message[];
  onSendMessage: (message: string) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
};

export function ChatInterface({
  messages,
  onSendMessage,
  onBack,
  isLoading,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await onSendMessage(message);
  };

  const suggestedQuestions = [
    'What are the most critical areas to address first?',
    'What sampling should be done according to FDAM?',
    'Explain the zone classification in more detail.',
    'What cleaning methods are recommended?',
  ];

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to Report
        </button>
        <h2>Follow-up Questions</h2>
      </div>

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <p>Ask questions about your assessment report.</p>
            <div className="suggested-questions">
              <p className="suggestions-label">Suggested questions:</p>
              {suggestedQuestions.map((q, index) => (
                <button
                  key={index}
                  className="suggestion-btn"
                  onClick={() => setInput(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="message-content">{message.content}</div>
          </div>
        ))}

        {isLoading && (
          <div className="message assistant loading">
            <div className="message-content">
              <span className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your assessment..."
          disabled={isLoading}
        />
        <button
          type="submit"
          className="send-btn"
          disabled={!input.trim() || isLoading}
        >
          Send
        </button>
      </form>
    </div>
  );
}
