"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type CallState = "idle" | "outgoing" | "incoming" | "connected" | "ended";

export type CallSummary = {
  callStatus: "completed" | "declined" | "missed" | "cancelled";
  duration?: number;
  reason?: string;
};

interface AudioCallModalProps {
  callState: CallState;
  partnerName: string;
  partnerId: string;
  currentUserId: string;
  incomingSignal?: any;
  sendCallSignal: (signal: any) => void;
  onCloseCall: (summary?: CallSummary) => void;
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

  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Sync internal call state with props
  useEffect(() => {
    setActiveCallState(callState);
  }, [callState]);

  // Clean up WebRTC peer connection and audio tracks
  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingIceCandidatesRef.current = [];
    setDuration(0);
  }, []);

  // Helper to add pending candidates once remote description is set
  const processPendingIceCandidates = async (pc: RTCPeerConnection) => {
    while (pendingIceCandidatesRef.current.length > 0) {
      const candidate = pendingIceCandidatesRef.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding queued ICE candidate:", err);
        }
      }
    }
  };

  // Acquire high-quality microphone stream (48kHz sample rate, noise suppression)
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

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setActiveCallState("connected");
        setDuration(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
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
  }, [sendCallSignal]);

  // Handle incoming signaling messages from partner
  useEffect(() => {
    if (!incomingSignal) return;

    const handleSignal = async () => {
      const { type } = incomingSignal;

      if (type === "call_accepted") {
        // Partner accepted call -> Caller creates offer
        try {
          const pc = createPeerConnection();
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendCallSignal({ type: "offer", sdp: offer });
        } catch (err) {
          console.error("Error creating offer:", err);
          handleEndCall();
        }
      } else if (type === "offer") {
        // Receiver receives offer -> create answer
        try {
          const pc = createPeerConnection();
          await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal.sdp));
          await processPendingIceCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendCallSignal({ type: "answer", sdp: answer });
          setActiveCallState("connected");
        } catch (err) {
          console.error("Error handling offer:", err);
          handleEndCall();
        }
      } else if (type === "answer") {
        // Caller receives answer -> set remote description
        try {
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(incomingSignal.sdp));
            await processPendingIceCandidates(pcRef.current);
            setActiveCallState("connected");
          }
        } catch (err) {
          console.error("Error handling answer:", err);
        }
      } else if (type === "candidate") {
        // Add ICE candidate
        try {
          if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(incomingSignal.candidate));
          } else if (incomingSignal.candidate) {
            pendingIceCandidatesRef.current.push(incomingSignal.candidate);
          }
        } catch (err) {
          console.error("Error adding ice candidate:", err);
        }
      } else if (type === "reject" || type === "cancel" || type === "end") {
        cleanup();
        onCloseCall();
      }
    };

    handleSignal();
  }, [incomingSignal, createPeerConnection, sendCallSignal, cleanup, onCloseCall]);

  // Handle outgoing call setup when initiated by caller
  useEffect(() => {
    if (callState === "outgoing") {
      const setupCall = async () => {
        try {
          const pc = createPeerConnection();
          const localStream = await getHighQualityAudioStream();
          localStreamRef.current = localStream;
          localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
          sendCallSignal({ type: "call_request" });
        } catch (err) {
          console.error("Error acquiring mic for outgoing call:", err);
          handleEndCall();
        }
      };
      setupCall();
    }
  }, [callState]);

  // Accept incoming call (triggered on user click)
  const handleAcceptCall = async () => {
    try {
      const pc = createPeerConnection();
      const localStream = await getHighQualityAudioStream();
      localStreamRef.current = localStream;
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      sendCallSignal({ type: "call_accepted" });
      setActiveCallState("connected");
    } catch (err) {
      console.error("Error accepting call:", err);
      handleEndCall();
    }
  };

  // Reject incoming call
  const handleRejectCall = () => {
    sendCallSignal({ type: "reject" });
    cleanup();
    onCloseCall({ callStatus: "declined", reason: "Call declined" });
  };

  // End active call
  const handleEndCall = () => {
    sendCallSignal({ type: "end" });
    const currentDuration = duration;
    const isCallConnected = activeCallState === "connected";
    const isCallOutgoing = activeCallState === "outgoing";

    cleanup();
    onCloseCall({
      callStatus: isCallConnected ? "completed" : isCallOutgoing ? "cancelled" : "missed",
      duration: isCallConnected ? currentDuration : undefined,
      reason: isCallConnected
        ? undefined
        : isCallOutgoing
        ? "Cancelled by caller"
        : "Not answered",
    });
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
