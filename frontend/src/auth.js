import { supabase } from './supabaseClient'

// Sign Up / Sign In logic
export const handleLogin = async (email, password) => {
  // We use signInWithPassword because you toggled OFF "Confirm Email"
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  })

  // If the user doesn't exist yet, Supabase can auto-signup or you can call signUp
  if (error && error.message === 'Invalid login credentials') {
    return await supabase.auth.signUp({ email, password })
  }

  return { data, error }
}