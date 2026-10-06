"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type CallState = "idle" | "outgoing" | "incoming" | "connected" | "ended";

interface AudioCallModalProps {
  callState: CallState;
  partnerName: string;
  partnerId: string;
  currentUserId: string;
  incomingSignal?: any;
  sendCallSignal: (signal: any) => void;
  onCloseCall: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function AudioCallModal({
  callState,
  partnerName,
  partnerId,
  currentUserId,
  incomingSignal,
  sendCallSignal,
  onCloseCall,
}: AudioCallModalProps) {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [activeCallState, setActiveCallState] = useState<CallState>(callState);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneOscRef = useRef<OscillatorNode | null>(null);

  // Sync internal state with prop state
  useEffect(() => {
    setActiveCallState(callState);
  }, [callState]);

  // Clean up WebRTC peer connection and tracks
  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (ringtoneOscRef.current) {
      try { ringtoneOscRef.current.stop(); } catch {}
      ringtoneOscRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setDuration(0);
  }, []);

  // Helper to play ringing tone using Web Audio API
  const playRingtone = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ringtoneOscRef.current = osc;
    } catch (e) {
      console.warn("Ringtone play error:", e);
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneOscRef.current) {
      try { ringtoneOscRef.current.stop(); } catch {}
      ringtoneOscRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
  }, []);

  // Acquire high-quality microphone stream (same constraints as voice recorder)
  const getHighQualityAudioStream = async () => {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 1 },
      },
      video: false,
    });
  };

  // Initialize WebRTC Peer Connection
  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendCallSignal({ type: "candidate", candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(console.error);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        stopRingtone();
        setActiveCallState("connected");
        setDuration(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        handleEndCall();
      }
    };

    return pc;
  }, [sendCallSignal, stopRingtone]);

  // Handle incoming signaling messages from partner
  useEffect(() => {
    if (!incomingSignal) return;

    const handleSignal = async () => {
      const { type } = incomingSignal;

      if (type === "offer") {
        try {
          const pc = createPeerConnection();
          const localStream = await getHighQualityAudioStream();
          localStreamRef.current = localStream;
          localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

          await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendCallSignal({ type: "answer", sdp: answer });
        } catch (err) {
          console.error("Error handling offer:", err);
          handleEndCall();
        }
      } else if (type === "answer") {
        try {
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(incomingSignal.sdp));
          }
        } catch (err) {
          console.error("Error handling answer:", err);
        }
      } else if (type === "candidate") {
        try {
          if (pcRef.current && incomingSignal.candidate) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(incomingSignal.candidate));
          }
        } catch (err) {
          console.error("Error adding ice candidate:", err);
        }
      } else if (type === "reject" || type === "cancel" || type === "end") {
        stopRingtone();
        cleanup();
        onCloseCall();
      }
    };

    handleSignal();
  }, [incomingSignal, createPeerConnection, sendCallSignal, stopRingtone, cleanup, onCloseCall]);

  // Handle outgoing call setup when initiated
  useEffect(() => {
    if (callState === "outgoing") {
      playRingtone();
      const setupCall = async () => {
        try {
          const pc = createPeerConnection();
          const localStream = await getHighQualityAudioStream();
          localStreamRef.current = localStream;
          localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          sendCallSignal({ type: "call_request" });
          sendCallSignal({ type: "offer", sdp: offer });
        } catch (err) {
          console.error("Error setting up outgoing call:", err);
          handleEndCall();
        }
      };
      setupCall();
    } else if (callState === "incoming") {
      playRingtone();
    }
  }, [callState]);

  // Accept incoming call
  const handleAcceptCall = async () => {
    stopRingtone();
    // Signal to caller that we accepted; offer processing happens when offer signal arrives
    sendCallSignal({ type: "accept_request" });
  };

  // Reject incoming call
  const handleRejectCall = () => {
    stopRingtone();
    sendCallSignal({ type: "reject" });
    cleanup();
    onCloseCall();
  };

  // End active call
  const handleEndCall = () => {
    stopRingtone();
    sendCallSignal({ type: "end" });
    cleanup();
    onCloseCall();
  };

  // Toggle Mute Microphone
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
  };

  if (activeCallState === "idle") return null;

  const partnerInitial = partnerName ? partnerName.charAt(0).toUpperCase() : "P";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/85 backdrop-blur-lg p-4 animate-fade-up">
      {/* Hidden audio element for WebRTC remote output */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink-900 shadow-2xl p-8 flex flex-col items-center text-center space-y-6 relative overflow-hidden">
        {/* Glowing Background Accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-teal-soft/20 blur-3xl pointer-events-none" />

        {/* Partner Avatar with Pulse effect */}
        <div className="relative my-2">
          <div className="absolute inset-0 rounded-full bg-teal-soft/20 animate-ping" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-teal-soft via-teal-deep to-plum font-bold text-ink-950 text-4xl shadow-xl border-4 border-ink-900">
            {partnerInitial}
          </div>
        </div>

        {/* Partner Name & Status */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold font-serif text-mist">{partnerName}</h2>
          <p className="text-xs font-mono text-teal-soft tracking-wide">
            {activeCallState === "outgoing" && "Calling..."}
            {activeCallState === "incoming" && "Incoming Audio Call..."}
            {activeCallState === "connected" && `In Call • ${formatDuration(duration)}`}
            {activeCallState === "ended" && "Call Ended"}
          </p>
          {activeCallState === "connected" && (
            <p className="text-[10px] text-mist-dim/80 font-mono">HD 48kHz Opus Audio</p>
          )}
        </div>

        {/* Call Actions */}
        <div className="w-full pt-4 border-t border-white/10 flex items-center justify-center gap-6">
          {activeCallState === "incoming" && (
            <>
              {/* Reject Button */}
              <button
                type="button"
                onClick={handleRejectCall}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xl shadow-lg transition transform active:scale-95"
                title="Decline Call"
              >
                ✕
              </button>
              {/* Accept Button */}
              <button
                type="button"
                onClick={handleAcceptCall}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-500 hover:bg-teal-400 text-ink-950 text-xl shadow-lg transition transform active:scale-95 animate-pulse"
                title="Accept Call"
              >
                📞
              </button>
            </>
          )}

          {activeCallState === "outgoing" && (
            <button
              type="button"
              onClick={handleEndCall}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xl shadow-lg transition transform active:scale-95"
              title="Cancel Call"
            >
              ✕
            </button>
          )}

          {activeCallState === "connected" && (
            <>
              {/* Mute Button */}
              <button
                type="button"
                onClick={toggleMute}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition shadow-md ${
                  isMuted
                    ? "bg-rose-500/20 text-rose-soft border border-rose-500/40"
                    : "bg-white/10 text-mist hover:bg-white/20"
                }`}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? "🔇" : "🎙️"}
              </button>

              {/* End Call Button */}
              <button
                type="button"
                onClick={handleEndCall}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xl shadow-lg transition transform active:scale-95"
                title="End Call"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
