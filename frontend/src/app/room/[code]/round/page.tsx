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
import { LeaderboardOverlay } from "@/components/LeaderboardOverlay";

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
  }, [question]);

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
    <main className="min-h-screen flex flex-col p-4 md:p-6 bg-white text-zinc-900">
      <DebugLogButton />
      <LeaderboardOverlay />
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
            <div className="w-full max-w-2xl space-y-6 text-center">
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
                {hasSubmitted ? (
                  <div className="flex flex-col gap-4 animate-in fade-in">
                    <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded-lg flex items-center justify-between">
                      <span className="font-bold flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        Intermission Room
                      </span>
                      <span className="text-sm">Wait for others...</span>
                    </div>
                    <IntermissionCanvas />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {question.type === "technical" ? (
                      <div className="relative group">
                        <div className="absolute top-0 left-0 right-0 h-8 bg-zinc-800 rounded-t-lg flex items-center px-4 justify-between border-b border-zinc-700">
                          <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500/80" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                            <div className="w-3 h-3 rounded-full bg-green-500/80" />
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400">main.py</div>
                        </div>
                        <textarea
                          value={textAnswer || (question as any).starter_code || ""}
                          onChange={(e) => setTextAnswer(e.target.value)}
                          className="w-full min-h-[400px] mt-0 pt-10 p-4 rounded-lg bg-[#1e1e1e] text-zinc-100 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-zinc-700 shadow-inner font-ligatures-contextual"
                          spellCheck={false}
                          style={{ fontFamily: "'Fira Code', 'JetBrains Mono', monospace" }}
                        />
                      </div>
                    ) : (
                      <SpeechTextarea
                        value={textAnswer}
                        onChange={setTextAnswer}
                        placeholder="Type your answer or use microphone..."
                      />
                    )}

                    <Button
                      size="lg"
                      className="w-full text-lg"
                      disabled={!textAnswer.trim()}
                      onClick={handleSubmit}
                    >
                      Submit Answer
                    </Button>
                  </div>
                )}
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
