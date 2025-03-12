import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    return NextResponse.json({ 
      authenticated: !!user,
      user: user
    })
  } catch (error) {
    console.error('Verify auth error:', error)
    return NextResponse.json({ 
      authenticated: false,
      error: 'Failed to verify authentication'
    }, { status: 500 })
  }
} 