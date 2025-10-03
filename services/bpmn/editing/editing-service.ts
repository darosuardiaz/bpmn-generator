/**
 * BPMN Editing Service.
 * Based on legacy Python bpmn_editing_service.py
 * 
 * Orchestrates iterative editing of BPMN processes using LLM-generated function calls.
 */

import type { BPMNElement, EditProposal, IntermediateEditProposal } from "../types"
import { isStopSignal } from "../types"
import { validateElement } from "../validator"
import { renderEditPrompt } from "../prompts/templates"
import { openaiService } from "@/services/openai-service"
import {
  addElement,
  deleteElement,
  updateElement,
  moveElement,
  redirectBranch,
} from "./functions"

export class BpmnEditingService {
  constructor(
    private process: BPMNElement[],
    private changeRequest: string
  ) {}

  /**
   * Edit the BPMN process based on the change request.
   */
  async editBpmn(): Promise<BPMNElement[]> {
    let updatedProcess = await this.applyInitialEdit()
    updatedProcess = await this.applyIntermediateEdits(updatedProcess)
    return updatedProcess
  }

  /**
   * Apply the initial edit to the process.
   */
  private async applyInitialEdit(maxRetries: number = 4): Promise<BPMNElement[]> {
    let attempts = 0
    let prompt = renderEditPrompt(
      JSON.stringify(this.process, null, 2),
      this.changeRequest
    )

    while (attempts < maxRetries) {
      attempts++

      try {
        // Get edit proposal from LLM
        const editProposal = await openaiService.createJsonCompletion(
          prompt,
          { temperature: 0.3 }
        ) as EditProposal

        console.log("Edit proposal:", editProposal)

        // Validate and apply the edit
        this.validateEditProposal(editProposal, true)
        const updatedProcess = this.updateProcess(this.process, editProposal)

        return updatedProcess
      } catch (error) {
        console.warn(`Edit attempt ${attempts} failed:`, error)
        prompt = `Error: ${error instanceof Error ? error.message : String(error)}. Try again. Change request: ${this.changeRequest}`

        if (attempts >= maxRetries) {
          throw new Error("Max number of retries reached for initial edit")
        }
      }
    }

    throw new Error("Failed to apply initial edit")
  }

  /**
   * Apply intermediate edits iteratively until LLM signals stop.
   */
  private async applyIntermediateEdits(
    updatedProcess: BPMNElement[],
    maxRetries: number = 4,
    maxIterations: number = 15
  ): Promise<BPMNElement[]> {
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let attempts = 0
      let prompt = `The current process after previous edits:

\`\`\`json
${JSON.stringify(updatedProcess, null, 2)}
\`\`\`

If all changes from the change request have been applied, respond with:
\`\`\`json
{"stop": true}
\`\`\`

Otherwise, provide the next function call to continue editing the process.`

      while (attempts < maxRetries) {
        attempts++

        try {
          const editProposal = await openaiService.createJsonCompletion(
            prompt,
            { temperature: 0.3 }
          ) as IntermediateEditProposal

          console.log(`Intermediate edit ${iteration + 1}:`, editProposal)

          // Validate the proposal
          this.validateEditProposal(editProposal, false)

          // Check if we're done
          if (isStopSignal(editProposal)) {
            console.log("Edit process completed")
            return updatedProcess
          }

          // Apply the edit
          updatedProcess = this.updateProcess(updatedProcess, editProposal)
          break
        } catch (error) {
          console.warn(`Intermediate edit attempt ${attempts} failed:`, error)
          prompt = `Editing error: ${error instanceof Error ? error.message : String(error)}. Provide a new edit proposal.`

          if (attempts >= maxRetries) {
            throw new Error(
              `Edit iteration ${iteration + 1} failed after ${maxRetries} attempts`
            )
          }
        }
      }
    }

    throw new Error("Max number of editing iterations reached")
  }

  /**
   * Update the process based on an edit proposal.
   */
  private updateProcess(
    process: BPMNElement[],
    editProposal: EditProposal
  ): BPMNElement[] {
    const editFunctions = {
      delete_element: deleteElement,
      redirect_branch: redirectBranch,
      add_element: addElement,
      move_element: moveElement,
      update_element: updateElement,
    }

    const functionToCall = editFunctions[editProposal.function]
    if (!functionToCall) {
      throw new Error(`Unknown function: ${editProposal.function}`)
    }

    const args = editProposal.arguments

    // Call the appropriate function with spread arguments
    let result
    switch (editProposal.function) {
      case "delete_element":
        result = functionToCall(process, (args as any).element_id)
        break
      case "redirect_branch":
        result = functionToCall(
          process,
          (args as any).branch_condition,
          (args as any).next_id
        )
        break
      case "add_element":
        result = functionToCall(
          process,
          (args as any).element,
          (args as any).before_id,
          (args as any).after_id
        )
        break
      case "move_element":
        result = functionToCall(
          process,
          (args as any).element_id,
          (args as any).before_id,
          (args as any).after_id
        )
        break
      case "update_element":
        result = functionToCall(process, (args as any).new_element)
        break
    }

    return result.process
  }

  /**
   * Validate an edit proposal from the LLM.
   */
  private validateEditProposal(
    editProposal: any,
    isFirstEdit: boolean = true
  ): void {
    // Check for stop signal (only valid after first edit)
    if (!isFirstEdit && "stop" in editProposal) {
      if (Object.keys(editProposal).length > 1) {
        throw new Error("If 'stop' key is present, no other key should be provided")
      }
      return
    }

    // Validate function call structure
    if (!editProposal.function || !editProposal.arguments) {
      throw new Error("Function call should contain 'function' and 'arguments' keys")
    }

    const functionName = editProposal.function
    const args = editProposal.arguments

    // Validate based on function type
    switch (functionName) {
      case "delete_element":
        this.validateDeleteElement(args)
        break
      case "redirect_branch":
        this.validateRedirectBranch(args)
        break
      case "add_element":
        this.validateAddElement(args)
        break
      case "move_element":
        this.validateMoveElement(args)
        break
      case "update_element":
        this.validateUpdateElement(args)
        break
      default:
        throw new Error(`Function '${functionName}' not found`)
    }
  }

  private validateDeleteElement(args: any): void {
    if (!args.element_id) {
      throw new Error("Arguments should contain 'element_id' key")
    }
    if (Object.keys(args).length > 1) {
      throw new Error("Arguments should contain only 'element_id' key")
    }
  }

  private validateRedirectBranch(args: any): void {
    if (!args.branch_condition || !args.next_id) {
      throw new Error("Arguments should contain 'branch_condition' and 'next_id' keys")
    }
    if (Object.keys(args).length > 2) {
      throw new Error("Arguments should contain only 'branch_condition' and 'next_id' keys")
    }
  }

  private validateAddElement(args: any): void {
    if (!args.element) {
      throw new Error("Arguments should contain 'element' key")
    }
    if (args.before_id && args.after_id) {
      throw new Error("Only one of 'before_id' and 'after_id' should be provided")
    }
    if (!args.before_id && !args.after_id) {
      throw new Error("Either 'before_id' or 'after_id' should be provided")
    }
    if (Object.keys(args).length > 2) {
      throw new Error(
        "Arguments should contain only 'element' and either 'before_id' or 'after_id' keys"
      )
    }
    validateElement(args.element)
  }

  private validateMoveElement(args: any): void {
    if (!args.element_id) {
      throw new Error("Arguments should contain 'element_id' key")
    }
    if (args.before_id && args.after_id) {
      throw new Error("Only one of 'before_id' and 'after_id' should be provided")
    }
    if (!args.before_id && !args.after_id) {
      throw new Error("Either 'before_id' or 'after_id' should be provided")
    }
    if (Object.keys(args).length > 2) {
      throw new Error(
        "Arguments should contain only 'element_id' and either 'before_id' or 'after_id' keys"
      )
    }
  }

  private validateUpdateElement(args: any): void {
    if (!args.new_element) {
      throw new Error("Arguments should contain 'new_element' key")
    }
    if (Object.keys(args).length > 1) {
      throw new Error("Arguments should contain only 'new_element' key")
    }
    validateElement(args.new_element)
  }
}
