/**
 * OpenAI Service
 * Centralized wrapper for all OpenAI API calls
 * 
 * This service provides a clean interface for making completion requests
 * with different modes (JSON, streaming, text) and consistent configuration.
 */

import { OpenAI } from "openai"

/**
 * Configuration for completion requests
 */
interface CompletionConfig {
  temperature?: number
  maxTokens?: number
  responseFormat?: "json" | "text"
}

/**
 * OpenAI Service Class
 * Handles all interactions with OpenAI API
 */
export class OpenAIService {
  private client: OpenAI
  private model: string

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
    this.model = process.env.OPENAI_MODEL || "gpt-4"
  }

  /**
   * Get the current model being used
   */
  getModel(): string {
    return this.model
  }

  /**
   * Create a completion with JSON response format
   * Used for structured outputs like BPMN JSON, edit proposals
   */
  async createJsonCompletion(
    prompt: string,
    config: CompletionConfig = {}
  ): Promise<any> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      // temperature: config.temperature ?? 0.3,
      // max_tokens: config.maxTokens,
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error("No response from OpenAI")
    }

    return JSON.parse(content)
  }

  /**
   * Create a completion with text response
   * Used for change requests, conversational responses
   */
  async createTextCompletion(
    prompt: string,
    config: CompletionConfig = {}
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      // temperature: config.temperature ?? 0.4,
      // max_tokens: config.maxTokens,
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error("No response from OpenAI")
    }

    return content
  }

  /**
   * Create a streaming completion
   * Used for real-time responses in chat interface
   */
  async createStreamingCompletion(
    prompt: string,
    config: CompletionConfig = {}
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      // temperature: config.temperature ?? 0.3,
      // max_tokens: config.maxTokens,
      stream: true,
    })

    return stream
  }

  /**
   * Create a completion with system message
   * Used for intent classification and other system-guided tasks
   */
  async createCompletionWithSystem(
    systemPrompt: string,
    userMessage: string,
    config: CompletionConfig = {}
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      // temperature: config.temperature ?? 0,
      // max_tokens: config.maxTokens,
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error("No response from OpenAI")
    }

    return content
  }

  /**
   * Helper to stream content chunks to a controller
   * Abstracts the streaming logic for SSE endpoints
   */
  async streamToController(
    prompt: string,
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
    config: CompletionConfig = {}
  ): Promise<void> {
    const stream = await this.createStreamingCompletion(prompt, config)

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ""
      if (content) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
        )
      }
    }
  }
}

/**
 * Singleton instance of OpenAI service
 * Use this for all OpenAI interactions
 */
export const openaiService = new OpenAIService()
