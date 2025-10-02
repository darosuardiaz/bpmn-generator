"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Loader2 } from "lucide-react"
import { useBpmnStore } from "@/store/bpmn-store"
import { ChatMessage } from "./chat-message"
import { sendChatMessage } from "@/services/chat-service"

export function ChatPanel() {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { messages, addMessage, bpmnXml } = useBpmnStore()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setIsLoading(true)

    // Add user message
    addMessage({
      role: "user",
      content: userMessage,
    })

    try {
      // Send message and get streaming response
      await sendChatMessage(userMessage, bpmnXml || "", (chunk) => {
        // Update the last assistant message with streaming content
        addMessage({
          role: "assistant",
          content: chunk,
          isStreaming: true,
        })
      })
    } catch (error) {
      console.error("Error sending message:", error)
      addMessage({
        role: "assistant",
        content: "Sorry, I encountered an error processing your request.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="border-b border-gray-200 px-6 py-4 bg-white">
        <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
        <p className="text-sm text-gray-600 mt-1">Ask me to create, edit, or explain BPMN diagrams</p>
      </div>

      <ScrollArea className="flex-1 px-6 py-4 bg-gray-50" ref={scrollRef}>
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-600 py-12">
              <p className="text-base mb-6 text-gray-700">Start a conversation to create or edit BPMN diagrams</p>
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Try asking:</p>
                <div className="space-y-2 text-sm">
                  <p className="text-blue-600 hover:text-blue-700 cursor-pointer">
                    "Create a simple order fulfillment process"
                  </p>
                  <p className="text-blue-600 hover:text-blue-700 cursor-pointer">"Add a user task for approval"</p>
                  <p className="text-blue-600 hover:text-blue-700 cursor-pointer">"Explain this diagram"</p>
                </div>
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-gray-200 px-6 py-4 bg-white">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you want to do..."
            className="min-h-[80px] max-h-[160px] resize-none bg-white text-gray-900 border-gray-300 placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="self-end h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
