import { useBpmnStore } from "@/store/bpmn-store"

export async function sendChatMessage(
  message: string,
  currentBpmnXml: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      bpmnXml: currentBpmnXml,
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to send message")
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  let accumulatedContent = ""

  if (!reader) {
    throw new Error("No response body")
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split("\n")

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6)
        if (data === "[DONE]") {
          continue
        }
        try {
          const parsed = JSON.parse(data)
          if (parsed.content) {
            accumulatedContent += parsed.content
            onChunk(accumulatedContent)
          }
          if (parsed.bpmnXml) {
            // Update the BPMN diagram
            useBpmnStore.getState().setBpmnXml(parsed.bpmnXml)
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }
}
