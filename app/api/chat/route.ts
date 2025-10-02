import { OpenAI } from "openai"
import { determineIntent, IntentType } from "@/lib/intent-classifier"
import { generateBpmnFromDescription, editBpmnFromInstructions, interpretBpmnDiagram } from "@/lib/bpmn-assistant"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
            // Generate new BPMN diagram
            await generateBpmnFromDescription(message, controller, encoder)
          } else if (intent === IntentType.EDIT) {
            // Edit existing BPMN diagram
            await editBpmnFromInstructions(message, bpmnXml, controller, encoder)
          } else if (intent === IntentType.INTERPRET) {
            // Interpret existing BPMN diagram
            await interpretBpmnDiagram(bpmnXml, controller, encoder)
          } else {
            // General conversation
            const completion = await openai.chat.completions.create({
              model: "gpt-4",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a helpful assistant for BPMN diagram creation and editing. Provide clear and concise responses.",
                },
                {
                  role: "user",
                  content: message,
                },
              ],
              stream: true,
            })

            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content || ""
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
              }
            }
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
