"use client";

import { useState, useRef, useEffect } from "react";
import { ChatBubble } from "./ChatBubble";
import { TypingIndicator } from "./TypingIndicator";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatThreadProps {
  agent: "raj" | "prachi";
  initialMessages?: Message[];
  conversationId?: string;
  isInterviewMode?: boolean;
  placeholder?: string;
}

export function ChatThread({
  agent,
  initialMessages = [],
  conversationId: initialConversationId,
  isInterviewMode = false,
  placeholder,
}: ChatThreadProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setError(null);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const endpoint = agent === "raj" ? "/api/agents/raj" : "/api/agents/prachi";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as { error?: string };
        throw new Error(errData.error ?? "Something went wrong");
      }

      const data = (await res.json()) as {
        message: string;
        conversationId: string;
      };

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.message },
      ]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to connect. Try again.";
      setError(msg);
      // Remove the optimistically added user message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const defaultPlaceholder =
    agent === "raj"
      ? "Message Raj..."
      : "Message Prachi...";

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 pb-2"
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${agent === "raj" ? "Raj" : "Prachi"}`}
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Start a conversation
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            agent={agent}
            isInterviewMode={isInterviewMode && msg.role === "assistant"}
          />
        ))}
        {isLoading && <TypingIndicator agent={agent} />}
        {error && (
          <div className="text-center text-red-500 text-sm py-2 bg-red-50 rounded-lg mx-4">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 px-4 py-3 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? defaultPlaceholder}
            disabled={isLoading}
            rows={1}
            className={`flex-1 resize-none rounded-2xl border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 disabled:opacity-50 max-h-32 overflow-y-auto ${
              agent === "raj"
                ? "border-gray-200 focus:ring-amber-400 focus:border-amber-400"
                : "border-gray-200 focus:ring-blue-400 focus:border-blue-400"
            }`}
            style={{ lineHeight: "1.5" }}
            aria-label="Message input"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              agent === "raj"
                ? "bg-amber-600 hover:bg-amber-700 text-white focus-visible:ring-amber-500"
                : "bg-[#1E3A5F] hover:bg-[#162d4a] text-white focus-visible:ring-blue-500"
            }`}
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
