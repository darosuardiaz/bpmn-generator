import { create } from "zustand"
import type BpmnModeler from "bpmn-js/lib/Modeler"

interface BpmnStore {
  bpmnXml: string | null
  modeler: BpmnModeler | null
  setBpmnXml: (xml: string) => void
  setModeler: (modeler: BpmnModeler) => void
}

export const useBpmnStore = create<BpmnStore>((set) => ({
  bpmnXml: null,
  modeler: null,
  setBpmnXml: (xml) => set({ bpmnXml: xml }),
  setModeler: (modeler) => set({ modeler }),
}))
