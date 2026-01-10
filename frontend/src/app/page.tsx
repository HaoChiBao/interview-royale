"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGameStore } from "@/store/useGameStore";
import { Bot, Users } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-white text-zinc-900">
      <div className="mb-8 text-center space-y-2">
         <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
           Interview <span className="text-indigo-600">Royale</span>
         </h1>
         <p className="text-muted-foreground text-lg max-w-md mx-auto">
           Battle against bots (or friends) to answer behavioural questions.
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
