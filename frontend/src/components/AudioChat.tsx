"use client";

import React, { useEffect, useRef } from "react";
import { useGameStore } from "@/store/useGameStore";
import { socketClient } from "@/lib/socket";

// Helper to convert Float32 (Web Audio) to Int16 (transport)
function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

// Helper: Int16 -> Float32
function int16ToFloat32(input: Int16Array): Float32Array {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const int = input[i];
        // If the high bit is set, it's a negative number in 16-bit 2's complement
        // But DataView.getInt16 handles sign. If we have raw array, standard conversion:
        output[i] = (int >= 0x8000) ? -(0x10000 - int) / 0x8000 : int / 0x7FFF;
    }
    return output;
}

// Better One: DataView based decoding from base64 string
function base64ToFloat32(base64: string): Float32Array {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] < 0 ? int16[i] / 0x8000 : int16[i] / 0x7FFF;
    }
    return float32;
}


interface AudioChatProps {
    visualState: Record<string, { x: number, y: number }>;
}

export function AudioChat({ visualState }: AudioChatProps) {
    const me = useGameStore(s => s.me);

    // Audio Context Refs
    const audioCtxRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Remote Peers State
    // access via refs to avoid closure staleness in message handlers
    const peerNodes = useRef<Record<string, { gain: GainNode, nextTime: number } | undefined>>({});

    // 1. Initialize Audio Context & Capture
    useEffect(() => {
        const initAudio = async () => {
            try {
                // Enhanced constraints for voice quality
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    }
                });

                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
                audioCtxRef.current = ctx;

                const source = ctx.createMediaStreamSource(stream);
                sourceRef.current = source;

                // Create Compressor for "Broadcast" Vocal Chain
                const compressor = ctx.createDynamicsCompressor();
                compressor.threshold.value = -20;  // Standard broadcast level
                compressor.knee.value = 10;        // Softer transition
                compressor.ratio.value = 4;        // 4:1 is standard for voice
                compressor.attack.value = 0.002;   // Fast attack to catch peaks
                compressor.release.value = 0.15;   // Natural release

                // Create Processor
                // BufferSize 16384 @ 48kHz = ~341ms.
                // Maximum stability, zero dropouts. High quality, high latency.
                const processor = ctx.createScriptProcessor(16384, 1, 1);
                processorRef.current = processor;

                processor.onaudioprocess = (e) => {
                    if (!socketClient) return;

                    const inputData = e.inputBuffer.getChannelData(0);

                    // Convert to Int16 PCM
                    // Compressor handles gaining, so we just clip safely
                    const buffer = new ArrayBuffer(inputData.length * 2);
                    const view = new DataView(buffer);

                    for (let i = 0; i < inputData.length; i++) {
                        const s = Math.max(-1, Math.min(1, inputData[i])); // Hard clip safe
                        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                    }

                    // Base64 encode
                    let binary = '';
                    const bytes = new Uint8Array(buffer);
                    const len = bytes.byteLength;
                    for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64 = window.btoa(binary);

                    socketClient.send("audio_update", { chunk: base64 });
                };

                // Connect graph
                source.connect(compressor);
                compressor.connect(processor);
                processor.connect(ctx.destination); // ScriptProcessor needs destination to run

            } catch (err) {
                console.error("Audio capture failed:", err);
            }
        };

        initAudio();

        return () => {
            processorRef.current?.disconnect();
            sourceRef.current?.disconnect();
            audioCtxRef.current?.close();
            // CRITICAL: Clear peer nodes because they belong to the closed context.
            peerNodes.current = {};
        };
    }, []);


    // 2. Handle Incoming Audio
    useEffect(() => {
        const handleAudioMsg = (e: CustomEvent) => {
            const data = e.detail;
            if (data.type !== "audio_update") return;
            if (data.id === me?.id) return; // Ignore self

            const ctx = audioCtxRef.current;
            if (!ctx || ctx.state === "closed") return;

            // Decode Chunk
            const float32 = base64ToFloat32(data.chunk);

            // Create Buffer
            const buffer = ctx.createBuffer(1, float32.length, 48000);
            buffer.copyToChannel(float32 as any, 0);

            // Get or Create Peer Node
            let peer = peerNodes.current[data.id];

            // Zombie Check: If peer exists but belongs to a different (old) context, kill it.
            if (peer && peer.gain.context !== ctx) {
                peer = undefined;
            }

            if (!peer) {
                const gainParams = ctx.createGain();
                gainParams.connect(ctx.destination);
                peer = { gain: gainParams, nextTime: ctx.currentTime };
                peerNodes.current[data.id] = peer;
            }

            // Create Source
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(peer.gain);

            // Schedule & Jitter Buffer Logic
            const NOW = ctx.currentTime;

            // Lag Compensation: if we ran dry > 50ms ago, reset to NOW (we ran dry).
            if (peer.nextTime < NOW - 0.05) {
                peer.nextTime = NOW;
            }

            // Buffer Bloat Compensation: if we are > 200ms ahead, jump forward.
            // This sacrifices some data to stay real-time.
            if (peer.nextTime > NOW + 0.2) {
                peer.nextTime = NOW;
            }

            const schedTime = peer.nextTime;
            source.start(schedTime);

            // Advance time
            peer.nextTime = schedTime + buffer.duration;
        };

        window.addEventListener("game_socket_message" as any, handleAudioMsg);
        return () => window.removeEventListener("game_socket_message" as any, handleAudioMsg);
    }, [me?.id]);


    // 3. Update Volumes based on Distance
    useEffect(() => {
        if (!visualState || !me) return;

        const myPos = visualState[me.id];
        if (!myPos) return;

        Object.entries(peerNodes.current).forEach(([id, peer]) => {
            if (!peer) return;
            const otherPos = visualState[id];
            if (!otherPos) return;

            const dist = Math.sqrt(
                Math.pow(otherPos.x - myPos.x, 2) + Math.pow(otherPos.y - myPos.y, 2)
            );

            // Full volume at 0-100px. Linear drop to 0 at 600px.
            const MAX_DIST = 600;
            const MIN_DIST = 100;

            let volume = 1;
            if (dist > MIN_DIST) {
                volume = 1 - (dist - MIN_DIST) / (MAX_DIST - MIN_DIST);
            }
            volume = Math.max(0, Math.min(1, volume));

            // Ease value
            try {
                if (audioCtxRef.current?.state === 'running') {
                    peer.gain.gain.setTargetAtTime(volume, audioCtxRef.current!.currentTime, 0.1);
                }
            } catch (e) {
                // ignore
            }
        });
    }, [visualState, me]); // Run whenever positions update (60fps potentially)

    return null; // Headless component
}
