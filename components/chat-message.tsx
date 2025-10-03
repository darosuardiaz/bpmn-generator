"use client"

import { cn } from "@/lib/utils"
import { User, Bot } from "lucide-react"
import type { Message } from "@/store/chat-store"

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          isUser ? "bg-primary" : "bg-secondary",
        )}
      >
        {isUser ? <User className="w-4 h-4 text-primary-foreground" /> : <Bot className="w-4 h-4 text-foreground" />}
      </div>
      <div
        className={cn(
          "flex-1 rounded-lg p-3 max-w-[80%]",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  )
}
