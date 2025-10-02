"use client"

import type React from "react"

import { useState } from "react"
import { BpmnCanvas } from "./bpmn-canvas"
import { ChatPanel } from "./chat-panel"
import { Header } from "./header"

export function BpmnEditor() {
  const [isResizing, setIsResizing] = useState(false)
  const [splitPosition, setSplitPosition] = useState(60) // percentage

  const handleMouseDown = () => {
    setIsResizing(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isResizing) {
      const newPosition = (e.clientX / window.innerWidth) * 100
      if (newPosition > 30 && newPosition < 80) {
        setSplitPosition(newPosition)
      }
    }
  }

  const handleMouseUp = () => {
    setIsResizing(false)
  }

  return (
    <div className="flex flex-col h-screen" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <Header />
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        <div className="border-r border-border" style={{ width: `${splitPosition}%` }}>
          <BpmnCanvas />
        </div>
        <div
          className="w-1 bg-border hover:bg-primary cursor-col-resize transition-colors"
          onMouseDown={handleMouseDown}
        />
        <div className="flex-1 overflow-hidden">
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}
