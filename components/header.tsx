"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Download, Upload, Sparkles } from "lucide-react"
import { useBpmnStore } from "@/store/bpmn-store"
import { downloadBpmn, uploadBpmn } from "@/lib/bpmn-utils"

export function Header() {
  const { bpmnXml, setBpmnXml } = useBpmnStore()

  const handleDownload = () => {
    if (bpmnXml) {
      downloadBpmn(bpmnXml, "diagram.bpmn")
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const xml = await uploadBpmn(file)
      setBpmnXml(xml)
    }
  }

  return (
    <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">BPMN Assistant</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={handleDownload} disabled={!bpmnXml}>
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
        <Button variant="ghost" size="sm" onClick={() => document.getElementById("file-upload")?.click()}>
          <Upload className="w-4 h-4 mr-2" />
          Upload
        </Button>
        <input id="file-upload" type="file" accept=".bpmn,.xml" className="hidden" onChange={handleUpload} />
      </div>
    </header>
  )
}
