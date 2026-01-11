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
import { LeaderboardOverlay } from "@/components/LeaderboardOverlay";
import titleImage from "@/assets/title.png";
import { getMediaStream } from "@/lib/media";

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

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

    // Acquire media for "Me" avatar
    useEffect(() => {
        let mounted = true;
        getMediaStream(true, true).then(s => {
            if (mounted) setLocalStream(s);
        }).catch(e => console.error(e));

        return () => {
            mounted = false;
        };
    }, []);

    const handleHome = () => {
        window.location.href = "/";
    };

    // Calculate podium and list
    // Leaderboard has { username, score }
    // We need to map this to Player objects from `others` and `me` to get video frames
    const fullLeaderboard = leaderboard.map((entry) => {
        const isMe = entry.username === me?.name;
        // Find player object
        const player = isMe ? me : others.find(p => p.name === entry.username);
        return {
            ...entry,
            isMe,
            playerObj: player
        };
    });

    const top3 = fullLeaderboard.slice(0, 3);
    const rest = fullLeaderboard.slice(3);

    const myScore = leaderboard.find(l => l.username === me?.name)?.score || 0;

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white text-zinc-900 overflow-hidden relative">
            {/* Logo Header */}
            <div className="mb-4 animate-in slide-in-from-top-10 fade-in duration-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={titleImage.src} alt="Interview Royale" className="h-24 md:h-32 object-contain" />
            </div>

            {/* My Score */}
            <h2 className="text-xl md:text-2xl font-bold text-zinc-800 mb-12 animate-in fade-in duration-1000 delay-300">
                Your Score: <span className="text-indigo-500">{myScore}pts</span>
            </h2>

            {/* Podium Section */}
            <div className="flex items-end justify-center gap-4 md:gap-8 mb-16 w-full max-w-4xl px-4 min-h-[300px]">
                {/* 2nd Place */}
                {top3[1] && (
                    <div className="flex flex-col items-center animate-in slide-in-from-bottom-20 fade-in duration-700 delay-500 z-10">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-slate-200/50 rounded-full blur-xl group-hover:bg-slate-300/50 transition-colors" />
                            <div className="bg-white p-3 rounded-xl shadow-xl -rotate-6 border-4 border-slate-300 relative z-10 w-[180px] md:w-[220px] flex flex-col items-center">
                                <AvatarStickFigure 
                                    name={top3[1].username}
                                    isMe={top3[1].isMe}
                                    stream={top3[1].isMe ? localStream : null}
                                    lastVideoFrame={top3[1].playerObj?.lastVideoFrame}
                                    cameraEnabled={true}
                                    className="scale-90"
                                />
                                <div className="mt-2 text-center">
                                    <div className="text-4xl font-black text-slate-300">#2</div>
                                    <div className="font-bold text-slate-700 leading-tight">{top3[1].username}</div>
                                    <div className="text-sm font-bold text-slate-400">{top3[1].score}pts</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 1st Place - Center */}
                {top3[0] && (
                    <div className="flex flex-col items-center animate-in slide-in-from-bottom-32 fade-in duration-700 delay-700 z-20 -mx-4 md:mx-0 order-first md:order-none mb-8 md:mb-0">
                        <div className="relative group">
                             <div className="absolute -inset-4 bg-yellow-200/50 rounded-full blur-2xl group-hover:bg-yellow-300/50 transition-colors animate-pulse" />
                             <div className="bg-white p-4 rounded-2xl shadow-2xl scale-110 border-4 border-yellow-400 relative z-10 w-[200px] md:w-[260px] flex flex-col items-center">
                                <div className="absolute -top-6 text-5xl animate-bounce">👑</div>
                                <AvatarStickFigure 
                                    name={top3[0].username}
                                    isMe={top3[0].isMe}
                                    stream={top3[0].isMe ? localStream : null}
                                    lastVideoFrame={top3[0].playerObj?.lastVideoFrame}
                                    cameraEnabled={true}
                                />
                                <div className="mt-4 text-center">
                                    <div className="text-5xl font-black text-yellow-400">#1</div>
                                    <div className="text-xl font-bold text-zinc-800 leading-tight">{top3[0].username}</div>
                                    <div className="font-bold text-yellow-600">{top3[0].score}pts</div>
                                </div>
                             </div>
                        </div>
                    </div>
                )}

                {/* 3rd Place */}
                {top3[2] && (
                    <div className="flex flex-col items-center animate-in slide-in-from-bottom-20 fade-in duration-700 delay-600 z-10">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-orange-200/50 rounded-full blur-xl group-hover:bg-orange-300/50 transition-colors" />
                            <div className="bg-white p-3 rounded-xl shadow-xl rotate-6 border-4 border-orange-300 relative z-10 w-[180px] md:w-[220px] flex flex-col items-center">
                                <AvatarStickFigure 
                                    name={top3[2].username}
                                    isMe={top3[2].isMe}
                                    stream={top3[2].isMe ? localStream : null}
                                    lastVideoFrame={top3[2].playerObj?.lastVideoFrame}
                                    cameraEnabled={true}
                                    className="scale-90"
                                />
                                <div className="mt-2 text-center">
                                    <div className="text-4xl font-black text-orange-300">#3</div>
                                    <div className="font-bold text-slate-700 leading-tight">{top3[2].username}</div>
                                    <div className="text-sm font-bold text-orange-400">{top3[2].score}pts</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Remaining List */}
            {rest.length > 0 && (
                <div className="w-full max-w-lg space-y-2 mb-8 animate-in fade-in duration-700 delay-1000">
                    {rest.map((entry, idx) => (
                        <div key={entry.username} className="flex items-center justify-between bg-zinc-100 p-3 rounded-lg border border-zinc-200">
                             <div className="flex items-center gap-4">
                                <span className="font-black text-zinc-400 text-lg">#{idx + 4}</span>
                                <span className="font-bold text-zinc-700">{entry.username}</span>
                             </div>
                             <span className="font-bold text-zinc-500">{entry.score}pts</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Back Button */}
            <Button 
                onClick={handleHome}
                className="bg-zinc-900 text-white hover:bg-zinc-800 text-lg px-8 py-6 rounded-xl font-bold shadow-xl transition-transform hover:scale-105 active:scale-95 animate-in fade-in duration-700 delay-1000"
            >
                Back To Home
            </Button>

        </main>
    );
}
