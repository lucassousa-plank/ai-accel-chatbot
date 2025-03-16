# Nandor the Relentless - AI Chatbot 🧛‍♂️

A vampire-themed AI chatbot featuring Nandor from "What We Do in the Shadows". This chatbot combines multiple AI agents to provide weather information, news updates, and general conversation in the character of Nandor the Relentless.

## Features 🌟

- **Character-Based Interaction**: Communicates as Nandor the Relentless, maintaining his unique personality and speech patterns
- **Multi-Agent System**: 
  - Weather Agent: Provides weather information
  - News Agent: Shares current news updates
  - Chat Agent (Nandor): Handles general conversation and integrates information from other agents
- **Voice Input**: Built-in speech-to-text functionality for voice commands
- **Real-time Streaming**: Messages are streamed in real-time with visual feedback
- **Conversation Memory**: Maintains context through conversation summaries
- **Vampire-Themed UI**: Dark mode interface with purple and blood-red accents

## Tech Stack 💻

- Next.js 14 (App Router)
- TypeScript
- LangChain
- OpenAI GPT-4
- Vercel AI SDK
- Material-UI (MUI)
- Web Speech API
- Tailwind CSS

## Getting Started 🚀

### Prerequisites

- Node.js 18.17 or later
- OpenAI API key
- WeatherAPI key (for weather functionality)
- NewsAPI key (for news functionality)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ai-accel-chatbot.git
   cd ai-accel-chatbot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory with the following variables:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   WEATHERAPI_API_KEY=your_weather_api_key
   NEWSAPI_API_KEY=your_news_api_key
   LANGCHAIN_TRACING_V2=true
   LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
   LANGCHAIN_API_KEY=your_langsmith_api_key
   LANGCHAIN_PROJECT=your_project_name
   SUPABASE_URL=your_supabase_url
   SUPABASE_PRIVATE_KEY=your_supabase_private_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables 🔑

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 | Yes |
| `WEATHERAPI_API_KEY` | WeatherAPI key for weather data | Yes |
| `NEWSAPI_API_KEY` | NewsAPI key for news updates | Yes |
| `LANGCHAIN_TRACING_V2` | Enable LangSmith tracing (set to "true") | Yes |
| `LANGCHAIN_ENDPOINT` | LangSmith API endpoint | Yes |
| `LANGCHAIN_API_KEY` | LangSmith API key for tracing | Yes |
| `LANGCHAIN_PROJECT` | LangSmith project name | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_PRIVATE_KEY` | Supabase service role key | Yes |

## Project Structure 📁

```
ai-accel-chatbot/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   ├── route.ts       # Main chat endpoint
│   │   │   └── clear/
│   │   │       └── route.ts   # Clear chat history
│   │   ├── components/
│   │   │   └── chatbot/
│   │   │       └── ChatInterface.tsx  # Main chat UI
│   │   ├── backend/
│   │   │   └── src/
│   │   │       └── agents/
│   │   │           ├── chatAgent.ts    # Nandor's personality
│   │   │           ├── weatherAgent.ts # Weather functionality
│   │   │           ├── newsAgent.ts    # News functionality
│   │   │           ├── summaryAgent.ts # Conversation memory
│   │   │           └── supervisorChain.ts # Agent routing
```

## Features in Detail 🔍

### Voice Input
The chatbot supports voice input using the Web Speech API. Users can:
- Click the microphone icon to start recording
- Speak their message
- Click stop or send to finish recording
- The transcribed text will appear in the input field

### Agent System
The chatbot uses a multi-agent system where:
1. The supervisor agent routes queries to appropriate agents
2. Specialized agents (weather, news) gather information
3. Nandor (chat agent) delivers responses in character
4. Summary agent maintains conversation context

### UI Elements
- Vampire-themed dark mode interface
- Agent chips showing which agents were involved
- Real-time "Consulting the Dark Powers..." status
- Voice input button with recording indicator
- Auto-scrolling message view

## Contributing 🤝

Feel free to submit issues and enhancement requests!

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

