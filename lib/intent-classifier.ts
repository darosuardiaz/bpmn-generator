import { openaiService } from "@/services/openai-service"

export enum IntentType {
  CREATE = "create",
  EDIT = "edit",
  INTERPRET = "interpret",
  GENERAL = "general",
}

export async function determineIntent(message: string, bpmnXml: string | null): Promise<IntentType> {
  const hasDiagram = bpmnXml && bpmnXml.length > 0

  const systemPrompt = `You are an intent classifier for a BPMN diagram assistant. 
Classify the user's intent into one of these categories:
- CREATE: User wants to create a new BPMN diagram from scratch
- EDIT: User wants to modify an existing BPMN diagram
- INTERPRET: User wants to understand or get an explanation of a BPMN diagram
- GENERAL: General questions or conversation

Current state: ${hasDiagram ? "A BPMN diagram exists" : "No BPMN diagram exists"}

Respond with only the intent type (CREATE, EDIT, INTERPRET, or GENERAL).`

  const response = await openaiService.createCompletionWithSystem(
    systemPrompt,
    message,
    { temperature: 0 }
  )

  const intent = response.trim().toUpperCase()

  if (intent === "CREATE") return IntentType.CREATE
  if (intent === "EDIT") return IntentType.EDIT
  if (intent === "INTERPRET") return IntentType.INTERPRET
  return IntentType.GENERAL
}
