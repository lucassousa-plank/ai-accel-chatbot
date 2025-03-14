'use client';

import { useChat, Message } from '@ai-sdk/react';
import { Button } from '@/app/components/ui/button';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function ChatInterface() {
  const [threadId, setThreadId] = useState<string>('');

  useEffect(() => {
    // Generate a new thread ID when the component mounts
    setThreadId(uuidv4());
  }, []);

  const { messages, input, handleInputChange, handleSubmit, status, error, setMessages } = useChat({
    api: '/api/chat',
    body: {
      thread_id: threadId
    },
    onResponse: async (response: Response) => {
      if (!response.ok) {
        console.error('Response not ok:', response.status, response.statusText);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        console.error('No reader available');
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(Boolean);
          
          for (const line of lines) {
            if (line.includes('[DONE]')) continue;
            
            const data = line.replace(/^0:/, '');
            try {
              const parsed = JSON.parse(data);
              setMessages((currentMessages) => {
                const filteredMessages = currentMessages.filter(m => m.id !== parsed.id);
                return [...filteredMessages, parsed];
              });
            } catch (e) {
              console.error('Error parsing chunk:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error reading stream:', error);
      } finally {
        reader.releaseLock();
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
    }
  });

  const clearHistory = async () => {
    if (!threadId) return;
    
    try {
      const response = await fetch("/api/chat/clear", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ thread_id: threadId })
      });
      
      if (!response.ok) {
        throw new Error("Failed to clear chat history");
      }
      
      // Clear local state
      setMessages([]);
      // Generate new thread ID for next conversation
      setThreadId(uuidv4());
    } catch (error) {
      console.error("Error clearing chat history:", error);
    }
  };

  return (
    <div className="flex flex-col h-[80vh] w-full max-w-2xl mx-auto p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <Button 
          variant="outline" 
          size="icon"
          onClick={clearHistory}
          className="text-red-500 hover:text-red-700"
        >
          Clear
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((message: Message) => (
          message.role !== 'system' && (
            <div
              key={message.id}
              className={`flex pr-2 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            </div>
          )
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 
            bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
            placeholder-gray-500 dark:placeholder-gray-400
            rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={status === 'submitted' || status === 'streaming'}
        />
        <Button
          type="submit"
          disabled={status === 'submitted' || status === 'streaming'}
        >
          Send
        </Button>
      </form>
    </div>
  );
} 