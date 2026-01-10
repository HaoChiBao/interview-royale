import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AvatarStickFigureProps {
  name: string;
  isMe: boolean;
  stream?: MediaStream | null; // Only for 'me'
  cameraEnabled?: boolean;
  className?: string;
  seed?: string; // For bot randomization if needed
  lastVideoFrame?: string;
}

export function AvatarStickFigure({
  name,
  isMe,
  stream,
  cameraEnabled,
  className,
  lastVideoFrame,
}: AvatarStickFigureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);



  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      {/* Head */}
      <div className="relative w-24 h-24 mb-[-10px] z-10">
        {isMe && cameraEnabled && stream ? (
           <video
             ref={videoRef}
             autoPlay
             playsInline
             muted
             className="w-full h-full rounded-full object-cover border-[3px] border-black scale-x-[-1]"
           />
        ) : !isMe && lastVideoFrame ? (
           <img
             src={lastVideoFrame}
             alt={name}
             className="w-full h-full rounded-full object-cover border-[3px] border-black"
           />
        ) : (
          <div className="w-full h-full rounded-full border-2 border-black bg-gradient-to-br from-indigo-200 to-purple-200 flex items-center justify-center">
             <span className="text-xl font-bold uppercase text-black">
               {name.slice(0, 2)}
             </span>
          </div>
        )}
      </div>

      {/* Stick Body */}
      <svg
        width="60"
        height="80"
        viewBox="0 0 100 120"
        fill="none"
        stroke="black"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-[-5px] z-0"
      >
        {/* Torso */}
        <line x1="50" y1="0" x2="50" y2="50" />
        {/* Arms (Cute curved up/down) */}
        <path d="M25 25 Q50 25 75 25" />
        {/* Legs (Cute small stance) */}
        <path d="M50 50 L30 90" />
        <path d="M50 50 L70 90" />
      </svg>
      
      {/* Name Label */}
      <div className="mt-2 bg-black/80 text-white text-xs px-2 py-1 rounded-full">
        {name} {isMe ? "(You)" : ""}
      </div>
    </div>
  );
}
