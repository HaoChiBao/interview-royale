import { create } from "zustand";
import { GamePhase, GameMode, Player, Question } from "@/types";

interface GameState {
  // Room
  roomCode: string | null;
  phase: GamePhase;
  mode: GameMode;
  
  // Players
  me: Player | null;
  others: Player[];
  
  // Round
  currentQuestion: Question | null;
  roundEndTime: number | null; // Timestamp
  roundDuration: number;
  
  // My State
  isReady: boolean;
  recordingBlob: Blob | null;
  recordingUrl: string | null;
  
  // Actions
  setRoomCode: (code: string) => void;
  setMe: (name: string) => void;
  setPhase: (phase: GamePhase) => void;
  setMode: (mode: GameMode) => void;
  addOtherPlayer: (player: Player) => void;
  updateOtherPlayer: (id: string, updates: Partial<Player>) => void;
  setReady: (ready: boolean) => void;
  setRound: (question: Question, duration: number) => void;
  setRecording: (blob: Blob | null) => void;
  setGrades: (grades: Record<string, { score: number; feedback: string[] }>) => void;
  resetRound: () => void;
  
  debugLogState: boolean;
  toggleDebugLogState: () => void;
  handleServerMessage: (msg: any) => void;
}

export const useGameStore = create<GameState>((set) => ({
  roomCode: null,
  phase: "LOBBY",
  mode: "BEHAVIOURAL",
  me: null,
  others: [],
  currentQuestion: null,
  roundEndTime: null,
  roundDuration: 60,
  isReady: false,
  recordingBlob: null,
  recordingUrl: null,

  debugLogState: false,
  toggleDebugLogState: () => set((state) => ({ debugLogState: !state.debugLogState })),

  setRoomCode: (code) => set({ roomCode: code }),
  setMe: (name) => set((prev) => ({ 
    me: { id: "me", name, isMe: true, cameraEnabled: true } // Default cam on
  })),
  setPhase: (phase) => set({ phase }),
  setMode: (mode) => set({ mode }),
  
  addOtherPlayer: (player) => set((state) => ({ 
    others: [...state.others, player] 
  })),
  
  updateOtherPlayer: (id, updates) => set((state) => ({
    others: state.others.map((p) => (p.id === id ? { ...p, ...updates } : p)),
  })),
  
  setReady: (ready) => set({ isReady: ready }),
  
  setRound: (question, duration) => set((state) => ({ 
    currentQuestion: question, 
    roundDuration: duration,
    roundEndTime: Date.now() + duration * 1000,
    phase: "ROUND",
    recordingBlob: null,
    recordingUrl: null,
    me: state.me ? { ...state.me, hasSubmitted: false } : null,
    others: state.others.map(p => ({ ...p, hasSubmitted: false }))
  })),
  
  setRecording: (blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      set((state) => ({
        recordingBlob: blob,
        recordingUrl: url,
        me: state.me ? { ...state.me, hasSubmitted: true } : null
       }));
    } else {
      set({ recordingBlob: null, recordingUrl: null });
    }
  },
  
  setGrades: (grades) => { /* Helper for local updates if needed */ },

  resetRound: () => set((state) => ({
    currentQuestion: null,
    roundEndTime: null,
    recordingBlob: null,
    recordingUrl: null,
  })),

  handleServerMessage: (msg: any) => {
    set((state) => {
      switch (msg.type) {
        case "player_update":
          // msg.players is a list of {username}.
          // Filter out me? The server logic is simple, assume "me" is managed locally by name matching?
          // Or we just update all "others" from the list excluding me.
          // Merge new list with existing state to preserve lastVideoFrame etc.
          const incomingUsernames = new Set(msg.players.map((p: any) => p.username));
          
          const mergedOthers = msg.players
             .filter((p: any) => p.username !== state.me?.name)
             .map((p: any) => {
                const existing = state.others.find(current => current.name === p.username);
                return {
                    id: p.username,
                    name: p.username,
                    isMe: false,
                    // Preserve existing state
                    lastVideoFrame: existing?.lastVideoFrame,
                    cameraEnabled: existing?.cameraEnabled,
                    ...p
                };
             });
          
          return { others: mergedOthers };

        case "new_question":
             // question, state="QUESTION"
             return {
                phase: "ROUND",
                currentQuestion: msg.question,
                roundDuration: 60, // Server doesn't send yet
                roundEndTime: Date.now() + 60 * 1000,
                recordingBlob: null,
                recordingUrl: null
             };

        case "grading_complete":
            // msg.result = {score, feedback}
            if (state.me) {
                return {
                    me: { ...state.me, score: msg.result.score, feedback: msg.result.feedback }
                };
            }
            return {};

        case "round_over":
             // msg.results = [ {username, score, feedback, content} ] sorted
             // We can map this to others and display leaderboard
             const allPlayers = msg.results.map((r: any) => ({
                 id: r.username,
                 name: r.username,
                 score: r.score,
                 feedback: r.feedback,
                 isMe: r.username === state.me?.name
             }));
             
             // Update others/me from this authoritative list
             // Actually, simplest is to just use this list for the results page?
             // But let's sync "others" state.
             const newOthers = allPlayers.filter((p: any) => !p.isMe);
             const myResult = allPlayers.find((p: any) => p.isMe);
             
             const newState: Partial<GameState> = { 
                 phase: "RESULTS",
                 others: newOthers
             };
             
             if (myResult && state.me) {
                 newState.me = { ...state.me, score: myResult.score, feedback: myResult.feedback };
             }
             
             return newState;

        case "video_update":
            // { type: "video_update", username, frame }
            if (msg.username === state.me?.name) return {}; // Ignore own echo
            
            return {
                others: state.others.map(p => 
                    p.name === msg.username 
                    ? { ...p, lastVideoFrame: msg.frame }
                    : p
                )
            };
             
        default:
          return {};
      }
    });
  }
}));
