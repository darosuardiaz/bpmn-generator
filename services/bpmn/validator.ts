/**
 * BPMN validation module.
 * Based on legacy Python validate_bpmn.py
 * 
 * Validates BPMN process structures to ensure:
 * - All elements have required fields
 * - No duplicate IDs
 * - Element-specific rules are followed
 * - Nested structures are valid
 */

import {
  type BPMNElement,
  type BPMNTask,
  type ExclusiveGateway,
  type ParallelGateway,
  isTask,
  isEvent,
  isExclusiveGateway,
  isParallelGateway,
} from "./types"

/**
 * Validates a BPMN process.
 * 
 * @param process - Array of BPMN elements representing the process
 * @throws {Error} If the process or any element is invalid
 */
export function validateBpmn(process: BPMNElement[]): void {
  const seenIds = new Set<string>()

  for (const element of process) {
    // Validate the element structure
    validateElement(element)

    // Check for duplicate IDs
    if (seenIds.has(element.id)) {
      throw new Error(`Duplicate element ID found: ${element.id}`)
    }
    seenIds.add(element.id)

    // Recursively validate nested structures
    if (isExclusiveGateway(element)) {
      for (const branch of element.branches) {
        validateBpmn(branch.path)
      }
    } else if (isParallelGateway(element)) {
      for (const branch of element.branches) {
        validateBpmn(branch)
      }
    }
  }
}

/**
 * Validates a single BPMN element.
 * 
 * @param element - BPMN element to validate
 * @throws {Error} If the element is invalid
 */
export function validateElement(element: BPMNElement): void {
  // Check for required fields
  if (!element.id) {
    throw new Error(`Element is missing an ID: ${JSON.stringify(element)}`)
  }
  if (!element.type) {
    throw new Error(`Element is missing a type: ${JSON.stringify(element)}`)
  }

  // Check if element type is supported
  const supportedTypes = [
    "task",
    "userTask",
    "serviceTask",
    "startEvent",
    "endEvent",
    "exclusiveGateway",
    "parallelGateway",
  ]

  if (!supportedTypes.includes(element.type)) {
    throw new Error(
      `Unsupported element type: ${element.type}. Supported types: ${supportedTypes.join(", ")}`
    )
  }

  // Validate specific element types
  if (isTask(element)) {
    validateTask(element)
  } else if (isExclusiveGateway(element)) {
    validateExclusiveGateway(element)
  } else if (isParallelGateway(element)) {
    validateParallelGateway(element)
  }
  // Events don't need additional validation beyond id and type
}

/**
 * Validates a task element.
 * 
 * @param element - Task element to validate
 * @throws {Error} If the task is invalid
 */
function validateTask(element: BPMNTask): void {
  if (!element.label) {
    throw new Error(`Task element is missing a label: ${JSON.stringify(element)}`)
  }

  if (typeof element.label !== "string" || element.label.trim() === "") {
    throw new Error(`Task element has invalid label: ${JSON.stringify(element)}`)
  }
}

/**
 * Validates an exclusive gateway element.
 * 
 * @param element - Exclusive gateway element to validate
 * @throws {Error} If the gateway is invalid
 */
function validateExclusiveGateway(element: ExclusiveGateway): void {
  if (!element.label) {
    throw new Error(`Exclusive gateway is missing a label: ${JSON.stringify(element)}`)
  }

  if (typeof element.label !== "string" || element.label.trim() === "") {
    throw new Error(`Exclusive gateway has invalid label: ${JSON.stringify(element)}`)
  }

  if (!element.branches || !Array.isArray(element.branches)) {
    throw new Error(
      `Exclusive gateway is missing or has invalid 'branches': ${JSON.stringify(element)}`
    )
  }

  if (element.branches.length < 2) {
    throw new Error(
      `Exclusive gateway must have at least 2 branches: ${JSON.stringify(element)}`
    )
  }

  if (typeof element.has_join !== "boolean") {
    throw new Error(
      `Exclusive gateway must have 'has_join' boolean field: ${JSON.stringify(element)}`
    )
  }

  // Validate each branch
  for (const branch of element.branches) {
    if (!branch.condition) {
      throw new Error(`Invalid branch in exclusive gateway (missing condition): ${JSON.stringify(branch)}`)
    }

    if (typeof branch.condition !== "string" || branch.condition.trim() === "") {
      throw new Error(`Invalid branch condition in exclusive gateway: ${JSON.stringify(branch)}`)
    }

    if (!Array.isArray(branch.path)) {
      throw new Error(`Invalid branch in exclusive gateway (path must be array): ${JSON.stringify(branch)}`)
    }

    // next is optional, but if provided, must be a string
    if (branch.next !== undefined && typeof branch.next !== "string") {
      throw new Error(`Invalid branch 'next' field (must be string): ${JSON.stringify(branch)}`)
    }
  }
}

/**
 * Validates a parallel gateway element.
 * 
 * @param element - Parallel gateway element to validate
 * @throws {Error} If the gateway is invalid
 */
function validateParallelGateway(element: ParallelGateway): void {
  if (!element.branches || !Array.isArray(element.branches)) {
    throw new Error(
      `Parallel gateway has missing or invalid 'branches': ${JSON.stringify(element)}`
    )
  }

  if (element.branches.length < 2) {
    throw new Error(
      `Parallel gateway must have at least 2 branches: ${JSON.stringify(element)}`
    )
  }

  // Validate that each branch is an array
  for (const branch of element.branches) {
    if (!Array.isArray(branch)) {
      throw new Error(
        `Parallel gateway branch must be an array: ${JSON.stringify(branch)}`
      )
    }
  }
}

/**
 * Validates that a process has exactly one start event.
 * 
 * @param process - Array of BPMN elements
 * @throws {Error} If the process doesn't have exactly one start event
 */
export function validateSingleStartEvent(process: BPMNElement[]): void {
  const startEvents = process.filter((elem) => elem.type === "startEvent")

  if (startEvents.length === 0) {
    throw new Error("Process must contain at least one start event")
  }

  if (startEvents.length > 1) {
    throw new Error("Process must contain exactly one start event")
  }
}

/**
 * Validates that all element IDs are unique across the entire process tree.
 * 
 * @param process - Array of BPMN elements
 * @param seenIds - Set of IDs seen so far (used for recursion)
 * @throws {Error} If duplicate IDs are found
 */
export function validateUniqueIds(
  process: BPMNElement[],
  seenIds: Set<string> = new Set()
): void {
  for (const element of process) {
    if (seenIds.has(element.id)) {
      throw new Error(`Duplicate element ID found: ${element.id}`)
    }
    seenIds.add(element.id)

    // Check nested structures
    if (isExclusiveGateway(element)) {
      for (const branch of element.branches) {
        validateUniqueIds(branch.path, seenIds)
      }
    } else if (isParallelGateway(element)) {
      for (const branch of element.branches) {
        validateUniqueIds(branch, seenIds)
      }
    }
  }
}
