import ChatInterface from './components/chatbot/ChatInterface';
import Navbar from './components/Navbar';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-900">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <ChatInterface />
      </div>
    </main>
  );
}
