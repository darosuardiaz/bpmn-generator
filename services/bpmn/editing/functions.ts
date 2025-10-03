/**
 * BPMN editing functions.
 * Based on legacy Python functions.py
 * 
 * All functions take a process and return a new modified process (immutable operations).
 */

import type { BPMNElement } from "../types"
import {
  getAllIds,
  findPosition,
  findBranchPosition,
  deepClone,
  navigateToPosition,
} from "./helpers"

/**
 * Result type for edit operations.
 */
export interface EditResult {
  process: BPMNElement[]
  modifiedElement?: BPMNElement
}

/**
 * Delete an element from the process.
 */
export function deleteElement(process: BPMNElement[], elementId: string): EditResult {
  const ids = getAllIds(process)

  if (!ids.includes(elementId)) {
    throw new Error(`Element with id ${elementId} does not exist`)
  }

  const processCopy = deepClone(process)
  const position = findPosition(processCopy, elementId)

  let current = processCopy

  // Navigate to parent
  for (let i = 0; i < position.path.length - 1; i++) {
    current = current[position.path[i]]
  }

  // Get target list and remove element
  let removedElement: BPMNElement
  if (position.path.length > 0) {
    const lastPathElement = position.path[position.path.length - 1]
    const targetList = current[lastPathElement]
    removedElement = targetList.splice(position.index, 1)[0]
  } else {
    removedElement = current.splice(position.index, 1)[0]
  }

  if (!removedElement) {
    throw new Error("Could not find the element to remove")
  }

  return {
    process: processCopy,
    modifiedElement: removedElement,
  }
}

/**
 * Redirect a branch in an exclusive gateway.
 */
export function redirectBranch(
  process: BPMNElement[],
  branchCondition: string,
  nextId: string
): EditResult {
  const position = findBranchPosition(process, branchCondition)
  const processCopy = deepClone(process)

  let current = processCopy

  // Navigate to the branches array
  for (const pathElement of position.path) {
    current = current[pathElement]
  }

  // Update the branch
  const branch = current[position.index]
  branch.next = nextId

  return {
    process: processCopy,
    modifiedElement: branch,
  }
}

/**
 * Validate parameters for add/move operations.
 */
function validatePlacementParams(
  ids: string[],
  beforeId?: string,
  afterId?: string
): void {
  if (beforeId && !ids.includes(beforeId)) {
    throw new Error(`Element with id ${beforeId} does not exist`)
  }
  if (afterId && !ids.includes(afterId)) {
    throw new Error(`Element with id ${afterId} does not exist`)
  }
  if (beforeId && afterId) {
    throw new Error("Only one of before_id and after_id can be specified")
  }
  if (!beforeId && !afterId) {
    throw new Error("At least one of before_id and after_id must be specified")
  }
}

/**
 * Add an element to the process.
 */
export function addElement(
  process: BPMNElement[],
  element: BPMNElement,
  beforeId?: string,
  afterId?: string
): EditResult {
  const ids = getAllIds(process)

  if (ids.includes(element.id)) {
    throw new Error(`Element with id ${element.id} already exists`)
  }

  validatePlacementParams(ids, beforeId, afterId)

  const position = findPosition(process, beforeId, afterId)
  const processCopy = deepClone(process)

  let current = processCopy

  // Navigate to parent
  for (let i = 0; i < position.path.length - 1; i++) {
    current = current[position.path[i]]
  }

  // Get target list and insert element
  let targetList: BPMNElement[]
  if (position.path.length > 0) {
    const lastPathElement = position.path[position.path.length - 1]
    targetList = current[lastPathElement]
  } else {
    targetList = current
  }

  targetList.splice(position.index, 0, element)

  return {
    process: processCopy,
    modifiedElement: element,
  }
}

/**
 * Move an element to a new position in the process.
 */
export function moveElement(
  process: BPMNElement[],
  elementId: string,
  beforeId?: string,
  afterId?: string
): EditResult {
  const ids = getAllIds(process)

  if (!ids.includes(elementId)) {
    throw new Error(`Element with id ${elementId} does not exist`)
  }

  validatePlacementParams(ids, beforeId, afterId)

  // Delete the element
  const { process: processAfterDelete, modifiedElement: removedElement } = deleteElement(
    process,
    elementId
  )

  // Add it at the new position
  const { process: finalProcess } = addElement(
    processAfterDelete,
    removedElement!,
    beforeId,
    afterId
  )

  return {
    process: finalProcess,
    modifiedElement: removedElement,
  }
}

/**
 * Update an existing element in the process.
 */
export function updateElement(process: BPMNElement[], newElement: BPMNElement): EditResult {
  const ids = getAllIds(process)

  if (!ids.includes(newElement.id)) {
    throw new Error(`Element with id ${newElement.id} does not exist`)
  }

  if (newElement.type === "exclusiveGateway" || newElement.type === "parallelGateway") {
    throw new Error("Cannot update a gateway element")
  }

  const position = findPosition(process, newElement.id)
  const processCopy = deepClone(process)

  let current = processCopy

  // Navigate to parent
  for (let i = 0; i < position.path.length - 1; i++) {
    current = current[position.path[i]]
  }

  // Get target list and update element
  let targetList: BPMNElement[]
  if (position.path.length > 0) {
    const lastPathElement = position.path[position.path.length - 1]
    targetList = current[lastPathElement]
  } else {
    targetList = current
  }

  targetList[position.index] = newElement

  return {
    process: processCopy,
    modifiedElement: newElement,
  }
}
