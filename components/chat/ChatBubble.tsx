import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  agent: "raj" | "prachi";
  isInterviewMode?: boolean;
}

export function ChatBubble({
  role,
  content,
  agent,
  isInterviewMode = false,
}: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {!isUser && (
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-1",
            agent === "raj" ? "bg-amber-600" : "bg-[#1E3A5F]"
          )}
          aria-hidden="true"
        >
          {agent === "raj" ? "R" : "P"}
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
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
        {/* Render newlines as line breaks */}
        {content.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            {i < content.split("\n").length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  );
}
