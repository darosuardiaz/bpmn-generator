"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import { useBpmnStore } from "@/store/bpmn-store"

const EMPTY_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="173" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

declare global {
  interface Window {
    BpmnJS?: new (options: any) => any
  }
}

export function BpmnCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const modelerRef = useRef<any>(null)
  const { bpmnXml, setBpmnXml, setModeler } = useBpmnStore()
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !isLibraryLoaded || !window.BpmnJS) return

    const modeler = new window.BpmnJS({
      container: containerRef.current,
      keyboard: {
        bindTo: window,
      },
    })

    modelerRef.current = modeler
    setModeler(modeler)

    // Load initial diagram
    modeler.importXML(bpmnXml || EMPTY_DIAGRAM).catch((err: Error) => {
      console.error("[v0] Error importing BPMN diagram:", err)
    })

    // Listen for changes
    modeler.on("commandStack.changed", async () => {
      try {
        const { xml } = await modeler.saveXML({ format: true })
        if (xml) {
          setBpmnXml(xml)
        }
      } catch (err) {
        console.error("[v0] Error saving BPMN diagram:", err)
      }
    })

    return () => {
      modeler.destroy()
    }
  }, [isLibraryLoaded])

  // Update diagram when bpmnXml changes externally
  useEffect(() => {
    if (modelerRef.current && bpmnXml) {
      modelerRef.current.importXML(bpmnXml).catch((err: Error) => {
        console.error("[v0] Error importing BPMN diagram:", err)
      })
    }
  }, [bpmnXml])

  return (
    <>
      <Script
        src="https://unpkg.com/bpmn-js@17.11.1/dist/bpmn-modeler.development.js"
        onLoad={() => {
          console.log("[v0] BPMN.js library loaded")
          setIsLibraryLoaded(true)
        }}
        onError={(e) => {
          console.error("[v0] Failed to load BPMN.js library:", e)
        }}
      />
      <link rel="stylesheet" href="https://unpkg.com/bpmn-js@17.11.1/dist/assets/diagram-js.css" />
      <link rel="stylesheet" href="https://unpkg.com/bpmn-js@17.11.1/dist/assets/bpmn-font/css/bpmn-embedded.css" />
      <div className="w-full h-full bpmn-container" ref={containerRef}>
        {!isLibraryLoaded && (
          <div className="flex items-center justify-center h-full text-muted-foreground">Loading BPMN editor...</div>
        )}
      </div>
    </>
  )
}
