'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.error('Login error:', error.message)
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const headersList = await headers()
  const host = headersList.get('host')
  
  // Use VERCEL_URL in production, fallback to host header
  const siteUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NODE_ENV === 'development'
      ? `http://${host}`
      : `https://${host}`

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        email: formData.get('email') as string,
      },
    },
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    console.error('Signup error:', error.message)
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  // Check if email confirmation is required
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user?.identities?.length === 0) {
    // Email confirmation is required
    redirect('/login?message=Please check your email to confirm your account')
  } else {
    // Email confirmation is not required
    revalidatePath('/', 'layout')
    redirect('/')
  }
}