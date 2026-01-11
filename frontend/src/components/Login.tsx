"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Try to sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // If sign in fails, try to sign up
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setMessage(`Error: ${signUpError.message}`);
      } else {
        setMessage('Account created! Check your email to confirm (or you can sign in directly if email confirmation is disabled).');
      }
    } else {
      setMessage('Welcome to the Battle Royale!');
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white text-zinc-900">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
          Interview <span className="text-indigo-600">Royale</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Battle against bots (or friends) to answer behavioural questions.
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join the Battle Royale</CardTitle>
          <CardDescription>Sign in or create an account to enter the arena</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Enter Arena'}
            </Button>
          </form>

          {message && (
            <p className={`mt-4 text-sm ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}