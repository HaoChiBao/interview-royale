"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { AvatarStickFigure } from "@/components/AvatarStickFigure";
import { getMediaStream } from "@/lib/media";
import { FakeServer } from "@/lib/fakeServer";
import { Loader2, Mic, Video, VideoOff, MicOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PreflightPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  
  const [name, setName] = useState<string>("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  
  // Load name from local storage
  useEffect(() => {
    const storedName = localStorage.getItem("interview-royale-name");
    if (storedName) setName(storedName);
  }, []);

  // Initialize camera
  useEffect(() => {
    let mounted = true;
    
    async function initMedia() {
      try {
        const s = await getMediaStream(true, true);
        if (mounted) {
          setStream(s);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error(err);
          setError("Could not access camera/microphone. Please allow permissions.");
          setCameraEnabled(false);
          // Try audio only? Or just fail gracefully
        }
      }
    }

    initMedia();

    return () => {
      mounted = false;
      // Don't stop tracks here if we want to pass them? 
      // Actually we restart stream in lobby or pass it? 
      // For MVP it's easier to verify here, then let Lobby acquire it again or context.
      // Ideally we'd have a MediaContext. But for now let's stop it to be safe.
      // Wait, if we stop it, the user sees flash.
      // Let's stop it here and re-acquire in Lobby/Game.
    };
  }, []);

  // Toggle helpers
  const toggleVideo = () => {
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track) {
         track.enabled = !track.enabled;
         setCameraEnabled(track.enabled);
      }
    }
  };

  const handleEnter = () => {
    if (!code || !name) return;
    
    // Stop local stream before navigating
    stream?.getTracks().forEach(t => t.stop());
    
    // We navigate first, then Lobby connects and joins.
    // Or we can connect here. But typically Lobby is where the socket connection is persistent.
    // Let's rely on Lobby to do the join as per our plan.
    router.push(`/room/${code}`);
  };

  if (!name || !code) {
    return <div className="p-8">Invalid session. Go back home.</div>;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white text-zinc-900">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 flex flex-col items-center gap-6">
          <CardTitle>Setup Your Avatar</CardTitle>
          
          <div className="relative flex justify-center py-8 w-full bg-zinc-100 rounded-lg dark:bg-zinc-900/50">
            <AvatarStickFigure
              name={name}
              isMe={true}
              stream={stream}
              cameraEnabled={cameraEnabled}
              className="scale-150"
            />
          </div>

          {error && (
            <Badge variant="destructive" className="mb-2">
              {error}
            </Badge>
          )}

          <div className="flex gap-4">
             <Button variant={cameraEnabled ? "default" : "secondary"} size="icon" onClick={toggleVideo} disabled={!stream}>
               {cameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
             </Button>
             <Button variant="secondary" size="icon" disabled>
               <Mic className="w-4 h-4" />
             </Button>
          </div>
          
          <div className="w-full text-center text-sm text-muted-foreground">
             Room: <span className="font-mono font-bold text-foreground">{code}</span>
          </div>

          <Button className="w-full" size="lg" onClick={handleEnter}>
            Enter Lobby
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
