'use client';

import { useChat, Message } from '@ai-sdk/react';
import { useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { ThemeProvider, createTheme } from '@mui/material/styles';

interface ExtendedMessage extends Message {
  metadata?: {
    invokedAgents: string[];
    currentAgent?: string;
    isThinking?: boolean;
  };
}

export default function ChatInterface() {
  const [threadId, setThreadId] = useState<string>('');
  const [localInput, setLocalInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getAgentChips = (message: ExtendedMessage) => {
    const invokedAgents = message.metadata?.invokedAgents || [];
    const agentLabels: { [key: string]: { label: string, color: "primary" | "info" | "success" } } = {
      'chatbot': { label: "Nandor the Relentless", color: "primary" },
      'weather_reporter': { label: "Consulted Weather Agent", color: "info" },
      'news_reporter': { label: "Consulted News Agent", color: "success" }
    };

    // First, get all the chips
    const chips = invokedAgents
      .map((agent: string) => agentLabels[agent])
      .filter(Boolean);

    // Sort the array to put Nandor first
    return chips.sort((a, b) => {
      if (a.label === "Nandor the Relentless") return -1;
      if (b.label === "Nandor the Relentless") return 1;
      return 0;
    });
  };

  // Create a custom MUI theme to match our vampire aesthetic
  const muiTheme = createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#9333ea', // purple-600 for Nandor
      },
      info: {
        main: '#0ea5e9', // sky-500 for Weather
      },
      success: {
        main: '#22c55e', // green-500 for News
      },
      warning: {
        main: '#dc2626', // blood red for thinking state
      },
      error: {
        main: '#ef4444', // red-500
      },
      background: {
        default: '#1f2937',
        paper: '#111827',
      },
      text: {
        primary: '#f3f4f6',
        secondary: '#9ca3af',
      },
    },
    typography: {
      fontFamily: 'var(--font-cinzel)',
      button: {
        textTransform: 'none',
        fontSize: '1.125rem',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderWidth: '2px',
            '&:hover': {
              borderWidth: '2px',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontFamily: 'var(--font-cinzel)',
            fontSize: '0.75rem',
            fontWeight: 700,
          },
          outlined: {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          },
        },
      },
    },
  });

  useEffect(() => {
    // Generate a new thread ID when the component mounts
    setThreadId(uuidv4());
  }, []);

  const { messages, status, error, setMessages } = useChat({
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]); // Scroll when messages change

  const handleCustomSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!localInput.trim()) return;

    // Add user message
    const userMessage: ExtendedMessage = {
      id: uuidv4(),
      content: localInput,
      role: 'user'
    };

    // Clear input immediately after submission
    setLocalInput('');

    // Add initial assistant message with thinking state
    const assistantMessage: ExtendedMessage = {
      id: uuidv4(),
      content: '',
      role: 'assistant',
      metadata: {
        isThinking: true,
        invokedAgents: []
      }
    };

    setMessages((messages) => [...messages, userMessage, assistantMessage]);

    // Make the API call
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          thread_id: threadId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

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
              const filteredMessages = currentMessages.filter(m => m.id !== parsed.id && m.id !== assistantMessage.id);
              return [...filteredMessages, parsed];
            });
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error in chat:', error);
    }
  };

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
    <ThemeProvider theme={muiTheme}>
      <div className="flex flex-col h-[80vh] w-full max-w-2xl mx-auto p-6 bg-gray-900/50 backdrop-blur-sm rounded-lg shadow-2xl border border-purple-900/50">
        <div className="flex justify-end mb-8 pb-4 border-b border-purple-900/30">
          <Button 
            variant="outlined"
            onClick={clearHistory}
            color="error"
            size="small"
            sx={{
              px: 2,
              fontSize: '0.875rem',
              borderColor: 'rgba(127, 29, 29, 0.5)',
              '&:hover': {
                borderColor: 'rgba(127, 29, 29, 0.8)',
                backgroundColor: 'rgba(127, 29, 29, 0.1)',
              },
            }}
          >
            Clear conversation
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto mb-6 space-y-6 scrollbar-thin scrollbar-thumb-purple-900/50 scrollbar-track-gray-900/30 pr-4">
          {messages.map((message: ExtendedMessage) => (
            message.role !== 'system' && (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                } animate-in fade-in slide-in-from-bottom duration-300`}
              >
                <div 
                  className={`flex flex-col max-w-[80%] ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                      {message.metadata?.isThinking ? (
                        <Chip
                          label="Consulting the Dark Powers..."
                          variant="outlined"
                          size="small"
                          color="warning"
                          sx={{
                            borderColor: 'rgba(220, 38, 38, 0.5)', // blood red with opacity
                            '& .MuiChip-label': {
                              color: '#dc2626', // blood red text
                            }
                          }}
                        />
                      ) : (
                        getAgentChips(message).map((chip, index) => (
                          <Chip
                            key={index}
                            label={chip.label}
                            variant="outlined"
                            size="small"
                            color={chip.color}
                          />
                        ))
                      )}
                    </Stack>
                  )}
                  <div
                    className={`rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-purple-900/75 text-purple-50 shadow-purple-900/20'
                        : 'bg-gray-800/75 text-red-50 border border-red-900/20'
                    } shadow-lg font-inter backdrop-blur-sm`}
                  >
                    {message.content}
                  </div>
                </div>
              </div>
            )
          ))}
          <div ref={messagesEndRef} /> {/* Scroll anchor */}
        </div>

        <form onSubmit={handleCustomSubmit} className="flex gap-3">
          <input
            type="text"
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            placeholder="Ask your question..."
            className="flex-1 p-3 bg-gray-800/50 border border-purple-900/50 text-gray-100
              placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 
              focus:ring-purple-500/50 focus:border-transparent font-inter
              backdrop-blur-sm transition-all duration-200"
            disabled={status === 'submitted' || status === 'streaming'}
          />
          <Button
            type="submit"
            variant="outlined"
            disabled={status === 'submitted' || status === 'streaming'}
            sx={{
              px: 3,
              minWidth: '100px',
              borderColor: 'rgba(147, 51, 234, 0.5)',
              '&:hover': {
                borderColor: 'rgba(147, 51, 234, 0.8)',
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
              },
            }}
          >
            {status === 'streaming' ? 'Thinking...' : 'Send'}
          </Button>
        </form>
      </div>
    </ThemeProvider>
  );
} 