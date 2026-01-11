"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Login from "@/components/Login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Users } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleCreate = () => {
    if (!name.trim()) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem("interview-royale-name", name);
    router.push(`/preflight?code=${code}&create=true`);
  };

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim()) return;
    localStorage.setItem("interview-royale-name", name);
    router.push(`/preflight?code=${roomCode}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </main>
    );
  }

  // Show login if not authenticated
  if (!session) {
    return <Login />;
  }

  // Show main interface if authenticated
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-white text-zinc-900">
      <div className="absolute top-4 right-4">
        <Button variant="outline" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>

      <div className="mb-8 text-center space-y-2">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
          Interview <span className="text-indigo-600">Royale</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Battle against bots (or friends) to answer behavioural questions.
        </p>
        <p className="text-sm text-muted-foreground">
          Logged in as: {session.user.email}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-indigo-500" />
              Create Room
            </CardTitle>
            <CardDescription>Start a new session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Name</label>
              <Input 
                placeholder="Enter your name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
              />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={!name.trim()}>
              Create & Enter
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-500" />
              Join Room
            </CardTitle>
            <CardDescription>Enter an existing room code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Name</label>
              <Input 
                placeholder="Enter your name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Room Code</label>
              <Input 
                placeholder="ABCXYZ" 
                value={roomCode} 
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())} 
                maxLength={6}
              />
            </div>
            <Button className="w-full" variant="secondary" onClick={handleJoin} disabled={!name.trim() || !roomCode.trim()}>
              Join Room
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
