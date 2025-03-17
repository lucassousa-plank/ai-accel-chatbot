import { NextRequest } from 'next/server';
import { clearState } from '@/backend/src/agents/agentManager';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { thread_id } = await req.json();
    
    if (!thread_id) {
      return new Response('thread_id is required', { status: 400 });
    }

    await clearState(thread_id);
    return new Response('Chat history cleared', { status: 200 });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    return new Response('Error clearing chat history', { status: 500 });
  }
} 