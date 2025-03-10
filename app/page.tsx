import ChatInterface from './components/chatbot/ChatInterface';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">AI Chat Assistant</h1>
        <ChatInterface />
      </div>
    </main>
  );
}
