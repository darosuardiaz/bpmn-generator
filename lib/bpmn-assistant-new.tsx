/**
 * BPMN Assistant - Refactored Implementation
 * Uses the new architecture with JSON intermediate representation
 */

import { layoutProcess } from "bpmn-auto-layout"
import type { BPMNElement, MessageItem } from "@/services/bpmn/types"
import { validateBpmn } from "@/services/bpmn/validator"
import { BpmnXmlGenerator } from "@/services/bpmn/xml-generator"
import { BpmnJsonGenerator } from "@/services/bpmn/json-generator"
import { BpmnEditingService } from "@/services/bpmn/editing/editing-service"
import { defineChangeRequest } from "@/services/bpmn/editing/change-request"
import { renderCreatePrompt, renderRespondToQueryPrompt } from "@/services/bpmn/prompts/templates"
import { openaiService } from "@/services/openai-service"

const xmlGenerator = new BpmnXmlGenerator()
const jsonGenerator = new BpmnJsonGenerator()

/**
 * Convert message history to string format.
 */
function messageHistoryToString(messageHistory: MessageItem[]): string {
  return messageHistory
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n")
}

/**
 * Generate BPMN from user description.
 * Uses JSON intermediate format for better reliability.
 */
export async function generateBpmnFromDescription(
  description: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  maxRetries: number = 3
) {
  const messageHistory: MessageItem[] = [
    { role: "user", content: description },
  ]

  const prompt = renderCreatePrompt(messageHistoryToString(messageHistory))

  let attempts = 0

  while (attempts < maxRetries) {
    attempts++

    try {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ content: "Creating BPMN diagram..." })}\n\n`
        )
      )

      // Get JSON process from LLM
      const processData = await openaiService.createJsonCompletion(prompt, {
        temperature: 0.3,
        maxTokens: 3000,
      })

      const process: BPMNElement[] = processData.process

      // Validate the process
      validateBpmn(process)

      console.log("Generated BPMN process:", JSON.stringify(process, null, 2))

      // Convert to XML
      let bpmnXml = xmlGenerator.createBpmnXml(process)

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
          })}\n\n`
        )
      )

      return
    } catch (error) {
      console.warn(`Creation attempt ${attempts} failed:`, error)

      if (attempts >= maxRetries) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              content: `Failed to generate BPMN diagram after ${maxRetries} attempts. Error: ${
                error instanceof Error ? error.message : String(error)
              }`,
            })}\n\n`
          )
        )
        return
      }

      // Retry with error feedback
      const errorMessage = error instanceof Error ? error.message : String(error)
      const retryPrompt = `${prompt}\n\nPrevious attempt failed with error: ${errorMessage}\n\nPlease try again, ensuring the output is valid JSON with a "process" array.`
      
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ content: `Retrying (attempt ${attempts + 1}/${maxRetries})...` })}\n\n`
        )
      )
    }
  }
}

/**
 * Edit existing BPMN diagram based on instructions.
 */
export async function editBpmnFromInstructions(
  instructions: string,
  currentBpmnXml: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  try {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({ content: "Analyzing changes..." })}\n\n`
      )
    )

    // Convert XML to JSON
    const currentProcess = jsonGenerator.createBpmnJson(currentBpmnXml)

    console.log("Current process:", JSON.stringify(currentProcess, null, 2))

    // Define the change request
    const messageHistory: MessageItem[] = [
      { role: "user", content: instructions },
    ]

    const changeRequest = await defineChangeRequest(currentProcess, messageHistory)

    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({ content: "Applying edits..." })}\n\n`
      )
    )

    // Apply edits using the editing service
    const editingService = new BpmnEditingService(currentProcess, changeRequest)
    const updatedProcess = await editingService.editBpmn()

    console.log("Updated process:", JSON.stringify(updatedProcess, null, 2))

    // Validate the updated process
    validateBpmn(updatedProcess)

    // Convert to XML
    let bpmnXml = xmlGenerator.createBpmnXml(updatedProcess)

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
        })}\n\n`
      )
    )
  } catch (error) {
    console.error("Error editing BPMN:", error)
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          content: `Failed to edit BPMN diagram. Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        })}\n\n`
      )
    )
  }
}

/**
 * Interpret existing BPMN diagram.
 */
export async function interpretBpmnDiagram(
  bpmnXml: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  try {
    // Convert XML to JSON for better understanding
    const process = jsonGenerator.createBpmnJson(bpmnXml)

    const prompt = `You are a BPMN diagram interpreter. Explain this BPMN process in clear, natural language.

BPMN Process:
\`\`\`json
${JSON.stringify(process, null, 2)}
\`\`\`

Provide:
1. Overview of the process
2. Step-by-step flow description
3. Decision points (gateways) and their logic
4. Key tasks and their purposes
5. Start and end conditions

Be clear, concise, and use business-friendly language.`

    await openaiService.streamToController(prompt, controller, encoder)
  } catch (error) {
    console.error("Error interpreting BPMN:", error)
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          content: `Failed to interpret BPMN diagram. Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        })}\n\n`
      )
    )
  }
}

/**
 * Handle conversational queries.
 */
export async function handleConversation(
  message: string,
  bpmnXml: string | undefined,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  try {
    let process: BPMNElement[] | undefined

    if (bpmnXml) {
      try {
        process = jsonGenerator.createBpmnJson(bpmnXml)
      } catch (error) {
        console.warn("Failed to parse existing BPMN:", error)
      }
    }

    const messageHistory: MessageItem[] = [
      { role: "user", content: message },
    ]

    const prompt = renderRespondToQueryPrompt(
      messageHistoryToString(messageHistory),
      process ? JSON.stringify(process, null, 2) : undefined
    )

    await openaiService.streamToController(prompt, controller, encoder)
  } catch (error) {
    console.error("Error in conversation:", error)
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        })}\n\n`
      )
    )
  }
}
