"use client";

interface TypingIndicatorProps {
  agent: "raj" | "prachi";
}

export function TypingIndicator({ agent }: TypingIndicatorProps) {
  const name = agent === "raj" ? "Raj" : "Prachi";

  return (
    <div className="flex gap-3 mb-4" role="status" aria-live="polite" aria-label={`${name} is thinking`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
          agent === "raj" ? "bg-amber-600" : "bg-[#1E3A5F]"
        }`}
        aria-hidden="true"
      >
        {agent === "raj" ? "R" : "P"}
      </div>
      <div
        className={`px-4 py-3 rounded-2xl rounded-tl-sm ${
          agent === "raj" ? "bg-amber-50" : "bg-blue-50"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span
              className={`w-2 h-2 rounded-full animate-bounce ${
                agent === "raj" ? "bg-amber-400" : "bg-blue-400"
              }`}
              style={{ animationDelay: "0ms" }}
            />
            <span
              className={`w-2 h-2 rounded-full animate-bounce ${
                agent === "raj" ? "bg-amber-400" : "bg-blue-400"
              }`}
              style={{ animationDelay: "150ms" }}
            />
            <span
              className={`w-2 h-2 rounded-full animate-bounce ${
                agent === "raj" ? "bg-amber-400" : "bg-blue-400"
              }`}
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <span className="text-xs text-gray-500">{name} is thinking...</span>
        </div>
      </div>
    </div>
  );
}
