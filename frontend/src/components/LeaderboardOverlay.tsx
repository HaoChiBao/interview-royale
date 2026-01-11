import React from "react";
import { useGameStore } from "@/store/useGameStore";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function LeaderboardOverlay() {
    const phase = useGameStore((state) => state.phase);
    const leaderboard = useGameStore((state) => state.leaderboard);
    const me = useGameStore((state) => state.me);
    const others = useGameStore((state) => state.others);

    // 1. Only visible after game starts (Not in Lobby)
    if (phase === "LOBBY") {
        return null;
    }

    // 2. Derive display data
    // If leaderboard is empty, assume start of game -> everyone has 0
    let displayData: { username: string; score: number; id: string }[] = [];

    if (leaderboard.length > 0) {
        displayData = leaderboard.map(l => ({
            username: l.username,
            score: l.score,
            id: (l as any).user_id || l.username // Fallback
        }));
    } else {
        // Build from current players
        if (me) {
            displayData.push({ username: me.name, score: me.score || 0, id: me.id });
        }
        others.forEach(p => {
            displayData.push({ username: p.name, score: p.score || 0, id: p.id });
        });
        // Sort alphabetic or random initially? Or just keep order.
        // Let's sort by score (all 0) then name
        displayData.sort((a, b) => a.username.localeCompare(b.username));
    }

    return (
        <div className="fixed top-4 right-4 z-[60] w-72 animate-in slide-in-from-right-10 fade-in duration-500">
            <Card className="bg-white/95 backdrop-blur-md shadow-2xl border-white/40 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2 text-white">
                        <Trophy className="w-4 h-4 text-yellow-300 fill-current animate-pulse" />
                        <span className="font-bold text-sm tracking-widest uppercase">Leaderboard</span>
                    </div>
                    <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-0 text-[10px] m-0 font-mono">
                        TOP {displayData.length}
                    </Badge>
                </CardHeader>

                <CardContent className="p-0 max-h-[320px] overflow-y-auto">
                    {displayData.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground text-xs italic">
                            Waiting for players...
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {displayData.map((entry, index) => {
                                const isMe = entry.id === me?.id || entry.username === me?.name;
                                return (
                                    <div
                                        key={entry.id || index}
                                        className={cn(
                                            "flex items-center justify-between px-4 py-3 text-sm transition-all border-b border-zinc-50 last:border-0",
                                            isMe ? "bg-indigo-50/80 hover:bg-indigo-100/80" : "hover:bg-zinc-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={cn(
                                                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm",
                                                index === 0 ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900" :
                                                    index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900" :
                                                        index === 2 ? "bg-gradient-to-br from-orange-300 to-orange-400 text-orange-900" :
                                                            "bg-zinc-100 text-zinc-500"
                                            )}>
                                                {index + 1}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className={cn(
                                                    "truncate font-semibold",
                                                    isMe ? "text-indigo-700" : "text-zinc-700"
                                                )}>
                                                    {entry.username || "Unknown"}
                                                </span>
                                                {isMe && <span className="text-[9px] leading-none text-indigo-400 uppercase tracking-wider font-bold">You</span>}
                                            </div>
                                        </div>
                                        <span className={cn(
                                            "font-mono font-bold text-base",
                                            index < 3 ? "text-zinc-900" : "text-zinc-500"
                                        )}>
                                            {entry.score}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
