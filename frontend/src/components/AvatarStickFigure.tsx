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
  isLeader?: boolean;
  isMoving?: boolean;
  facingRight?: boolean;
}

import idleImage from "@/assets/idle.png";
import walkingImage from "@/assets/walking.gif";

export function AvatarStickFigure({
  name,
  isMe,
  stream,
  cameraEnabled,
  className,
  lastVideoFrame,
  isLeader,
  isMoving,
  facingRight = true, // Default to true if undefined
}: AvatarStickFigureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      {/* Crown for Leader */}
      {isLeader && (
         <div className="absolute -top-12 text-3xl animate-bounce z-20">👑</div>
      )}

      {/* Main Character Container - Reduced by 30% (was 320px -> 224px) */}
      <div className="relative w-[224px] h-[224px]">
          {/* Character Images - Pre-rendered and toggled via opacity to prevent flickering */}
          
          {/* Walking GIF */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={walkingImage.src} 
            alt="Walking" 
            className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
            style={{
                opacity: isMoving ? 1 : 0,
                transform: `
                    translateY(12%)
                    scale(0.5) 
                    scaleX(${!facingRight ? -1 : 1})
                `
            }}
          />

          {/* Idle PNG */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={idleImage.src} 
            alt="Idle" 
            className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
            style={{
                opacity: isMoving ? 0 : 1,
                transform: `
                    translateY(5%)
                    scale(1) 
                    scaleX(${!facingRight ? -1 : 1})
                `
            }}
          />

          {/* Face Overlay - 98px */}
          <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[98px] h-[98px] z-10">
            {isMe && cameraEnabled && stream ? (
               <video
                 ref={videoRef}
                 autoPlay
                 playsInline
                 muted
                 className="w-full h-full rounded-full object-cover border-4 border-black scale-x-[-1]"
               />
            ) : !isMe && lastVideoFrame ? (
               <img
                 src={lastVideoFrame}
                 alt={name}
                 className="w-full h-full rounded-full object-cover border-4 border-black"
               />
            ) : (
              <div className="w-full h-full rounded-full border-4 border-black bg-slate-300 flex items-center justify-center overflow-hidden">
                 <span className="text-4xl font-bold uppercase text-black">
                   {name.slice(0, 2)}
                 </span>
              </div>
            )}
          </div>
      </div>
      
      {/* Name Label */}
      <div className="mt-1 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded-full flex gap-1 items-center z-20 whitespace-nowrap">
        {name} {isMe ? "(You)" : ""}
      </div>
    </div>
  );
}
