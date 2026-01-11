

"use client";

import React, { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { socketClient } from "@/lib/socket";
import { AvatarStickFigure } from "./AvatarStickFigure";
import { cn } from "@/lib/utils";

// Linear interpolation helper
const lerp = (start: number, end: number, t: number) => {
  return start * (1 - t) + end * t;
};

export function IntermissionCanvas() {
    const me = useGameStore(s => s.me);
    const others = useGameStore(s => s.others);
    const intermissionEndTime = useGameStore(s => s.intermissionEndTime);
    
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const updateTimer = () => {
             if (!intermissionEndTime) {
                 setTimeLeft(0);
                 return;
             }
             const diff = Math.max(0, Math.floor((intermissionEndTime - Date.now()) / 1000));
             setTimeLeft(diff);
        };
        
        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        return () => clearInterval(timer);
    }, [intermissionEndTime]);
    
    // Local stream state
    const [stream, setStream] = useState<MediaStream | null>(null);

    // Visual state (interpolated positions)
    const [visualState, setVisualState] = useState<Record<string, {x: number, y: number}>>({});
    
    // Key state tracking to avoid spamming
    const pressedKeys = useRef<Set<string>>(new Set());

    // 1. Get User Media
    useEffect(() => {
        let localStream: MediaStream | null = null;
        const startVideo = async () => {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                setStream(localStream);
                
                // Video broadcasting is handled by VideoBroadcaster component in parent
            } catch (err) {
                console.error("Camera error:", err);
            }
        };

        const cleanupPromise = startVideo();
        return () => {
             // Cleanup stream
             stream?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // 2. Input Handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (["w","a","s","d"].includes(key)) {
                if (!pressedKeys.current.has(key)) {
                    pressedKeys.current.add(key);
                    socketClient.send("keydown", { key });
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (["w","a","s","d"].includes(key)) {
                pressedKeys.current.delete(key);
                socketClient.send("keyup", { key });
            }
        };

        const handleBlur = () => {
            // Clear all pressed keys on window blur to prevent "stuck" keys
            pressedKeys.current.forEach(key => {
                socketClient.send("keyup", { key });
            });
            pressedKeys.current.clear();
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener("blur", handleBlur);
        
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("blur", handleBlur);
        };
    }, []);

    // Refs for loop access
    const latestMe = useRef(me);
    const latestOthers = useRef(others);

    useEffect(() => {
        latestMe.current = me;
        latestOthers.current = others;
    }, [me, others]);

    // 3. Interpolation & Prediction Loop
    useEffect(() => {
        let animationFrameId: number;

        const loop = () => {
            setVisualState(prev => {
                const nextState: Record<string, {x: number, y: number}> = {};
                
                const curMe = latestMe.current;
                const curOthers = latestOthers.current;

                // Combine me and others
                const allPlayers = [
                    ...(curMe ? [curMe] : []),
                    ...curOthers
                ];

                allPlayers.forEach(p => {
                     // Target pos from server/store
                     const targetX = p.x ?? 400;
                     const targetY = p.y ?? 300;
                     
                     // Current visual pos
                     const current = prev[p.name] || { x: targetX, y: targetY };
                     
                     // Interpolate (lerp) for everyone including me
                     // Using 0.1 for smooth catch-up to 20hz server updates
                     const newX = lerp(current.x, targetX, 0.1);
                     const newY = lerp(current.y, targetY, 0.1);
                     
                     // Snap if very close to avoid micro-jitter
                     if (Math.abs(newX - targetX) < 1 && Math.abs(newY - targetY) < 1) {
                         nextState[p.name] = { x: targetX, y: targetY };
                     } else {
                         nextState[p.name] = { x: newX, y: newY };
                     }
                });
                
                return nextState;
            });

            animationFrameId = requestAnimationFrame(loop);
        };

        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, []); // Run ONCE on mount

    return (
        <div className="fixed inset-0 z-50 bg-slate-50 overflow-hidden">
             {/* Grid Background */}
             <div className="absolute inset-0 opacity-10 pointer-events-none" 
                  style={{ 
                      backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)", 
                      backgroundSize: "50px 50px" 
                  }} 
             />

             <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-white/90 px-6 py-2 rounded-full shadow-lg border border-blue-100 z-50 flex flex-col items-center">
                 <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                     Intermission
                 </h2>
                 <p className="text-xs text-muted-foreground">
                     {timeLeft > 0 
                       ? `Next round in ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`
                       : "Starting soon..."}
                 </p>
             </div>

             <div className="absolute bottom-8 left-8 bg-white/80 p-3 rounded-xl shadow backdrop-blur-sm text-sm text-slate-600 border border-slate-200">
                  Use <kbd className="bg-slate-200 px-1 rounded">WASD</kbd> to move
             </div>
             
             {/* DEBUG OVERLAY */}
             <div className="absolute top-20 left-8 bg-black/50 text-white text-xs p-2 pointer-events-none max-w-sm overflow-hidden">
                 Me: {me?.name} (Submitted: {String(me?.hasSubmitted)})<br/>
                 Others: {others.length}<br/>
                 Visual: {Object.keys(visualState).join(", ")}<br/>
                 Pos: {me?.name && JSON.stringify(visualState[me.name])}
             </div>

             {/* Render Players */}
             {Object.entries(visualState).map(([name, pos]) => {
                 const isMe = me?.name === name;
                 const player = isMe ? me : others.find(o => o.name === name);
                 
                 // Only show if submitted (or if it's me)
                 if (!isMe && !player?.hasSubmitted) return null;
                 // if (isMe && !me?.hasSubmitted) return null; // Relaxed filter: Always show Me
                 
                 return (
                     <div 
                        key={name}
                        className="absolute" // REMOVED transition-transform will-change-transform
                        style={{ 
                            transform: `translate(${pos.x}px, ${pos.y}px)`,
                            // Center the pivot
                            marginLeft: -30, // Half of width (approx)
                            marginTop: -40   // Half of height
                        }}
                     >
                        <AvatarStickFigure
                            name={name}
                            isMe={isMe}
                            stream={isMe ? stream : null}
                            cameraEnabled={true}
                            lastVideoFrame={player?.lastVideoFrame}
                        />
                     </div>
                 );
             })}
        </div>
    );
}
