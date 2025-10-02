import { create } from "zustand"
import type BpmnModeler from "bpmn-js/lib/Modeler"

interface Message {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

interface BpmnStore {
  bpmnXml: string | null
  modeler: BpmnModeler | null
  messages: Message[]
  conversationHistory: Array<{ role: string; content: string }>
  setBpmnXml: (xml: string) => void
  setModeler: (modeler: BpmnModeler) => void
  addMessage: (message: Message) => void
  clearMessages: () => void
  addToHistory: (role: string, content: string) => void
  clearHistory: () => void
}

export const useBpmnStore = create<BpmnStore>((set) => ({
  bpmnXml: null,
  modeler: null,
  messages: [],
  conversationHistory: [],
  setBpmnXml: (xml) => set({ bpmnXml: xml }),
  setModeler: (modeler) => set({ modeler }),
  addMessage: (message) =>
    set((state) => {
      // If streaming, update the last assistant message
      if (message.isStreaming && state.messages.length > 0) {
        const lastMessage = state.messages[state.messages.length - 1]
        if (lastMessage.role === "assistant") {
          return {
            messages: [...state.messages.slice(0, -1), { ...lastMessage, content: message.content }],
          }
        }
      }
      return { messages: [...state.messages, message] }
    }),
  clearMessages: () => set({ messages: [] }),
  addToHistory: (role, content) =>
    set((state) => ({
      conversationHistory: [...state.conversationHistory, { role, content }],
    })),
  clearHistory: () => set({ conversationHistory: [] }),
}))
