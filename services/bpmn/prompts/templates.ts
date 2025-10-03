/**
 * Prompt templates for BPMN generation and editing.
 * Based on legacy Jinja2 templates from bpmn-assistant/prompts/
 */

import { BPMN_EXAMPLES } from "./examples"

/**
 * BPMN representation specification.
 * Defines the JSON structure for BPMN elements.
 */
export const BPMN_REPRESENTATION = `The BPMN JSON representation uses a sequence of elements to describe the process. Each element is executed in order based on its position in the "process" array unless gateways (exclusive or parallel) specify branching paths.

# Representation of various BPMN elements

## Tasks

Specify the task type in the 'type' field. Only "task", "userTask" and "serviceTask" options are supported.
Always try to specify the specific task type:
- Use 'userTask' for any human interaction (reviewing, deciding, entering data)
- Use 'serviceTask' for automated system actions (calculations, emails, database operations)
- Use 'task' only if the action cannot be clearly classified as user or system task
Each task must be atomic - representing a single unit of work. Break down complex activities into multiple separate tasks.
Labels must be clear and concise (ideally 2-4 words).

\`\`\`json
{
    "type": String = "task" | "userTask" | "serviceTask"
    "id": String,
    "label": String, // short task description
}
\`\`\`

## Events

Specify the event type in the 'type' field. Only "startEvent" and "endEvent" options are supported.

\`\`\`json
{
    "type": String = "startEvent" | "endEvent",
    "id": String,
    "label": String, // OPTIONAL: short event description
}
\`\`\`

## Gateways

Gateways determine process flow based on conditions or parallel tasks.

### Exclusive gateway

Each branch must include a condition and an array of elements that are executed if the condition is met.
If a branch has an empty "path", it leads to the first element after the exclusive gateway.
If the branch does not lead to the next element in the process (for example, it goes back to a previous element), specify the next element id.
If the branch leads to the next element in the process, do not specify the next element id.
If the process needs to end under a specific condition, you must explicitly include an end event in that branch's "path". If no end event is provided, the process will automatically continue to the next task in the sequence.
If the process description does not explicitly mention the 'else' branch or specify the outcome for an unmet condition, assume it leads to an end event.


\`\`\`json
{
    "type": String = "exclusiveGateway",
    "id": String,
    "label": String, // label for the gateway (e.g. "Professor agrees?")
    "has_join": Boolean, // whether the gateway contains a join element that merges the branches
    "branches": [
        {
            "condition": String, // condition for the branch
            "path": [], // array of elements that are executed if the condition is met (can be empty)
            "next": String, // OPTIONAL: ID of the next element if not following default sequence. Omit or set to null if following default sequence.
        },
        {
            "condition": String,
            "path": [],
            "next": String, // OPTIONAL: as above
        },
        // ... more branches
    ],
}
\`\`\`

### Parallel gateway

Specify "branches" as an array of arrays, where each sub-array lists elements executed in parallel.
A converging element is automatically generated to synchronize parallel branches. Therefore, there's no need to explicitly specify it.

\`\`\`json
{
    "type": String = "parallelGateway",
    "id": String,
    "branches": [
        [], // array of elements that are executed in parallel with the next array
        [], // array of elements that are executed in parallel with the previous array
        // ... more arrays
    ],
}
\`\`\``

/**
 * Edit functions specification.
 */
export const EDIT_FUNCTIONS_SPEC = `# Process editing functions

- \`delete_element(element_id)\`
- \`redirect_branch(branch_condition, next_id)\`
- \`add_element(element, before_id=None, after_id=None)\`
- \`move_element(element_id, before_id=None, after_id=None)\`
- \`update_element(new_element)\`

1. \`delete_element\` - Deletes an element from the process.

**Parameters:**
- \`element_id\`: The id of an existing element in the process

2. \`redirect_branch\` - Redirects the flow of a branch in an exclusive gateway.

**Parameters:**
- \`branch_condition\`: The condition of the branch to be redirected (needs to match the condition in the process)
- \`next_id\`: The id of the next element to which the flow should be redirected

3. \`add_element\` - Adds a new element to the process.

**Parameters:**
- \`element\`: An object representing a new element to be added to the process
- \`before_id\`: (Optional) The id of the element before which the new element should be added
- \`after_id\`: (Optional) The id of the element after which the new element should be added

**Note:** Only one of \`before_id\` or \`after_id\` should be provided.

4. \`move_element\` - Moves an existing element to a new position in the process.

**Parameters:**
- \`element_id\`: The id of an existing element in the process
- \`before_id\`: (Optional) The id of the element before which the element should be moved
- \`after_id\`: (Optional) The id of the element after which the element should be moved

**Note:** Only one of \`before_id\` or \`after_id\` should be provided.

5. \`update_element\` - Updates an existing element in the process.

**Parameters:**
- \`new_element\`: An object representing the updated element

**Note:** The \`new_element\`'s id should match the id of the element to be updated.

---

# Example function calls

\`\`\`json
{
  "function": "update_element",
  "arguments": {
      "new_element": {
          "type": "task",
          "id": "task1", // the id of the element to be updated
          "label": "New task description"
      }
  }
}
\`\`\`

\`\`\`json
{
  "function": "add_element",
  "arguments": {
    "element": {
          "type": "task",
          "id": "newTaskId",
          "label": "New task description"
    },
    "before_id": "task1"
  }
}
\`\`\`

\`\`\`json
{
  "function": "add_element",
  "arguments": {
    "element": {
      "type": "parallelGateway",
      "id": "parallel1",
      "branches": [
        [
          {
            "type": "task",
            "id": "docTask1",
            "label": "Review document"
          },
        ],
        [
          {
            "type": "serviceTask",
            "id": "notifyTask1",
            "label": "Send email notification"
          },
        ]
      ]
    },
    "after_id": "task5"
  }
}
\`\`\`

\`\`\`json
{
  "function": "delete_element",
  "arguments": {
    "element_id": "exclusive2"
  }
}
\`\`\`

\`\`\`json
{
  "function": "redirect_branch",
  "arguments": {
    "branch_condition": "Product is out of stock",
    "next_id": "task3"
  }
}
\`\`\``

/**
 * Render create BPMN prompt.
 */
export function renderCreatePrompt(messageHistory: string): string {
  return `${BPMN_REPRESENTATION}

${BPMN_EXAMPLES}

---

The following is the message history between the user and an AI assistant.

Message history:
\`\`\`
${messageHistory}
\`\`\`

Create a BPMN representation of the process described in the messages.`
}

/**
 * Render edit BPMN prompt.
 */
export function renderEditPrompt(process: string, changeRequest: string): string {
  return `${BPMN_REPRESENTATION}

${BPMN_EXAMPLES}

---

${EDIT_FUNCTIONS_SPEC}

---

# The JSON representation of the process

\`\`\`json
${process}
\`\`\`

# The requested change to the process

\`\`\`
${changeRequest}
\`\`\`

Provide one function at a time to update the process, along with the arguments for the function call.

Start with the first function call.`
}

/**
 * Render define change request prompt.
 */
export function renderDefineChangeRequestPrompt(process: string, messageHistory: string): string {
  return `${BPMN_REPRESENTATION}

${BPMN_EXAMPLES}

---

${EDIT_FUNCTIONS_SPEC}

---

# Current process

${process}

# Message history

${messageHistory}

The last user message indicates that the user wants to make a modification to the process.

Based on the last user message, construct a **concise** change request.

The change request should include:
1. A short natural language description of the change.
2. A breakdown of exactly which functions should be called to implement the change, specifying the required arguments for each function call.`
}

/**
 * Render respond to query prompt.
 */
export function renderRespondToQueryPrompt(messageHistory: string, process?: string): string {
  let prompt = ""

  if (process) {
    prompt += `The BPMN process that the user is currently seeing:

\`\`\`json
${process}
\`\`\`

---

`
  }

  prompt += `Message history:

${messageHistory}

---

You are BPMN Assistant, a helpful assistant that aids users in understanding, creating, and modifying BPMN processes.

`

  if (process) {
    prompt += `If asked to explain or describe a BPMN process, try not to use too much BPMN jargon, except if the user specifically asks for it.
Do not provide information about the JSON structure of the BPMN process, IDs of elements, or any other technical details.

`
  }

  prompt += `Your capabilities:
1. Create new BPMN processes from scratch based on user descriptions.
2. Modify existing BPMN processes as requested by users.
3. Interpret and explain BPMN diagrams to users.
4. Respond to queries about BPMN concepts and best practices.

Your limitations:
1. You can only work with a subset of BPMN elements (start/end events, tasks, exclusive/parallel gateways, sequence flows).
2. You don't "see" manual edits made by users. You only work with the last version you generated.
3. You interact with BPMN diagrams through their structural representation, not their visual layout.

The last user message indicates that the user wants to make conversation or is asking for information.

Respond concisely to the last user message, keeping in mind your capabilities and limitations.`

  return prompt
}
