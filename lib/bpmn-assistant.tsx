import { OpenAI } from "openai"
import { layoutProcess } from "bpmn-auto-layout"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// System prompts from the original repository
const CREATE_SYSTEM_PROMPT = `You are a BPMN 2.0 diagram generator. Your task is to create valid BPMN 2.0 XML based on user descriptions.

IMPORTANT RULES:
1. Generate ONLY valid BPMN 2.0 XML
2. Use only these supported elements:
   - bpmn:task (generic task)
   - bpmn:userTask (task requiring human interaction)
   - bpmn:serviceTask (automated task)
   - bpmn:exclusiveGateway (XOR gateway - one path)
   - bpmn:parallelGateway (AND gateway - all paths)
   - bpmn:startEvent (process start)
   - bpmn:endEvent (process end)
   - bpmn:sequenceFlow (connections between elements)

3. Every element must have a unique ID
4. All elements must be connected with sequenceFlow
5. Process must start with startEvent and end with endEvent
6. Give meaningful names to all elements
7. Do NOT include any DI (diagram interchange) elements - layout will be added automatically
8. Wrap your response in <bpmn> tags

Example structure:
<bpmn>
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start"/>
    <bpmn:task id="Task_1" name="Do Something"/>
    <bpmn:endEvent id="EndEvent_1" name="End"/>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1"/>
  </bpmn:process>
</bpmn:definitions>
</bpmn>`

const EDIT_SYSTEM_PROMPT = `You are a BPMN 2.0 diagram editor. Your task is to modify existing BPMN diagrams based on user instructions.

IMPORTANT RULES:
1. Preserve the existing structure unless explicitly asked to change it
2. Use only supported elements (task, userTask, serviceTask, exclusiveGateway, parallelGateway, startEvent, endEvent)
3. Maintain all existing IDs unless removing elements
4. Generate new unique IDs for new elements
5. Ensure all connections (sequenceFlow) are valid
6. Keep meaningful names for all elements
7. Do NOT include DI elements - layout will be added automatically
8. Wrap your response in <bpmn> tags

When editing:
- ADD: Insert new elements and connect them appropriately
- REMOVE: Delete elements and their connections
- MODIFY: Change element names or types
- REORGANIZE: Restructure the flow`

const INTERPRET_SYSTEM_PROMPT = `You are a BPMN 2.0 diagram interpreter. Your task is to explain BPMN diagrams in clear, natural language.

Provide:
1. Overview of the process
2. Step-by-step flow description
3. Decision points (gateways) and their logic
4. Key tasks and their purposes
5. Start and end conditions

Be clear, concise, and use business-friendly language.`

export async function generateBpmnFromDescription(
  description: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  let fullResponse = ""

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: CREATE_SYSTEM_PROMPT },
      { role: "user", content: description },
    ],
    stream: true,
  })

  for await (const chunk of completion) {
    const content = chunk.choices[0]?.delta?.content || ""
    fullResponse += content

    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Creating BPMN diagram..." })}\n\n`))
  }

  // Extract BPMN XML from response
  const bpmnMatch = fullResponse.match(/<bpmn>([\s\S]*?)<\/bpmn>/)
  if (bpmnMatch) {
    let bpmnXml = bpmnMatch[1].trim()

    // Apply auto-layout
    try {
      bpmnXml = await layoutProcess(bpmnXml)
    } catch (error) {
      console.error("Layout error:", error)
    }

    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          content: "BPMN diagram created successfully!",
          bpmnXml,
        })}\n\n`,
      ),
    )
  } else {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          content: "Failed to generate valid BPMN diagram. Please try rephrasing your request.",
        })}\n\n`,
      ),
    )
  }
}

export async function editBpmnFromInstructions(
  instructions: string,
  currentBpmnXml: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  let fullResponse = ""

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: EDIT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Current BPMN diagram:\n${currentBpmnXml}\n\nInstructions: ${instructions}`,
      },
    ],
    stream: true,
  })

  for await (const chunk of completion) {
    const content = chunk.choices[0]?.delta?.content || ""
    fullResponse += content

    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "Editing BPMN diagram..." })}\n\n`))
  }

  // Extract BPMN XML from response
  const bpmnMatch = fullResponse.match(/<bpmn>([\s\S]*?)<\/bpmn>/)
  if (bpmnMatch) {
    let bpmnXml = bpmnMatch[1].trim()

    // Apply auto-layout
    try {
      bpmnXml = await layoutProcess(bpmnXml)
    } catch (error) {
      console.error("Layout error:", error)
    }

    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          content: "BPMN diagram updated successfully!",
          bpmnXml,
        })}\n\n`,
      ),
    )
  } else {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          content: "Failed to edit BPMN diagram. Please try rephrasing your request.",
        })}\n\n`,
      ),
    )
  }
}

export async function interpretBpmnDiagram(
  bpmnXml: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  let fullResponse = ""

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: INTERPRET_SYSTEM_PROMPT },
      { role: "user", content: `Explain this BPMN diagram:\n${bpmnXml}` },
    ],
    stream: true,
  })

  for await (const chunk of completion) {
    const content = chunk.choices[0]?.delta?.content || ""
    fullResponse += content

    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fullResponse })}\n\n`))
  }
}
