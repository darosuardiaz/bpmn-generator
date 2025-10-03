import { create } from "zustand"

export interface Message {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
  timestamp?: number
}

interface ChatStore {
  messages: Message[]
  conversationHistory: Array<{ role: string; content: string }>
  addMessage: (message: Message) => void
  updateLastMessage: (content: string) => void
  clearMessages: () => void
  addToHistory: (role: string, content: string) => void
  clearHistory: () => void
  removeMessage: (index: number) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  conversationHistory: [],
  
  addMessage: (message) =>
    set((state) => {
      // If streaming, update the last assistant message
      if (message.isStreaming && state.messages.length > 0) {
        const lastMessage = state.messages[state.messages.length - 1]
        if (lastMessage.role === "assistant") {
          return {
            messages: [
              ...state.messages.slice(0, -1),
              { ...lastMessage, content: message.content, isStreaming: true },
            ],
          }
        }
      }
      return {
        messages: [
          ...state.messages,
          { ...message, timestamp: message.timestamp || Date.now() },
        ],
      }
    }),

  updateLastMessage: (content) =>
    set((state) => {
      if (state.messages.length === 0) return state
      const messages = [...state.messages]
      messages[messages.length - 1] = {
        ...messages[messages.length - 1],
        content,
      }
      return { messages }
    }),

  clearMessages: () => set({ messages: [] }),

  addToHistory: (role, content) =>
    set((state) => ({
      conversationHistory: [...state.conversationHistory, { role, content }],
    })),

  clearHistory: () => set({ conversationHistory: [] }),

  removeMessage: (index) =>
    set((state) => ({
      messages: state.messages.filter((_, i) => i !== index),
    })),
}))
