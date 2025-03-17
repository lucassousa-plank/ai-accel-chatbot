'use client';

import { useChat, Message } from '@ai-sdk/react';
import { useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';

// Add these type declarations at the top of the file after imports
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionError) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEvent extends Event {
  results: {
    length: number;
    item(index: number): SpeechRecognitionResultList;
    [index: number]: SpeechRecognitionResultList;
  };
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionError extends Event {
  error: string;
  message: string;
}

interface ExtendedMessage extends Message {
  metadata?: {
    invokedAgents: string[];
    currentAgent?: string;
    isThinking?: boolean;
    summary?: string;
  };
}

export default function ChatInterface() {
  const [threadId, setThreadId] = useState<string>('');
  const [localInput, setLocalInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionConstructor) {
        recognitionRef.current = new SpeechRecognitionConstructor();
        const recognition = recognitionRef.current;
        
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const results = Array.from(event.results);
          const transcripts = results.map(result => {
            const firstAlternative = ((result as unknown as SpeechRecognitionResultList)[0] as unknown as SpeechRecognitionAlternative);
            return firstAlternative.transcript;
          });
          setLocalInput(transcripts.join(''));
        };

        recognition.onerror = (event: SpeechRecognitionError) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
          setIsProcessing(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
          setIsProcessing(false);
        };
      }
    }
  }, []);

  const { messages, status, setMessages } = useChat({
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
    onError: () => {
      console.error('Chat error occurred');
    }
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages]); // Scroll when messages change

  const handleCustomSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!localInput.trim()) return;

    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

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

  const startRecording = async () => {
    try {
      if (!recognitionRef.current) {
        alert('Speech recognition is not supported in your browser.');
        return;
      }

      recognitionRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      alert('Error starting speech recognition. Please try again.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
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
          <IconButton
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            sx={{
              color: isRecording ? 'error.main' : 'primary.main',
              borderRadius: '8px',
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
              },
            }}
          >
            {isProcessing ? (
              <CircularProgress size={24} color="inherit" />
            ) : isRecording ? (
              <StopIcon />
            ) : (
              <MicIcon />
            )}
          </IconButton>
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