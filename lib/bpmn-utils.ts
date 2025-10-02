export function downloadBpmn(xml: string, filename: string) {
  const blob = new Blob([xml], { type: "application/xml" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function uploadBpmn(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const xml = e.target?.result as string
      resolve(xml)
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export function extractProcessDescription(xml: string): string {
  // Extract process information from BPMN XML
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "application/xml")

  const tasks = doc.querySelectorAll("bpmn\\:task, task")
  const userTasks = doc.querySelectorAll("bpmn\\:userTask, userTask")
  const serviceTasks = doc.querySelectorAll("bpmn\\:serviceTask, serviceTask")
  const gateways = doc.querySelectorAll(
    "bpmn\\:exclusiveGateway, exclusiveGateway, bpmn\\:parallelGateway, parallelGateway",
  )

  let description = "Current BPMN diagram contains:\n"

  if (tasks.length > 0) {
    description += `- ${tasks.length} task(s)\n`
  }
  if (userTasks.length > 0) {
    description += `- ${userTasks.length} user task(s)\n`
  }
  if (serviceTasks.length > 0) {
    description += `- ${serviceTasks.length} service task(s)\n`
  }
  if (gateways.length > 0) {
    description += `- ${gateways.length} gateway(s)\n`
  }

  return description
}
