"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Timer } from "@/components/Timer";
// import { Recorder } from "@/components/Recorder";
import { PlayerGrid } from "@/components/PlayerGrid";
import { getMediaStream } from "@/lib/media";
import { socketClient } from "@/lib/socket";
import { DebugLogButton } from "@/components/DebugLogButton";
import { VideoBroadcaster } from "@/components/VideoBroadcaster";
import { SpeechTextarea } from "@/components/SpeechTextarea";
import { IntermissionCanvas } from "@/components/IntermissionCanvas";

export default function RoundPage() {
  const router = useRouter();
  const { code } = useParams();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  
  // Stable video ref to prevent flickering
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && localStream) {
        videoRef.current.srcObject = localStream;
    }
  }, [localStream]);
  
  const question = useGameStore(s => s.currentQuestion);
  const roundEndTime = useGameStore(s => s.roundEndTime);
  const phase = useGameStore(s => s.phase);
  const hasSubmitted = useGameStore(s => s.me?.hasSubmitted);
  // const recordingBlob = useGameStore(s => s.recordingBlob);
  // const setRecording = useGameStore(s => s.setRecording);

  // Sync phase
  useEffect(() => {
    if (phase === "GRADING") {
      router.push(`/room/${code}/grading`);
    } else if (phase === "LOBBY") {
       router.push(`/room/${code}`);
    } else if (phase === "GAME_OVER") {
        router.push(`/room/${code}/results`); // Reuse results page or make new one? Results page can handle Game Over.
    }
  }, [phase, code, router]);

  // Reset input when question changes
  useEffect(() => {
      setTextAnswer((question as any)?.starter_code || "");
      setIsCalculating(false);
  }, [question]);

  // Handle Submission Transition
  useEffect(() => {
      if (hasSubmitted) {
          setIsCalculating(true);
          const timer = setTimeout(() => {
              setIsCalculating(false);
          }, 3000); // 3 seconds calculating
          return () => clearTimeout(timer);
      }
  }, [hasSubmitted]);

  // Acquire media
  useEffect(() => {
    let mounted = true;
    getMediaStream(true, true).then(s => {
      if (mounted) setLocalStream(s);
    });
    return () => {
      mounted = false;
      // Cleanup? 
    };
  }, []);

  // Handle timer expire
  const handleExpire = () => {
       // Auto submit what we have
       socketClient.submit(textAnswer || "Time expired, no answer.");
  };

  const handleSubmit = () => {
    if (textAnswer.trim()) {
       socketClient.submit(textAnswer);
    } else {
       socketClient.submit("No answer provided.");
    }
  };

  if (!question) {
    return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <main className="min-h-screen flex flex-col p-4 bg-white text-zinc-900 overflow-hidden font-sans">
      {localStream && <VideoBroadcaster stream={localStream} />}
      
      {/* 1. Header Section: Question & Timer */}
      <div className="w-full max-w-7xl mx-auto mb-6">
           <div className="relative border-2 border-green-400 rounded-xl p-6 bg-white shadow-sm flex flex-col gap-2">
               {/* Pill Badge */}
               <div className="absolute -top-3 left-6 bg-green-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-sm">
                   {question.type} Question
               </div>
               
               <div className="flex justify-between items-start pt-2">
                   <h1 className="text-xl md:text-2xl font-semibold leading-tight text-zinc-800 flex-1 pr-8">
                       {question.prompt}
                   </h1>
                   {/* Compact Timer */}
                    <div className="flex flex-col items-center bg-zinc-900 text-white px-3 py-2 rounded-lg">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 mb-0.5">Time Left</span>
                        <Timer endTime={roundEndTime} onExpire={handleExpire} />
                    </div>
               </div>
           </div>
      </div>

      {/* 2. Middle Section: Split View (Video Left | Input Right) */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 mb-6">
           {/* Left: User Video (Self View) */}
           <div className="bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200 relative shadow-inner flex items-center justify-center">
                {localStream ? (
                     <video 
                        ref={videoRef}
                        autoPlay muted playsInline 
                        className="w-full h-full object-cover scale-x-[-1]"
                     />
                ) : (
                    <div className="text-zinc-400 font-medium">Camera off or loading...</div>
                )}
                
                {/* Status Overlay if submitted */}
                {hasSubmitted && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                        <div className="bg-green-500 rounded-full pap-3 mb-3 p-2">
                            <div className="h-6 w-6 border-2 border-white border-b-transparent rounded-full animate-spin" />
                        </div>
                        <span className="font-bold text-lg">Answer Submitted</span>
                        <span className="text-sm opacity-80 mt-1">Waiting for others...</span>
                    </div>
                )}
           </div>

           {/* Right: Input Area */}
           <div className="flex flex-col h-full min-h-[400px]">
                {/* If submitted, show Intermission Canvas overlay or placeholder? */}
                {/* If submitted, show Intermission Canvas overlay or placeholder? */}
                {hasSubmitted ? (
                    isCalculating ? (
                        <div className="flex-1 bg-zinc-900 border-2 border-zinc-800 rounded-2xl flex flex-col items-center justify-center p-8 relative overflow-hidden text-white animate-in fade-in zoom-in duration-300">
                             <div className="flex flex-col items-center gap-6 z-10">
                                 <div className="relative">
                                     <div className="h-16 w-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                     <div className="absolute inset-0 flex items-center justify-center font-bold text-xs opacity-50">AI</div>
                                 </div>
                                 <div className="text-center">
                                     <h3 className="text-2xl font-bold mb-2 animate-pulse">Analyzing Code Model...</h3>
                                     <p className="text-zinc-400">Calculating complexity and efficiency score</p>
                                 </div>
                             </div>
                             {/* Matrix background effect */}
                             <div className="absolute inset-0 opacity-20" 
                                style={{ backgroundImage: "linear-gradient(0deg, transparent 24%, rgba(32, 255, 77, .1) 25%, rgba(32, 255, 77, .1) 26%, transparent 27%, transparent 74%, rgba(32, 255, 77, .1) 75%, rgba(32, 255, 77, .1) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(32, 255, 77, .1) 25%, rgba(32, 255, 77, .1) 26%, transparent 27%, transparent 74%, rgba(32, 255, 77, .1) 75%, rgba(32, 255, 77, .1) 76%, transparent 77%, transparent)", backgroundSize: "50px 50px" }}
                             />
                        </div>
                    ) : (
                        // FULL SCREEN INTERMISSION OVERLAY (Portal-like behavior or just covering everything)
                        // Actually, to make it immersive, we should probably render this fixed over the whole screen 
                        // or just replace the middle section.
                        // User request: "brings them all to that intermission state" ... "roam around ... freely".
                        // Putting it in the input box is too small. Let's make it cover the screen or at least the middle area.
                        // Let's replace the ENTIRE Middle Section with the Canvas for this user.
                        <div className="fixed inset-0 z-40 bg-white">
                            <IntermissionCanvas localStream={localStream} />
                        </div>
                    )
                ) : (
                    <div className="flex flex-col gap-4 h-full">
                         {question.type === "technical" ? (
                             <div className="flex-1 relative group flex flex-col">
                                 {/* Simple Header without Mac dots */}
                                 <div className="h-8 bg-zinc-900 rounded-t-xl flex items-center px-4 justify-between border-b border-zinc-700 shrink-0">
                                     <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">Solution.py</div>
                                     <div className="text-[10px] text-zinc-600">Python 3.10</div>
                                 </div>
                                 <textarea
                                     value={textAnswer || (question as any).starter_code || ""}
                                     onChange={(e) => setTextAnswer(e.target.value)}
                                     className="flex-1 p-4 rounded-b-xl bg-[#1e1e1e] text-zinc-100 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-zinc-700 shadow-inner"
                                     spellCheck={false}
                                     style={{ fontFamily: "'Fira Code', monospace" }}
                                 />
                             </div>
                         ) : (
                             <Card className="flex-1 border-2 border-zinc-100 shadow-sm overflow-hidden flex flex-col">
                                 <SpeechTextarea 
                                     value={textAnswer}
                                     onChange={setTextAnswer}
                                     placeholder="Type your answer here or click the mic to dictate..."
                                     className="flex-1 h-full border-0 p-6 text-lg"
                                 />
                             </Card>
                         )}
                         
                         <Button 
                           size="lg" 
                           onClick={handleSubmit}
                           disabled={!textAnswer.trim()}
                           className="h-14 text-lg font-bold shadow-lg shadow-indigo-500/20 rounded-xl"
                         >
                           Submit Answer
                         </Button>
                    </div>
                )}
           </div>
      </div>

      {/* 3. Bottom Section: Competitors Row */}
      {/* Hide this if we are in full screen intermission */}
      {!hasSubmitted && (
          <div className="flex-none pt-4 pb-2 border-t border-zinc-100 bg-zinc-50/50 -mx-4 px-4 sticky bottom-0 relative min-h-[160px] z-50">
               <PlayerGrid localStream={null} variant="running-row" excludeMe={true} />
          </div>
      )}
    </main>
  );
}
