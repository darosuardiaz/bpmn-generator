/**
 * BPMN XML Generator.
 * Based on legacy Python bpmn_xml_generator.py
 * 
 * Generates BPMN 2.0 XML from hierarchical process structure.
 * Uses BpmnProcessTransformer to convert to flat structure first.
 */

import type { BPMNElement } from "./types"
import { BpmnProcessTransformer } from "./process-transformer"

export class BpmnXmlGenerator {
  private transformer: BpmnProcessTransformer

  constructor() {
    this.transformer = new BpmnProcessTransformer()
  }

  /**
   * Create BPMN XML from hierarchical process structure.
   * 
   * @param process - Hierarchical process array
   * @returns BPMN 2.0 XML string with Diagram Interchange (DI) elements
   */
  createBpmnXml(process: BPMNElement[]): string {
    // Transform hierarchical structure to flat structure
    const transformedProcess = this.transformer.transform(process)

    // Build XML string
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<definitions '
    xml += 'xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" '
    xml += 'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" '
    xml += 'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" '
    xml += 'xmlns:di="http://www.omg.org/spec/DD/20100524/DI" '
    xml += 'id="definitions_1">\n'
    
    xml += '  <process id="Process_1" isExecutable="false">\n'

    // Add elements
    for (const element of transformedProcess.elements) {
      xml += `    <${element.type} id="${this.escapeXml(element.id)}"`

      // Add label if it exists
      if (element.label) {
        xml += ` name="${this.escapeXml(element.label)}"`
      }

      xml += '>\n'

      // Add incoming flows
      for (const incoming of element.incoming) {
        xml += `      <incoming>${this.escapeXml(incoming)}</incoming>\n`
      }

      // Add outgoing flows
      for (const outgoing of element.outgoing) {
        xml += `      <outgoing>${this.escapeXml(outgoing)}</outgoing>\n`
      }

      xml += `    </${element.type}>\n`
    }

    // Add flows
    for (const flow of transformedProcess.flows) {
      xml += `    <sequenceFlow `
      xml += `id="${this.escapeXml(flow.id)}" `
      xml += `sourceRef="${this.escapeXml(flow.sourceRef)}" `
      xml += `targetRef="${this.escapeXml(flow.targetRef)}"`

      // Add condition if it exists
      if (flow.condition) {
        xml += ` name="${this.escapeXml(flow.condition)}"`
      }

      xml += '/>\n'
    }

    xml += '  </process>\n'

    // Add BPMN Diagram Interchange (DI) elements
    // These are required for bpmn-auto-layout to work
    xml += '  <bpmndi:BPMNDiagram id="BPMNDiagram_1">\n'
    xml += '    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">\n'

    // Add BPMNShape for each element with placeholder coordinates
    let x = 100
    let y = 100
    for (const element of transformedProcess.elements) {
      xml += `      <bpmndi:BPMNShape id="${this.escapeXml(element.id)}_di" bpmnElement="${this.escapeXml(element.id)}">\n`
      xml += `        <dc:Bounds x="${x}" y="${y}" width="100" height="80"/>\n`
      xml += '      </bpmndi:BPMNShape>\n'
      
      // Update position for next element (will be replaced by auto-layout anyway)
      x += 150
      if (x > 1000) {
        x = 100
        y += 150
      }
    }

    // Add BPMNEdge for each sequence flow with placeholder waypoints
    for (const flow of transformedProcess.flows) {
      xml += `      <bpmndi:BPMNEdge id="${this.escapeXml(flow.id)}_di" bpmnElement="${this.escapeXml(flow.id)}">\n`
      xml += '        <di:waypoint x="0" y="0"/>\n'
      xml += '        <di:waypoint x="0" y="0"/>\n'
      xml += '      </bpmndi:BPMNEdge>\n'
    }

    xml += '    </bpmndi:BPMNPlane>\n'
    xml += '  </bpmndi:BPMNDiagram>\n'
    xml += '</definitions>'

    return xml
  }

  /**
   * Escape XML special characters.
   * 
   * @param str - String to escape
   * @returns Escaped string
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
  }
}
