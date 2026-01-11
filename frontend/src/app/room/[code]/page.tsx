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
  const me = useGameStore(s => s.me);
  const others = useGameStore(s => s.others);
  const gameSettings = useGameStore(s => s.gameSettings);
  const isReady = useGameStore(s => s.isReady);

  const votes = useGameStore(s => s.votes);
  const isChoosingSettings = useGameStore(s => s.isChoosingSettings);
  const chosenSettings = useGameStore(s => s.chosenSettings);
  const isStarting = useGameStore(s => s.isStarting);

  const [spinResult, setSpinResult] = useState<number | null>(null);

  // Sync phase
  useEffect(() => {
    if (phase === "ROUND") {
      router.push(`/room/${code}/round`);
    }
  }, [phase, code, router]);

  // Handle animation
  useEffect(() => {
      if (isChoosingSettings && chosenSettings) {
          // Play animation
          let interval: NodeJS.Timeout;
          let count = 0;
          const options = chosenSettings.all_votes;
          
          interval = setInterval(() => {
             const random = options[Math.floor(Math.random() * options.length)];
             setSpinResult(random);
             count++;
             if (count > 20) { // 2 seconds roughly
                 clearInterval(interval);
                 setSpinResult(chosenSettings.num_rounds);
             }
          }, 100);

          return () => clearInterval(interval);
      }
  }, [isChoosingSettings, chosenSettings]);

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
      socketClient.connect();
      
      if (myName) {
         socketClient.join(myName);
      }
  
      getMediaStream(true, true).then(s => {
        if (mounted) setLocalStream(s);
      }).catch(e => console.error(e));

      return () => {
        mounted = false;
      };
    }, [code]);

  const updateSettings = (partial: { num_rounds?: number }) => {
      console.log("Button clicked. updateSettings:", partial);
      // Logic constraint: 1-5
      if (partial.num_rounds !== undefined) {
          if (partial.num_rounds < 1) partial.num_rounds = 1;
          if (partial.num_rounds > 5) partial.num_rounds = 5;
      }
      socketClient.send("update_settings", { settings: { ...gameSettings, ...partial } });
  };

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

  // Calculate my vote
  const myVote = (me && votes && votes[me.name]) || 3;

  return (
    <main className="min-h-screen flex flex-col p-4 md:p-8 bg-white text-zinc-900 overflow-hidden relative">
      <DebugLogButton />
      {localStream && <VideoBroadcaster stream={localStream} />}

      {/* Animation Overlay */}
      {isChoosingSettings && (
          <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-sm animate-in fade-in duration-300">
              <h2 className="text-3xl font-bold mb-8 animate-pulse text-indigo-400">Choosing Settings...</h2>
              <div className="bg-white text-black text-9xl font-black p-12 rounded-3xl shadow-2xl min-w-[300px] text-center">
                  {spinResult}
              </div>
              <p className="mt-8 text-xl opacity-80">Randomly selected from player votes!</p>
          </div>
      )}
      
      {/* 3..2..1 START Countdown Overlay */}
      {isStarting && (
          <CountdownOverlay />
      )}

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

      <section className="flex-1 w-full relative">
         <div className="absolute inset-0 pb-40">
            <PlayerGrid localStream={localStream} />
         </div>
      </section>

      <footer className="fixed bottom-0 left-0 right-0 z-20 flex justify-center flex-col items-center gap-4 py-6 bg-white/20 backdrop-blur-xl border-t border-white/20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col md:flex-row gap-8 items-center w-full max-w-4xl px-4">
           
           {/* Game Settings Card - High Contrast */}
            <div className="bg-white border-2 border-zinc-200 p-6 rounded-xl flex-1 w-full shadow-lg">
                <h3 className="font-bold text-sm uppercase text-zinc-500 mb-4 tracking-wider">Game Settings</h3>
                <div className="flex items-center justify-between">
                    <span className="font-medium text-lg">Number of Rounds</span>
                    <div className="flex items-center gap-3">
                        {me?.isLeader ? (
                             <>
                                <Button 
                                variant="outline" size="icon" className="h-10 w-10 rounded-full border-2"
                                onClick={() => updateSettings({ num_rounds: gameSettings.num_rounds - 1 })}
                                disabled={isChoosingSettings || useGameStore.getState().isStarting}
                                > - </Button>
                                <span className="w-12 text-center font-black text-3xl">{gameSettings.num_rounds}</span>
                                <Button 
                                variant="outline" size="icon" className="h-10 w-10 rounded-full border-2"
                                onClick={() => updateSettings({ num_rounds: gameSettings.num_rounds + 1 })}
                                disabled={isChoosingSettings || useGameStore.getState().isStarting}
                                > + </Button>
                             </>
                        ) : (
                             <span className="w-12 text-center font-black text-3xl text-zinc-400">{gameSettings.num_rounds}</span>
                        )}
                    </div>
                </div>
                {!me?.isLeader && (
                    <p className="text-xs text-zinc-400 mt-4 text-center">
                        Only the leader can change settings.
                    </p>
                )}
            </div>

            {/* Start Button Area */}
            {/* Start Button Area - Only Leader */}
            <div className="flex-1 w-full flex flex-col items-center justify-center gap-4">
                 {me?.isLeader ? (
                     <Button 
                        size="lg" 
                        className="w-full max-w-sm font-bold text-xl h-16 shadow-xl shadow-indigo-500/20 rounded-2xl transition-all hover:scale-105 active:scale-95"
                        onClick={handleStart}
                        disabled={isChoosingSettings || useGameStore.getState().isStarting} 
                    >
                        <Play className="w-6 h-6 mr-2 fill-current" />
                        {useGameStore.getState().isStarting ? "Starting..." : "Start Game"}
                    </Button>
                 ) : (
                     <div className="text-center p-4 bg-zinc-100 rounded-lg text-zinc-500 font-medium">
                        Waiting for leader to start...
                     </div>
                 )}
            </div>

        </div>
      </footer>
    </main>
  );
}

function CountdownOverlay() {
    const [count, setCount] = useState(3);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setCount(prev => prev > 1 ? prev - 1 : 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="absolute inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center text-white backdrop-blur-md animate-in fade-in duration-300">
              <div className="text-[200px] font-black animate-pulse leading-none bg-gradient-to-b from-indigo-400 to-purple-600 bg-clip-text text-transparent">
                  {count}
              </div>
              <h2 className="text-3xl font-bold mt-8 text-zinc-300 animate-bounce">
                  Prepare for the interview...
              </h2>
        </div>
    );
}
