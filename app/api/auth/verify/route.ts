import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return NextResponse.json({ authenticated: false }, { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        }
      })
    }

    return NextResponse.json({ 
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
  } catch (error) {
    console.error('Auth verify error:', error)
    return NextResponse.json({ 
      authenticated: false,
      error: 'Internal server error'
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      }
    })
  }
} 