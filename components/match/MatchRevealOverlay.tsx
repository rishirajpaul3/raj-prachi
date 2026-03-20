"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface MatchRevealOverlayProps {
  match: {
    id: string;
    roleTitle: string;
    companyName: string;
    introText: string;
  };
  onDismiss: () => void;
}

export function MatchRevealOverlay({ match, onDismiss }: MatchRevealOverlayProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Keyboard: Escape to dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss();
      router.push("/matches");
    }, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-300 ${
        isVisible ? "bg-black/50 backdrop-blur-sm" : "bg-transparent"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
    >
      <div
        className={`bg-white rounded-3xl mx-4 p-8 max-w-sm w-full text-center transition-all duration-300 ${
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-90"
        }`}
      >
        {/* Match animation */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-60" />
          <div className="relative w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-3xl">
            🎉
          </div>
        </div>

        <h2
          id="match-title"
          className="text-2xl font-bold text-gray-900 mb-1"
        >
          It's a match!
        </h2>
        <p className="text-amber-600 font-medium mb-1">{match.roleTitle}</p>
        <p className="text-gray-500 text-sm mb-6">{match.companyName}</p>

        <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left">
          <p className="text-xs text-gray-500 mb-1 font-medium">From Prachi:</p>
          <p className="text-sm text-gray-700 leading-relaxed italic">
            "{match.introText}"
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className="w-full py-3.5 bg-green-500 text-white font-semibold rounded-2xl hover:bg-green-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
          autoFocus
        >
          View Match →
        </button>

        <button
          onClick={handleDismiss}
          className="mt-3 text-sm text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:underline"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
