"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { socketClient } from "@/lib/socket";
import { Trophy, ArrowRight, Home } from "lucide-react";
import { AvatarStickFigure } from "@/components/AvatarStickFigure";
import { PlayerGrid } from "@/components/PlayerGrid";
import { IntermissionCanvas } from "@/components/IntermissionCanvas";

export default function ResultsPage() {
  const router = useRouter();
  const { code } = useParams();
  
  const { 
      phase, 
      others, 
      me, 
      leaderboard,
      gameSettings,
      intermissionDuration
  } = useGameStore();

  const [timeLeft, setTimeLeft] = useState(intermissionDuration || 10);

  useEffect(() => {
     if (phase === "RESULTS") {
         setTimeLeft(intermissionDuration || 10); // Reset on mount
         const timer = setInterval(() => {
             setTimeLeft(prev => Math.max(0, prev - 1));
         }, 1000);
         return () => clearInterval(timer);
     }
  }, [phase, intermissionDuration]);

  const handleNextRound = () => {
    socketClient.send("next_round", {});
  };

  const handleHome = () => {
      // Just refresh or go to root
      window.location.href = "/";
  };

  // Combine me and others or just use leaderboard?
  // Leaderboard is authoritative for scores. 
  // We can just iterate the leaderboard array.
  
  return (
    <main className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-zinc-50 text-zinc-900">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
          {phase === "GAME_OVER" ? "Final Results" : "Round Results"}
        </h1>
        {phase !== "GAME_OVER" && (
            <p className="text-muted-foreground mt-2">
                Moving to next round soon...
            </p>
        )}
      </header>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Intermission Canvas or Leaderboard? */}
             {/* Requirement: "intermission room where they can use the WASD controls... On the top, there'll be a timer" */}
             {/* We can show canvas prominently. Leaderboard can be side or overlay. */}
             
             <div className="order-2 md:order-1 col-span-1 md:col-span-2">
                  {phase === "GAME_OVER" ? (
                      <Card className="h-fit">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-yellow-500" />
                                Final Leaderboard
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           {/* Existing leaderboard rendering */}
                           {leaderboard.map((entry, index) => (
                               <div key={entry.username} className={`flex items-center justify-between p-3 rounded-lg border ${index === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
                                   <div className="flex items-center gap-3">
                                       <span className={`font-bold w-6 text-center ${index === 0 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                                           #{index + 1}
                                       </span>
                                       <span className="font-medium">
                                           {entry.username} {entry.username === me?.name && "(You)"}
                                       </span>
                                   </div>
                                   <span className="font-bold text-lg">
                                       {entry.score} pts
                                   </span>
                               </div>
                           ))}
                        </CardContent>
                      </Card>
                  ) : (
                      <div className="space-y-4">
                          <IntermissionCanvas />
                          <div className="text-center text-sm text-muted-foreground">
                              Round Over! Move around while you wait.
                              <div className="mt-2 font-bold text-lg">
                                Leaderboard: {leaderboard[0]?.username || "..."} is winning!
                              </div>
                          </div>
                      </div>
                  )}
             </div>

          {/* Hidden but kept for structure if needed, or remove Grid usage above. */}
          {/* Actually we replaced the grid structure logic slightly. */}
          {/* Let's adjust the parent container if needed. */}
         {/* Actions / Highlights */}
         <div className="order-1 md:order-2 flex flex-col gap-6">
             {/* Show current winner or specific highlights later */}
             <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
                 {leaderboard.length > 0 && (
                     <>
                        <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
                            {phase === "GAME_OVER" ? "Champion" : "Current Leader"}
                        </div>
                        <div className="text-2xl font-bold mb-4">
                            {leaderboard[0].username}
                        </div>
                        <div className="relative h-32 w-full bg-zinc-100 rounded-lg flex items-center justify-center overflow-hidden">
                             {/* Show Avatar of leader if possible */}
                             <AvatarStickFigure 
                                name={leaderboard[0].username}
                                isMe={leaderboard[0].username === me?.name}
                                // Hack: We don't have stream for them here unless we find them in `others`
                                className="scale-120"
                             />
                        </div>
                     </>
                 )}
             </div>

             {/* Controls */}
             <div className="flex flex-col gap-3">
                {phase === "GAME_OVER" ? (
                    <Button size="lg" className="w-full text-lg" onClick={handleHome}>
                        <Home className="w-5 h-5 mr-2" />
                        Back to Home
                    </Button>
                ) : (
                    <div className="flex flex-col gap-2 w-full">
                        <div className="bg-zinc-100 p-3 rounded-lg text-center">
                            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                Next Round In
                            </span>
                            <span className="text-3xl font-black font-mono">
                                {timeLeft > 0 ? timeLeft : "..."}s
                            </span>
                        </div>
                        {/* Optional manual override for host or testing */}
                         {/* <Button size="lg" className="w-full text-lg shadow-lg shadow-indigo-500/20" onClick={handleNextRound}>
                            Next Round Immediately
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </Button> */}
                    </div>
                )}
             </div>
         </div>
      </div>
    </main>
  );
}
