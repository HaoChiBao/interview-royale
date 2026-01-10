import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setMsg('Connecting to Arena...');
    
    // 1. Try to Login
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email, password,
    });

    if (signInError) {
      // 2. If login fails, try to Sign Up (Create Account)
      const { error: signUpError } = await supabase.auth.signUp({
        email, password,
      });
      
      if (signUpError) {
        setMsg(`Error: ${signUpError.message}`);
      } else {
        setMsg('Account Created! Welcome to the Battle Royale.');
      }
    }
  };

  return (
    <div className="login-box" style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Join the Battle Royale</h2>
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px', margin: '0 auto' }}>
        <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" style={{ padding: '10px', cursor: 'pointer' }}>Enter Arena</button>
      </form>
      {msg && <p style={{ color: msg.includes('Error') ? 'red' : 'green' }}>{msg}</p>}
    </div>
  );
}

export default Login;