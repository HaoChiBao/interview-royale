import React, { useEffect, useRef } from "react";
import { socketClient } from "@/lib/socket";

interface VideoBroadcasterProps {
  stream: MediaStream | null;
}

export function VideoBroadcaster({ stream }: VideoBroadcasterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    // Silence AbortError (interrupted by load/pause) which is common during re-renders
    video.play().catch(() => {});

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Throttle to 10 FPS (100ms)
    const interval = setInterval(() => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Center crop to square (1:1)
        const size = 150;
        const vRatio = video.videoWidth / video.videoHeight;
        let sx, sy, sWidth, sHeight;

        if (vRatio > 1) {
          // Landscape: crop width
          sHeight = video.videoHeight;
          sWidth = sHeight; // 1:1
          sx = (video.videoWidth - sWidth) / 2;
          sy = 0;
        } else {
          // Portrait: crop height
          sWidth = video.videoWidth;
          sHeight = sWidth; // 1:1
          sx = 0;
          sy = (video.videoHeight - sHeight) / 2;
        }
        
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, size, size);
        
        // Compress to JPEG 0.5 quality
        const frame = canvasRef.current!.toDataURL("image/jpeg", 0.5);
        socketClient.sendVideoFrame(frame);
      }
    }, 100);

    // outputting "The play() request was interrupted by a call to pause()"
    // We can just clear srcObject and let GC handle it, or check promise.
    // Simplest fix: don't force pause on unmount for a detached element, 
    // just nullify srcObject which stops stream usage.
    return () => {
      clearInterval(interval);
      video.srcObject = null; 
      // video.pause(); // REMOVED to prevent AbortError if play() is pending
    };
  }, [stream]);

  // Invisible canvas
  return <canvas ref={canvasRef} width={150} height={150} className="hidden" />;
}
