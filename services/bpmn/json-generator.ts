/**
 * BPMN JSON Generator.
 * Based on legacy Python bpmn_json_generator.py
 * 
 * Converts BPMN XML to hierarchical JSON representation.
 * This is the inverse operation of xml-generator.ts
 */

import type { BPMNElement } from "./types"

interface ElementInfo {
  type: string
  id: string
  label?: string
}

interface FlowInfo {
  id: string
  source: string
  target: string
  condition?: string
}

export class BpmnJsonGenerator {
  private elements: Map<string, ElementInfo> = new Map()
  private flows: Map<string, FlowInfo> = new Map()

  /**
   * Create hierarchical JSON from BPMN XML.
   * 
   * @param bpmnXml - BPMN 2.0 XML string
   * @returns Hierarchical process array
   */
  createBpmnJson(bpmnXml: string): BPMNElement[] {
    this.elements = new Map()
    this.flows = new Map()

    // Parse XML
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(bpmnXml, "text/xml")

    // Check for parse errors
    const parseError = xmlDoc.querySelector("parsererror")
    if (parseError) {
      throw new Error(`XML parsing error: ${parseError.textContent}`)
    }

    // Find process element
    const processElement = this.findProcessElement(xmlDoc)
    if (!processElement) {
      throw new Error("No process element found in BPMN XML")
    }

    // Extract elements and flows
    this.getElementsAndFlows(processElement)

    // Find start event
    const startEvents = Array.from(this.elements.values()).filter(
      (elem) => elem.type === "startEvent"
    )

    if (startEvents.length !== 1) {
      throw new Error("Process must contain exactly one start event")
    }

    // Build hierarchical structure
    return this.buildStructureRecursive(startEvents[0].id, null, new Set())
  }

  /**
   * Find the process element in XML document.
   */
  private findProcessElement(xmlDoc: Document): Element | null {
    // Try with namespace
    let processElement = xmlDoc.querySelector("process")
    if (processElement) return processElement

    // Try without namespace
    const allElements = xmlDoc.getElementsByTagName("*")
    for (let i = 0; i < allElements.length; i++) {
      const elem = allElements[i]
      if (elem.tagName.endsWith("process")) {
        return elem
      }
    }

    return null
  }

  /**
   * Extract elements and flows from process element.
   */
  private getElementsAndFlows(processElement: Element): void {
    const labeledElements = new Set([
      "task",
      "userTask",
      "serviceTask",
      "exclusiveGateway",
      "startEvent",
      "endEvent",
    ])

    const supportedElements = [
      "task",
      "userTask",
      "serviceTask",
      "exclusiveGateway",
      "parallelGateway",
      "startEvent",
      "endEvent",
    ]

    // Process all child elements
    for (let i = 0; i < processElement.children.length; i++) {
      const elem = processElement.children[i]
      const tag = elem.tagName.split(":").pop() || elem.tagName
      const elemId = elem.getAttribute("id")

      if (!elemId) continue

      if (supportedElements.includes(tag)) {
        const elementInfo: ElementInfo = {
          type: tag,
          id: elemId,
        }

        // Add label if element type supports it and name exists
        if (labeledElements.has(tag)) {
          const name = elem.getAttribute("name")
          if (name) {
            elementInfo.label = name
          }
        }

        this.elements.set(elemId, elementInfo)
      } else if (tag === "sequenceFlow") {
        const sourceRef = elem.getAttribute("sourceRef")
        const targetRef = elem.getAttribute("targetRef")
        const condition = elem.getAttribute("name")

        if (sourceRef && targetRef) {
          this.flows.set(elemId, {
            id: elemId,
            source: sourceRef,
            target: targetRef,
            condition: condition || undefined,
          })
        }
      }
    }
  }

  /**
   * Build hierarchical structure recursively.
   */
  private buildStructureRecursive(
    currentId: string,
    stopAt: string | null,
    visited: Set<string>
  ): BPMNElement[] {
    if (visited.has(currentId) || currentId === stopAt) {
      return []
    }

    visited.add(currentId)

    const currentElement = this.elements.get(currentId)
    if (!currentElement) {
      throw new Error(`Element not found: ${currentId}`)
    }

    const outgoingFlows = this.getOutgoingFlows(currentId)

    // Handle exclusive gateway
    if (currentElement.type === "exclusiveGateway") {
      const commonEndpoint = this.findCommonBranchEndpoint(currentId)
      let nextElement: string | null = null
      let hasJoin = false

      // Check if common endpoint is an exclusive gateway (join)
      if (commonEndpoint && this.isExclusiveGateway(commonEndpoint)) {
        hasJoin = true
        const joinOutgoingFlows = this.getOutgoingFlows(commonEndpoint)

        if (joinOutgoingFlows.length !== 1) {
          throw new Error("Join gateway should have exactly one outgoing flow")
        }

        nextElement = joinOutgoingFlows[0].target
      } else {
        nextElement = commonEndpoint
      }

      // Build branches
      const branches = outgoingFlows.map((flow) => {
        const branchPath = this.buildStructureRecursive(
          flow.target,
          commonEndpoint,
          new Set(visited)
        )

        const branch: any = {
          condition: flow.condition || "",
          path: branchPath,
        }

        // Add "next" if branch doesn't lead to common endpoint
        if (branchPath.length === 0) {
          if (flow.target !== commonEndpoint) {
            branch.next = flow.target
          }
        } else {
          const lastElement = branchPath[branchPath.length - 1]
          const lastElementFlows = this.getOutgoingFlows(lastElement.id)

          if (lastElement.type === "exclusiveGateway") {
            // Handle nested exclusive gateway logic
            if (!(lastElement as any).has_join) {
              // No join, need to set "next" for each sub-branch
              // This is complex and matches Python implementation
            } else {
              const joinId = this.findCommonBranchEndpoint(lastElement.id)
              if (joinId) {
                const joinFlows = this.getOutgoingFlows(joinId)
                if (joinFlows.length === 1 && joinFlows[0].target !== commonEndpoint) {
                  branch.next = joinFlows[0].target
                }
              }
            }
          } else if (lastElement.type === "parallelGateway") {
            const joinId = this.findCommonBranchEndpoint(lastElement.id)
            if (joinId) {
              const joinFlows = this.getOutgoingFlows(joinId)
              if (joinFlows.length === 1 && joinFlows[0].target !== commonEndpoint) {
                branch.next = joinFlows[0].target
              }
            }
          } else if (
            lastElementFlows.length === 1 &&
            lastElementFlows[0].target !== commonEndpoint
          ) {
            branch.next = lastElementFlows[0].target
          }
        }

        return branch
      })

      const gateway: any = {
        type: "exclusiveGateway",
        id: currentElement.id,
        label: currentElement.label || "",
        has_join: hasJoin,
        branches,
      }

      const result: BPMNElement[] = [gateway]

      // Continue with next element
      if (nextElement) {
        result.push(...this.buildStructureRecursive(nextElement, stopAt, visited))
      }

      return result
    }

    // Handle parallel gateway
    if (currentElement.type === "parallelGateway") {
      const joinElement = this.findCommonBranchEndpoint(currentId)

      if (
        !joinElement ||
        !this.isParallelGateway(joinElement) ||
        this.getOutgoingFlows(joinElement).length !== 1
      ) {
        throw new Error("Parallel gateway must have a corresponding join gateway")
      }

      // Build parallel branches
      const branches = outgoingFlows.map((flow) => {
        return this.buildStructureRecursive(flow.target, joinElement, new Set(visited))
      })

      const gateway: any = {
        type: "parallelGateway",
        id: currentElement.id,
        branches,
      }

      const result: BPMNElement[] = [gateway]

      // Continue after join
      const joinOutgoingFlows = this.getOutgoingFlows(joinElement)
      const nextElement = joinOutgoingFlows[0].target
      result.push(...this.buildStructureRecursive(nextElement, stopAt, visited))

      return result
    }

    // Handle regular elements (tasks, events)
    const element: any = {
      type: currentElement.type,
      id: currentElement.id,
    }

    if (currentElement.label) {
      element.label = currentElement.label
    }

    const result: BPMNElement[] = [element]

    // Continue with next element
    if (outgoingFlows.length === 1) {
      const nextId = outgoingFlows[0].target
      result.push(...this.buildStructureRecursive(nextId, stopAt, visited))
    }

    return result
  }

  /**
   * Find common endpoint where all branches reconverge.
   */
  private findCommonBranchEndpoint(gatewayId: string): string | null {
    const paths = this.tracePaths(gatewayId)

    if (paths.length === 0) {
      return null
    }

    // Find first element that appears in all paths
    for (const elementId of paths[0]) {
      if (paths.every((path) => path.includes(elementId))) {
        return elementId
      }
    }

    return null
  }

  /**
   * Trace all paths from a gateway using BFS.
   */
  private tracePaths(gatewayId: string): string[][] {
    const paths: string[][] = []
    const queue: Array<{ id: string; path: string[]; visited: Set<string> }> = []

    const outgoingFlows = this.getOutgoingFlows(gatewayId)

    // Initialize queue with outgoing flows
    for (const flow of outgoingFlows) {
      queue.push({
        id: flow.target,
        path: [flow.target],
        visited: new Set([gatewayId, flow.target]),
      })
    }

    while (queue.length > 0) {
      const current = queue.shift()!
      const outgoing = this.getOutgoingFlows(current.id)

      if (outgoing.length === 0) {
        paths.push(current.path)
        continue
      }

      for (const flow of outgoing) {
        const nextId = flow.target

        if (!current.visited.has(nextId)) {
          const newPath = [...current.path, nextId]
          const newVisited = new Set(current.visited)
          newVisited.add(nextId)

          queue.push({
            id: nextId,
            path: newPath,
            visited: newVisited,
          })
        } else {
          // Loop detected, add current path
          paths.push([...current.path, nextId])
        }
      }
    }

    return paths
  }

  /**
   * Get outgoing flows for an element.
   */
  private getOutgoingFlows(elementId: string): FlowInfo[] {
    return Array.from(this.flows.values()).filter((flow) => flow.source === elementId)
  }

  /**
   * Check if element is an exclusive gateway.
   */
  private isExclusiveGateway(elementId: string): boolean {
    const element = this.elements.get(elementId)
    return element?.type === "exclusiveGateway"
  }

  /**
   * Check if element is a parallel gateway.
   */
  private isParallelGateway(elementId: string): boolean {
    const element = this.elements.get(elementId)
    return element?.type === "parallelGateway"
  }
}
