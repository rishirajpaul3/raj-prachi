"use client";

import { useState } from "react";
import { VoiceCallUI } from "./VoiceCallUI";

interface CallButtonProps {
  agent: "raj" | "prachi";
  agentName: string;
  roleId?: string;
}

export function CallButton({ agent, agentName, roleId }: CallButtonProps) {
  const [isCallActive, setIsCallActive] = useState(false);

  const handleCall = () => {
    // Web Speech API requires a user gesture to start — button click satisfies this
    if (!("speechSynthesis" in window)) {
      alert("Voice calls require a browser with Web Speech API support (Chrome, Edge, Safari).");
      return;
    }
    setIsCallActive(true);
  };

  return (
    <>
      <button
        onClick={handleCall}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          agent === "raj"
            ? "bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-400"
            : "bg-blue-50 text-[#1E3A5F] hover:bg-blue-100 focus-visible:ring-blue-400"
        }`}
        aria-label={`Start voice call with ${agentName}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-3.5 h-3.5"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 15.352V16.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z"
            clipRule="evenodd"
          />
        </svg>
        Call {agentName}
      </button>

      {isCallActive && (
        <VoiceCallUI
          agent={agent}
          agentName={agentName}
          roleId={roleId}
          onClose={() => setIsCallActive(false)}
        />
      )}
    </>
  );
}
