export async function layoutBpmn(bpmnXml: string): Promise<string> {
  const response = await fetch("/api/bpmn/layout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bpmnXml }),
  })

  if (!response.ok) {
    throw new Error("Failed to layout BPMN")
  }

  const data = await response.json()
  return data.layoutedXml
}

export async function generateBpmn(description: string): Promise<string> {
  const response = await fetch("/api/bpmn/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description }),
  })

  if (!response.ok) {
    throw new Error("Failed to generate BPMN")
  }

  const data = await response.json()
  return data.bpmnXml
}

export async function interpretBpmn(bpmnXml: string): Promise<string> {
  const response = await fetch("/api/bpmn/interpret", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bpmnXml }),
  })

  if (!response.ok) {
    throw new Error("Failed to interpret BPMN")
  }

  const data = await response.json()
  return data.interpretation
}
