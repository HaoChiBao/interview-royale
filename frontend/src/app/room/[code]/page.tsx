"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlayerGrid } from "@/components/PlayerGrid";
import { Badge } from "@/components/ui/badge";
import { Copy, Play } from "lucide-react";
import { getMediaStream } from "@/lib/media";
import { socketClient } from "@/lib/socket";
import { DebugLogButton } from "@/components/DebugLogButton";
import { VideoBroadcaster } from "@/components/VideoBroadcaster";

export default function LobbyPage() {
  const router = useRouter();
  const { code } = useParams();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  const roomCode = useGameStore(s => s.roomCode);
  const phase = useGameStore(s => s.phase);
  const others = useGameStore(s => s.others);

  // Sync phase
  useEffect(() => {
    if (phase === "ROUND") {
      router.push(`/room/${code}/round`);
    }
  }, [phase, code, router]);

    // Acquire media and connect socket
    useEffect(() => {
      let mounted = true;
      
      // Set room code
      if (typeof code === "string") {
        useGameStore.getState().setRoomCode(code);
      }
  
      // Init name if needed
      const state = useGameStore.getState();
      let myName = state.me?.name;
      if (!myName) {
        myName = "Guest" + Math.floor(Math.random() * 1000);
        useGameStore.getState().setMe(myName);
      }

      // Connect & Join
      // We rely on socket.ts singleton checks, but we should join only once.
      // But socket.ts `connect()` is safe.
      socketClient.connect();
      
      if (myName) {
         // Add a small delay or check connection? 
         // socket.ts queue handles it.
         socketClient.join(myName);
      }
  
      getMediaStream(true, true).then(s => {
        if (mounted) setLocalStream(s);
      }).catch(e => console.error(e));

      return () => {
        mounted = false;
        // Do NOT close socket here on unmount of PAGE if we want it to persist?
        // Actually we do want to close if we leave the lobby?
        // But Next.js remounts.
        // Let's NOT cleanup socket here, rely on singleton.
      };
    }, [code]);

  const handleStart = () => {
    socketClient.startGame();
  };

  const copyCode = () => {
    if (typeof code === "string")
       navigator.clipboard.writeText(code);
  };

  if (!roomCode) {
    return <div className="p-10 text-center">Loading Room...</div>;
  }

  return (
    <main className="min-h-screen flex flex-col p-4 md:p-8 bg-white text-zinc-900">
      <DebugLogButton />
      {localStream && <VideoBroadcaster stream={localStream} />}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Lobby</h1>
          <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={copyCode}>
            <span className="font-mono text-xl">{roomCode}</span>
            <Copy className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center gap-4">
           <Badge variant="outline" className="text-base px-3 py-1">
             {others.length + 1} Players
           </Badge>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto mb-8">
        <PlayerGrid localStream={localStream} />
      </section>

      <footer className="flex justify-center flex-col items-center gap-4 py-8 border-t bg-gray-50 p-4 rounded-xl shadow-sm">
        <div className="flex gap-4 items-center">
          <div className="text-sm text-muted-foreground mr-4">
             Waiting for host to start... (You are host)
          </div>
          <Button 
            size="lg" 
            className="w-48 text-lg font-bold shadow-lg shadow-indigo-500/20"
            onClick={handleStart}
          >
            <Play className="w-5 h-5 mr-2" />
            Start Game
          </Button>
        </div>
        
        <div className="flex gap-8 text-sm text-muted-foreground">
          <div className="flex flex-col items-center">
            <span className="font-semibold text-foreground">Mode</span>
            <span>Behavioural</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-semibold text-foreground">Round Time</span>
            <span>60s</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
