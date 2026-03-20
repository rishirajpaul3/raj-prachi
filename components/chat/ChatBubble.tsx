import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  agent: "raj" | "prachi";
  isInterviewMode?: boolean;
}

/** Render a line with **bold** spans. */
function renderLine(line: string, key: number) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span key={key}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        )
      )}
    </span>
  );
}

export function ChatBubble({
  role,
  content,
  agent,
  isInterviewMode = false,
}: ChatBubbleProps) {
  const isUser = role === "user";
  const lines = content.split("\n");

  return (
    <div
      className={cn(
        "flex gap-2.5 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-200",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      {!isUser ? (
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1",
            agent === "raj" ? "bg-amber-600" : "bg-[#1E3A5F]"
          )}
          aria-hidden="true"
        >
          {agent === "raj" ? "R" : "P"}
        </div>
      ) : (
        <div
          className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold flex-shrink-0 mt-1"
          aria-hidden="true"
        >
          Y
        </div>
      )}

      <div
        className={cn(
          "max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-white text-gray-900 border border-gray-200 rounded-tr-sm"
            : agent === "raj"
            ? cn(
                "bg-amber-50 text-gray-900 rounded-tl-sm",
                isInterviewMode && "border-2 border-amber-300"
              )
            : "bg-blue-50 text-gray-900 rounded-tl-sm",
          isInterviewMode && !isUser && "shadow-sm"
        )}
      >
        {lines.map((line, i) => (
          <span key={i}>
            {renderLine(line, i)}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  );
}
