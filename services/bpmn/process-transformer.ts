/**
 * BPMN Process Transformer.
 * Based on legacy Python bpmn_process_transformer.py
 * 
 * Transforms hierarchical BPMN process structure (from LLM) into a flat structure
 * suitable for XML generation.
 * 
 * Hierarchical structure has nested branches in gateways.
 * Flat structure has all elements and flows at the same level.
 */

import type {
  BPMNElement,
  ExclusiveGateway,
  ParallelGateway,
  FlatBPMNStructure,
  FlatBPMNElement,
  SequenceFlow,
} from "./types"
import { isExclusiveGateway, isParallelGateway } from "./types"

export class BpmnProcessTransformer {
  private elements: FlatBPMNElement[] = []
  private flows: SequenceFlow[] = []

  /**
   * Transform hierarchical process structure to flat structure.
   * 
   * @param process - Hierarchical process array
   * @param parentNextElementId - ID of the next element in parent context
   * @returns Flat structure with elements and flows
   */
  transform(process: BPMNElement[], parentNextElementId: string | null = null): FlatBPMNStructure {
    this.elements = []
    this.flows = []

    this.processElements(process, parentNextElementId)

    // Add incoming and outgoing flow references to each element
    for (const element of this.elements) {
      element.incoming = this.flows
        .filter((flow) => flow.targetRef === element.id)
        .map((flow) => flow.id)
      element.outgoing = this.flows
        .filter((flow) => flow.sourceRef === element.id)
        .map((flow) => flow.id)
    }

    return {
      elements: this.elements,
      flows: this.flows,
    }
  }

  /**
   * Process array of elements, handling gateways specially.
   */
  private processElements(process: BPMNElement[], parentNextElementId: string | null): void {
    for (let index = 0; index < process.length; index++) {
      const element = process[index]
      const nextElementId =
        index < process.length - 1 ? process[index + 1].id : parentNextElementId

      // Add the element to the flat list
      this.elements.push({
        id: element.id,
        type: element.type,
        label: ("label" in element ? element.label : null) || null,
        incoming: [],
        outgoing: [],
      })

      if (isExclusiveGateway(element)) {
        const joinGatewayId = this.handleExclusiveGateway(element, nextElementId)

        // Connect join gateway to next element
        if (joinGatewayId && nextElementId) {
          this.addFlow(joinGatewayId, nextElementId)
        }
      } else if (isParallelGateway(element)) {
        const joinGatewayId = this.handleParallelGateway(element)

        // Connect join gateway to next element
        if (nextElementId) {
          this.addFlow(joinGatewayId, nextElementId)
        }
      } else if (nextElementId && element.type !== "endEvent") {
        // Add flow to next element for non-gateway, non-end elements
        this.addFlow(element.id, nextElementId)
      }
    }
  }

  /**
   * Handle exclusive gateway transformation.
   * 
   * @param element - Exclusive gateway element
   * @param nextElementId - ID of next element after gateway
   * @returns ID of join gateway if created, null otherwise
   */
  private handleExclusiveGateway(
    element: ExclusiveGateway,
    nextElementId: string | null
  ): string | null {
    let joinGatewayId: string | null = null

    // Create join gateway if specified
    if (element.has_join) {
      joinGatewayId = `${element.id}-join`
      this.elements.push({
        id: joinGatewayId,
        type: "exclusiveGateway",
        label: null,
        incoming: [],
        outgoing: [],
      })
    }

    // Process each branch
    for (const branch of element.branches) {
      if (!branch.path || branch.path.length === 0) {
        // Empty branch: connect directly to next element or branch's "next"
        const targetRef = branch.next || joinGatewayId || nextElementId
        if (targetRef) {
          this.addFlow(element.id, targetRef, undefined, branch.condition)
        }
        continue
      }

      // Determine where this branch should lead
      const branchNext = branch.next
      const branchTarget = branchNext || joinGatewayId || nextElementId

      // Transform the branch path
      const branchStructure = this.transformBranch(branch.path, branchTarget)

      // Merge branch elements and flows into main structure
      this.elements.push(...branchStructure.elements)
      this.flows.push(...branchStructure.flows)

      // Add flow from gateway to first element in branch
      if (branchStructure.elements.length > 0) {
        const firstElement = branchStructure.elements[0]
        this.addFlow(element.id, firstElement.id, undefined, branch.condition)
      }
    }

    return joinGatewayId
  }

  /**
   * Handle parallel gateway transformation.
   * 
   * @param element - Parallel gateway element
   * @returns ID of join gateway (always created for parallel gateways)
   */
  private handleParallelGateway(element: ParallelGateway): string {
    // Always create join gateway for parallel gateways
    const joinGatewayId = `${element.id}-join`
    this.elements.push({
      id: joinGatewayId,
      type: "parallelGateway",
      label: null,
      incoming: [],
      outgoing: [],
    })

    // Process each parallel branch
    for (const branch of element.branches) {
      const branchStructure = this.transformBranch(branch, joinGatewayId)

      // Merge branch elements and flows into main structure
      this.elements.push(...branchStructure.elements)
      this.flows.push(...branchStructure.flows)

      // Add flow from parallel gateway to first element in branch
      if (branchStructure.elements.length > 0) {
        const firstElement = branchStructure.elements[0]
        this.addFlow(element.id, firstElement.id)

        // Add flow from last element in branch to join gateway
        const lastElement = branchStructure.elements[branchStructure.elements.length - 1]
        this.addFlow(lastElement.id, joinGatewayId)
      }
    }

    return joinGatewayId
  }

  /**
   * Transform a branch (sub-process) into flat structure.
   * This creates a new transformer instance to avoid state pollution.
   * 
   * @param branch - Array of elements in the branch
   * @param nextElementId - ID of element after the branch
   * @returns Flat structure for the branch
   */
  private transformBranch(
    branch: BPMNElement[],
    nextElementId: string | null
  ): FlatBPMNStructure {
    const transformer = new BpmnProcessTransformer()
    return transformer.transform(branch, nextElementId)
  }

  /**
   * Add a flow to the flows array.
   * Prevents duplicate flows.
   * 
   * @param sourceRef - Source element ID
   * @param targetRef - Target element ID
   * @param flowId - Optional custom flow ID
   * @param condition - Optional condition label
   */
  private addFlow(
    sourceRef: string,
    targetRef: string,
    flowId?: string,
    condition?: string
  ): void {
    // Check if flow already exists
    const exists = this.flows.some(
      (flow) => flow.sourceRef === sourceRef && flow.targetRef === targetRef
    )

    if (exists) {
      return
    }

    const id = flowId || `${sourceRef}-${targetRef}`

    this.flows.push({
      id,
      sourceRef,
      targetRef,
      condition: condition || null,
    })
  }
}
