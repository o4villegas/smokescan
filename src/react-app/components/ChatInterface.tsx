/**
 * ChatInterface Component
 * Follow-up conversation about the assessment
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Loader2, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownContent } from './MarkdownContent';

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
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="flex flex-row items-center gap-4 space-y-0 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Report
        </Button>
        <CardTitle className="text-lg">Follow-up Questions</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {/* Welcome message when no messages */}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-6">
              Ask questions about your assessment report.
            </p>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Suggested questions:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedQuestions.map((q, index) => (
                  <button
                    key={index}
                    onClick={() => setInput(q)}
                    className="text-left text-sm px-3 py-2 rounded-lg border border-border bg-muted/50 hover:bg-muted hover:border-primary/50 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              'flex',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-2',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}
            >
              {message.role === 'assistant' ? (
                <MarkdownContent className="text-sm">{message.content}</MarkdownContent>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-3">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      {/* Input form */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your assessment..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}
