"use client";

import React, { useEffect } from "react";
import { AvatarStickFigure } from "./AvatarStickFigure";
import { useGameStore } from "@/store/useGameStore";
import { getMediaStream } from "@/lib/media"; // Only if we want to grab stream inside here? Better passed down or grabbed in page.

interface PlayerGridProps {
  localStream: MediaStream | null;
}

export function PlayerGrid({ localStream }: PlayerGridProps) {
  const me = useGameStore((state) => state.me);
  const others = useGameStore((state) => state.others);
  
  // Combine all players
  const allPlayers = me ? [me, ...others] : others;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 p-4 w-full max-w-6xl mx-auto">
      {allPlayers.map((player) => (
        <div key={player.id} className="flex justify-center">
           <AvatarStickFigure
             name={player.name}
             isMe={player.isMe}
             stream={player.isMe ? localStream : undefined}
             cameraEnabled={player.cameraEnabled}
             lastVideoFrame={player.lastVideoFrame}
           />
        </div>
      ))}
    </div>
  );
}
