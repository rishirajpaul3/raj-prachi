"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface VoiceCallUIProps {
  agent: "raj" | "prachi";
  agentName: string;
  onClose: () => void;
  /** Optional roleId — passed to Prachi for job-specific conversations */
  roleId?: string;
}

// TypeScript shim for Web Speech API (not in lib.dom by default in all TS configs)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

export function VoiceCallUI({ agent, agentName, onClose, roleId }: VoiceCallUIProps) {
  const [phase, setPhase] = useState<"connecting" | "active" | "listening" | "speaking" | "ended">("connecting");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMutedRef = useRef(false);

  // Keep muted ref in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Format elapsed time MM:SS
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const speak = useCallback((text: string, onDone?: () => void) => {
    const synth = window.speechSynthesis;
    synthRef.current = synth;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = agent === "raj" ? 0.9 : 1.1;

    // Pick a voice — prefer a natural-sounding one
    const voices = synth.getVoices();
    const preferred =
      agent === "raj"
        ? voices.find((v) => /male|guy|david|alex/i.test(v.name)) ??
          voices.find((v) => v.lang === "en-US") ??
          voices[0]
        : voices.find((v) => /female|samantha|karen|victoria/i.test(v.name)) ??
          voices.find((v) => v.lang === "en-US") ??
          voices[0];

    if (preferred) utterance.voice = preferred;
    utterance.onend = () => onDone?.();
    utterance.onerror = () => onDone?.();

    setPhase("speaking");
    synth.speak(utterance);
  }, [agent]);

  const startListening = useCallback(() => {
    if (isMutedRef.current) return;

    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    setPhase("listening");
    setTranscript("");

    recognition.onresult = async (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      setTranscript(text);
      if (!text.trim()) {
        startListening();
        return;
      }

      setPhase("speaking");

      // Send to agent
      try {
        const endpoint = agent === "raj" ? "/api/agents/raj" : "/api/agents/prachi";
        const body: Record<string, unknown> = { message: text, conversationId };
        if (roleId) body.roleId = roleId;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error("Agent error");

        const data = (await res.json()) as {
          message: string;
          conversationId: string;
        };

        if (data.conversationId && !conversationId) {
          setConversationId(data.conversationId);
        }

        speak(data.message, () => {
          if (!isMutedRef.current) startListening();
          else setPhase("active");
        });
      } catch {
        speak("Sorry, I had trouble connecting. Try again.", () => startListening());
      }
    };

    recognition.onerror = () => {
      setPhase("active");
    };

    recognition.onend = () => {
      // Only restart if we're still in listening phase and not muted
      // (avoid restart loop — result handler starts new listen after speak)
    };

    recognition.start();
  }, [agent, conversationId, roleId, speak]);

  // Connect and play greeting
  useEffect(() => {
    const greeting =
      agent === "raj"
        ? "Hey, Raj here. What's on your mind?"
        : "Hi, this is Prachi. How can I help you prepare?";

    // Short delay to simulate connecting
    const connectTimer = setTimeout(() => {
      setPhase("active");
      // Greet, then start listening
      speak(greeting, () => startListening());
    }, 800);

    // Start call timer
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => {
      clearTimeout(connectTimer);
      if (timerRef.current) clearInterval(timerRef.current);
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endCall = () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("ended");
    setTimeout(onClose, 800);
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        recognitionRef.current?.stop();
        setPhase("active");
      } else {
        startListening();
      }
      return next;
    });
  };

  const agentColor = agent === "raj" ? "bg-amber-500" : "bg-[#1E3A5F]";
  const agentInitial = agentName[0];

  const phaseLabel =
    phase === "connecting"
      ? "Connecting..."
      : phase === "listening"
      ? "Listening..."
      : phase === "speaking"
      ? `${agentName} is speaking`
      : phase === "ended"
      ? "Call ended"
      : "On a call";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gray-950 text-white"
      role="dialog"
      aria-label={`Voice call with ${agentName}`}
    >
      {/* Top bar */}
      <div className="w-full flex items-center justify-center pt-12 pb-4">
        <div className="text-center">
          <p className="text-sm text-gray-400 font-medium">{phaseLabel}</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">
            {formatTime(elapsed)}
          </p>
        </div>
      </div>

      {/* Agent avatar */}
      <div className="flex flex-col items-center gap-4">
        <div
          className={`w-28 h-28 rounded-full ${agentColor} flex items-center justify-center text-5xl font-bold shadow-2xl ${
            phase === "speaking" ? "ring-4 ring-white/30 animate-pulse" : ""
          } ${phase === "listening" ? "ring-4 ring-green-400/50" : ""}`}
          aria-hidden="true"
        >
          {agentInitial}
        </div>
        <p className="text-xl font-semibold">{agentName}</p>
        {transcript && (
          <p className="text-sm text-gray-400 max-w-xs text-center px-4 italic">
            &ldquo;{transcript}&rdquo;
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="w-full px-8 pb-16 flex flex-col items-center gap-6">
        <div className="flex gap-8 items-center">
          {/* Mute button */}
          <button
            onClick={toggleMute}
            className={`w-16 h-16 rounded-full flex flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
              isMuted ? "bg-white text-gray-950" : "bg-gray-700 text-white hover:bg-gray-600"
            }`}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
              </svg>
            )}
            <span className="text-xs">{isMuted ? "Unmute" : "Mute"}</span>
          </button>

          {/* End call */}
          <button
            onClick={endCall}
            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
            aria-label="End call"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 rotate-[135deg]">
              <path fillRule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">End</span>
          </button>
        </div>

        <p className="text-xs text-gray-500">
          {phase === "listening" ? "Speak now" : phase === "speaking" ? "Wait for response" : "Tap mic to speak"}
        </p>
      </div>
    </div>
  );
}
