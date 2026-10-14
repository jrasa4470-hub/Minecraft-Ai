import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, GameMode, BlockType } from '../types/game';
import { audio } from '../engine/audio';

interface ChatBoxProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onExecuteCommand: (command: string, args: string[]) => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onExecuteCommand,
}) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      onClose();
      return;
    }

    const text = input.trim();
    setInput('');

    if (text.startsWith('/')) {
      // Command
      const parts = text.slice(1).split(' ');
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);
      onExecuteCommand(cmd, args);
    } else {
      // Normal chat
      onSendMessage(text);
    }

    onClose();
  };

  return (
    <div
      className={`absolute left-4 bottom-20 z-30 w-[460px] max-w-[90vw] flex flex-col transition-opacity ${
        isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-80'
      }`}
    >
      {/* Messages List */}
      <div
        ref={scrollRef}
        className={`max-h-48 overflow-y-auto flex flex-col gap-1 p-2 rounded-xs font-mono text-xs select-none ${
          isOpen ? 'bg-black/70 border border-white/20' : 'bg-transparent'
        }`}
      >
        {messages.slice(-10).map((msg) => (
          <div key={msg.id} className="leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
            {msg.isSystem ? (
              <span className="text-yellow-300 italic">{msg.text}</span>
            ) : (
              <>
                <span className="text-zinc-400 font-bold">&lt;{msg.sender}&gt; </span>
                <span className="text-white">{msg.text}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Input Bar (only when open) */}
      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-1 flex gap-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message or /command (e.g. /help)..."
            className="flex-1 bg-black/85 text-white border border-white/40 px-2 py-1 text-xs font-mono rounded-xs focus:outline-none focus:border-amber-400"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
              }
            }}
          />
          <button
            type="submit"
            className="mc-button px-3 py-1 text-xs font-bold"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
};
