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

export default function RoundPage() {
  const router = useRouter();
  const { code } = useParams();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  
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
  // const recordingBlob = useGameStore(s => s.recordingBlob);
  // const setRecording = useGameStore(s => s.setRecording);

  // Sync phase
  useEffect(() => {
    if (phase === "GRADING") {
      router.push(`/room/${code}/grading`);
    } else if (phase === "LOBBY") {
       router.push(`/room/${code}`);
    }
  }, [phase, code, router]);

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
       // Auto submit text fallback or empty
       socketClient.submit("Time expired, no answer.");
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
    <main className="min-h-screen flex flex-col p-4 md:p-6 bg-white text-zinc-900">
      <DebugLogButton />
      {localStream && <VideoBroadcaster stream={localStream} />}
      {/* Top Bar: Timer & Question */}
      <div className="flex justify-between items-start mb-6 gap-4">
        <Card className="flex-1 bg-white border-zinc-200 shadow-sm">
           <CardContent className="p-6">
             <div className="text-sm font-bold text-indigo-500 mb-1 uppercase tracking-wider">
               {question.type} Question
             </div>
             <div className="text-2xl md:text-3xl font-medium leading-tight text-foreground">
               {question.prompt}
             </div>
           </CardContent>
        </Card>
        
        <Card className="w-32 flex justify-center items-center bg-zinc-900 text-white">
           <CardContent className="p-4 flex flex-col items-center">
             <span className="text-xs uppercase font-bold opacity-70">Time Left</span>
             <Timer endTime={roundEndTime} onExpire={handleExpire} />
           </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1">
        {/* Main Stage: Recorder & Preview */}
        <div className="md:col-span-3 flex flex-col gap-4">
           {/* If we have a local stream, show rendering here? User usually sees themselves big or just the instruction? 
               Requirement: "Player grid mini view (small)"
               Actually Render `AvatarStickFigure` for self is usually checking webcam.
               But `Recorder` manages the preview? 
               Let's put `Recorder` in main area.
           */}
           <Card className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50 border-dashed">
              <div className="w-full max-w-md space-y-6 text-center">
                 {/* Video Preview */}
                 <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
                    {localStream && (
                      <video 
                        ref={videoRef}
                        autoPlay muted playsInline 
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    )}
                 </div>
                 
                 {/* Input Methods Tabs/Toggle could go here, for now stacked */}
                 
                  <div className="space-y-4">
                     <SpeechTextarea 
                       value={textAnswer}
                       onChange={setTextAnswer}
                       placeholder="Type your answer or use microphone..."
                     />
                     <Button 
                       size="lg" 
                       className="w-full text-lg" 
                       disabled={!textAnswer.trim()}
                       onClick={handleSubmit}
                     >
                       Submit Answer
                     </Button>
                  </div>

                 {/* Status Messages */}
                 

              </div>
           </Card>
        </div>

        {/* Sidebar: Mini Player Grid */}
        <div className="md:col-span-1 overflow-y-auto max-h-[calc(100vh-120px)] rounded-lg bg-zinc-50 p-4 border block">
           <h3 className="font-bold text-sm mb-4 uppercase tracking-wider text-muted-foreground">Competitors</h3>
           <div className="flex flex-col gap-4">
             {/* We can reuse PlayerGrid with override class or just map manually for mini view.
                 PlayerGrid is grid-cols-2 by default. Let's make a MiniPlayerList component or just map here. 
                 Mapping implementation is safer for layout control.
             */}
             <PlayerGrid localStream={localStream} /> 
             {/* PlayerGrid component uses grid layout. It might look okay if container is small (grid-cols-2 forced). 
                 Actually PlayerGrid is `grid-cols-2 md:grid-cols-3`. Ideally we want `grid-cols-1` or `2` here.
                 Let's stick with specific specific mapping here or just use PlayerGrid inside a small container which forces wrap.
             */}
           </div>
        </div>
      </div>
    </main>
  );
}
