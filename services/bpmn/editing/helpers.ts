/**
 * Helper functions and utilities for BPMN editing.
 * Based on legacy Python helpers.py and position.py
 */

import type { BPMNElement } from "../types"
import { isExclusiveGateway, isParallelGateway } from "../types"

/**
 * Represents a position in the process tree.
 */
export class Position {
  constructor(
    public index: number,
    public path: (string | number)[] = []
  ) {}

  isTopLevel(): boolean {
    return this.path.length === 0
  }

  toString(): string {
    return `Position(index=${this.index}, path=[${this.path.join(", ")}])`
  }
}

/**
 * Get all element IDs in the process, including nested elements in gateway branches.
 */
export function getAllIds(process: BPMNElement[]): string[] {
  const ids: string[] = []

  for (const element of process) {
    ids.push(element.id)

    if (isExclusiveGateway(element)) {
      for (const branch of element.branches) {
        ids.push(...getAllIds(branch.path))
      }
    } else if (isParallelGateway(element)) {
      for (const branch of element.branches) {
        ids.push(...getAllIds(branch))
      }
    }
  }

  return ids
}

/**
 * Result type for position finding.
 */
interface PositionResult {
  index: number
  path: (string | number)[]
}

/**
 * Recursively find the position of an element in the process.
 */
function findPositionInProcess(
  process: BPMNElement[],
  targetId: string,
  after: boolean = false,
  path: (string | number)[] = []
): PositionResult | null {
  for (let index = 0; index < process.length; index++) {
    const element = process[index]
    const currentPath = [...path, index]

    if (element.id === targetId) {
      return {
        index: after ? index + 1 : index,
        path,
      }
    }

    if (isExclusiveGateway(element)) {
      for (let branchIndex = 0; branchIndex < element.branches.length; branchIndex++) {
        const branch = element.branches[branchIndex]
        const result = findPositionInProcess(
          branch.path,
          targetId,
          after,
          [...currentPath, "branches", branchIndex, "path"]
        )
        if (result) {
          return result
        }
      }
    } else if (isParallelGateway(element)) {
      for (let branchIndex = 0; branchIndex < element.branches.length; branchIndex++) {
        const branch = element.branches[branchIndex]
        const result = findPositionInProcess(
          branch,
          targetId,
          after,
          [...currentPath, "branches", branchIndex]
        )
        if (result) {
          return result
        }
      }
    }
  }

  return null
}

/**
 * Find the position to insert or locate an element.
 */
export function findPosition(
  process: BPMNElement[],
  beforeId?: string,
  afterId?: string
): Position {
  const ids = getAllIds(process)

  if (!beforeId && !afterId) {
    throw new Error("Both before_id and after_id cannot be undefined")
  }

  if (beforeId && afterId) {
    throw new Error("Only one of before_id and after_id can be specified")
  }

  let result: PositionResult | null = null

  if (beforeId) {
    if (!ids.includes(beforeId)) {
      throw new Error(`Element with id ${beforeId} does not exist`)
    }
    result = findPositionInProcess(process, beforeId, false)
  } else if (afterId) {
    if (!ids.includes(afterId)) {
      throw new Error(`Element with id ${afterId} does not exist`)
    }
    result = findPositionInProcess(process, afterId, true)
  }

  if (!result) {
    throw new Error("Element not found")
  }

  return new Position(result.index, result.path)
}

/**
 * Result type for branch finding.
 */
interface BranchResult {
  gatewayIndex: number
  branchIndex: number
  path: (string | number)[]
}

/**
 * Recursively find a branch by its condition.
 */
function findBranchByCondition(
  process: BPMNElement[],
  targetCondition: string,
  path: (string | number)[] = []
): BranchResult | null {
  for (let index = 0; index < process.length; index++) {
    const element = process[index]
    const currentPath = [...path, index]

    if (isExclusiveGateway(element)) {
      // Check branches at this level
      for (let branchIndex = 0; branchIndex < element.branches.length; branchIndex++) {
        const branch = element.branches[branchIndex]
        if (branch.condition === targetCondition) {
          return {
            gatewayIndex: index,
            branchIndex,
            path: currentPath,
          }
        }
      }

      // Search nested gateways
      for (let branchIndex = 0; branchIndex < element.branches.length; branchIndex++) {
        const branch = element.branches[branchIndex]
        const result = findBranchByCondition(
          branch.path,
          targetCondition,
          [...currentPath, "branches", branchIndex, "path"]
        )
        if (result) {
          return result
        }
      }
    } else if (isParallelGateway(element)) {
      for (let branchIndex = 0; branchIndex < element.branches.length; branchIndex++) {
        const branch = element.branches[branchIndex]
        const result = findBranchByCondition(
          branch,
          targetCondition,
          [...currentPath, "branches", branchIndex]
        )
        if (result) {
          return result
        }
      }
    }
  }

  return null
}

/**
 * Find the position of a branch by its condition.
 */
export function findBranchPosition(process: BPMNElement[], condition: string): Position {
  const result = findBranchByCondition(process, condition)

  if (!result) {
    throw new Error(`Branch with condition '${condition}' does not exist`)
  }

  return new Position(result.branchIndex, [...result.path, "branches"])
}

/**
 * Deep clone a process to avoid mutations.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Navigate to a position in the process tree.
 */
export function navigateToPosition(process: any, path: (string | number)[]): any {
  let current = process
  for (const pathElement of path) {
    current = current[pathElement]
  }
  return current
}
