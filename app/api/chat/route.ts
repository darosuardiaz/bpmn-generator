import { determineIntent, IntentType } from "@/lib/intent-classifier"
import {
  generateBpmnFromDescription,
  editBpmnFromInstructions,
  interpretBpmnDiagram,
  handleConversation,
} from "@/lib/bpmn-assistant"

export async function POST(req: Request) {
  try {
    const { message, bpmnXml } = await req.json()

    // Determine user intent
    const intent = await determineIntent(message, bpmnXml)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (intent === IntentType.CREATE) {
            // Generate new BPMN diagram using JSON-based approach
            await generateBpmnFromDescription(message, controller, encoder)
          } else if (intent === IntentType.EDIT) {
            // Edit existing BPMN diagram using iterative editing
            await editBpmnFromInstructions(message, bpmnXml, controller, encoder)
          } else if (intent === IntentType.INTERPRET) {
            // Interpret existing BPMN diagram
            await interpretBpmnDiagram(bpmnXml, controller, encoder)
          } else {
            // General conversation with context awareness
            await handleConversation(message, bpmnXml, controller, encoder)
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch (error) {
          console.error("Error in chat stream:", error)
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Error in chat API:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
