/**
 * Change Request Definition.
 * Based on legacy Python define_change_request.py
 * 
 * Generates a structured change request from user messages.
 */

import type { BPMNElement, MessageItem } from "../types"
import { renderDefineChangeRequestPrompt } from "../prompts/templates"
import { openaiService } from "@/services/openai-service"

/**
 * Convert message history to string format.
 */
function messageHistoryToString(messageHistory: MessageItem[]): string {
  return messageHistory
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n")
}

/**
 * Define the change request based on user messages.
 * 
 * @param process - Current BPMN process
 * @param messageHistory - Message history with user
 * @returns Change request string
 */
export async function defineChangeRequest(
  process: BPMNElement[],
  messageHistory: MessageItem[]
): Promise<string> {
  const prompt = renderDefineChangeRequestPrompt(
    JSON.stringify(process, null, 2),
    messageHistoryToString(messageHistory)
  )

  const changeRequest = await openaiService.createTextCompletion(prompt, {
    temperature: 0.4,
    maxTokens: 5000,
  })

  console.log("Change request:", changeRequest)

  return changeRequest
}
