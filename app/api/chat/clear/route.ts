import { NextResponse } from "next/server";
import { clearState } from "../route";

export async function POST(req: Request) {
  try {
    const { thread_id } = await req.json();
    if (!thread_id) {
      return NextResponse.json({ error: 'thread_id is required' }, { status: 400 });
    }

    console.log('Starting to clear chat history for thread:', thread_id);
    await clearState(thread_id);
    console.log('Successfully cleared chat history');
    
    return NextResponse.json({ message: 'Chat history cleared successfully' });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    return NextResponse.json({ error: 'Failed to clear chat history' }, { status: 500 });
  }
} 