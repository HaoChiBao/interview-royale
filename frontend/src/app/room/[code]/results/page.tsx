"use client";

import React, { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Crown, Sparkles, ArrowRight, Home, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { socketClient } from "@/lib/socket";
import { DebugLogButton } from "@/components/DebugLogButton";
import { VideoBroadcaster } from "@/components/VideoBroadcaster";
import { getMediaStream } from "@/lib/media";
import { useState } from "react";

export default function ResultsPage() {
  const router = useRouter();
  const { code } = useParams();
  const phase = useGameStore(s => s.phase);
  const me = useGameStore(s => s.me);
  const others = useGameStore(s => s.others);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Acquire media for preview/broadcast even in results
  useEffect(() => {
    let mounted = true;
    getMediaStream(true, true).then(s => {
      if (mounted) setLocalStream(s);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Sync phase (if next round starts)
  useEffect(() => {
    if (phase === "ROUND") {
      router.push(`/room/${code}/round`);
    } else if (phase === "LOBBY") {
       router.push(`/room/${code}`);
    }
  }, [phase, code, router]);

  const handleNext = () => {
    socketClient.startGame();
  };

  const handleLobby = () => {
    useGameStore.getState().setPhase("LOBBY");
    router.push(`/room/${code}`);
  };

  // Sort by score
  const allPlayers = [me, ...others].filter((p): p is NonNullable<typeof p> => !!p);
  const sorted = [...allPlayers].sort((a, b) => (b.score || 0) - (a.score || 0));
  const winner = sorted[0];

  return (
    <main className="min-h-screen flex flex-col p-4 md:p-12 bg-zinc-50 dark:bg-zinc-950">
      <DebugLogButton />
      {localStream && <VideoBroadcaster stream={localStream} />}
      <header className="text-center mb-12">
        <h1 className="text-4xl font-extrabold mb-2">Round Results</h1>
        <p className="text-muted-foreground">Scores provided by "AI" (RNG)</p>
      </header>

      <div className="max-w-4xl mx-auto w-full space-y-8">
         {/* Winner Banner */}
         {winner && winner.isMe && (
           <div className="bg-gradient-to-r from-yellow-400/20 to-orange-400/20 border border-yellow-400/50 rounded-xl p-6 text-center animate-bounce">
              <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 flex items-center justify-center gap-2">
                 <Crown className="fill-current w-8 h-8" />
                 You Won This Round!
              </h2>
           </div>
         )}

         {/* Leaderboard Cards */}
         <div className="grid gap-4">
            {sorted.map((player, index) => (
              <Card key={player.id} className={cn("transition-all", index === 0 ? "border-yellow-400 shadow-yellow-200 dark:shadow-yellow-900/20 shadow-lg scale-[1.02]" : "hover:border-indigo-200")}>
                <CardContent className="flex items-center p-6 gap-6">
                   <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-3xl font-bold text-zinc-300">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                   </div>
                   
                   <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                         <h3 className="text-xl font-bold">{player.name} {player.isMe && "(You)"}</h3>
                         {index === 0 && <Crown className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                      </div>
                      <div className="flex gap-2 text-sm text-muted-foreground">
                         {player.feedback?.map((f, i) => (
                           <span key={i} className="flex items-center gap-1">
                             <Sparkles className="w-3 h-3" /> {f}
                           </span>
                         ))}
                      </div>
                   </div>

                   <div className="text-right">
                      <div className="text-4xl font-black text-indigo-600 dark:text-indigo-400">
                        {player.score}
                      </div>
                      <div className="text-xs uppercase font-bold text-muted-foreground">Points</div>
                   </div>
                </CardContent>
              </Card>
            ))}
         </div>

         <div className="flex justify-center gap-4 mt-8 pt-8 border-t">
            <Button variant="outline" size="lg" onClick={handleLobby}>
               <Home className="w-4 h-4 mr-2" />
               Back to Lobby
            </Button>
            <Button size="lg" onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-700 text-white">
               <RefreshCw className="w-4 h-4 mr-2" />
               Next Round
            </Button>
         </div>
      </div>
    </main>
  );
}
