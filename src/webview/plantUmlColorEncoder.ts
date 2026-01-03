export type ElementType = "node" | "edge" | "label" | "arrow";

export interface ColorId {
  type: ElementType;
  index: number;
}

// Encode element identity into color
export function encodeColorId(
  type: ElementType,
  index: number,
  baseColor: "black" | "white"
): string {
  // Use 2 bits for type (4 types), 10 bits for index (1024 elements)
  const typeCode = { node: 0, edge: 1, label: 2, arrow: 3 }[type];
  const encoded = (typeCode << 10) | (index & 0x3ff);

  if (baseColor === "black") {
    // Encode in low bits: #000000 - #000FFF
    return `#${encoded.toString(16).padStart(6, "0")}`;
  } else {
    // Encode in low bits, inverted from white: #FFF000 - #FFFFFF
    const color = 0xfff000 | encoded;
    return `#${color.toString(16)}`;
  }
}

export function decodeColorId(color: string): ColorId | null {
  const hex = parseInt(color.replace("#", ""), 16);

  // Check if it's an encoded black (0x000000 - 0x000FFF)
  if (hex <= 0x000fff) {
    const typeCode = (hex >> 10) & 0x3;
    const index = hex & 0x3ff;
    const type = ["node", "edge", "label", "arrow"][typeCode] as ElementType;
    return { type, index };
  }

  // Check if it's an encoded white (0xFFF000 - 0xFFFFFF)
  if (hex >= 0xfff000) {
    const encoded = hex & 0x0fff;
    const typeCode = (encoded >> 10) & 0x3;
    const index = encoded & 0x3ff;
    const type = ["node", "edge", "label", "arrow"][typeCode] as ElementType;
    return { type, index };
  }

  return null; // Not an encoded color
}

export interface DiagramElement {
  id: string;
  type: ElementType;
  originalColor: string;
  encodedColor: string;
}

export class PlantUmlColorEncoder {
  private elementMap = new Map<string, DiagramElement>();
  private nodeCounter = 0;
  private edgeCounter = 0;

  // Parse PlantUML and inject tracking colors
  encode(puml: string): {
    encoded: string;
    elements: Map<string, DiagramElement>;
  } {
    this.elementMap.clear();
    this.nodeCounter = 0;
    this.edgeCounter = 0;

    let encoded = puml;

    // Match node definitions and add color
    // e.g., [NodeA] or class NodeA or state NodeA
    encoded = encoded.replace(
      /\[([^\]]+)\](?!\s*#)/g,
      (match, nodeName: string) => this.encodeNode(match, nodeName)
    );

    // Match edges/arrows and add color
    // e.g., A -> B or A --> B
    encoded = encoded.replace(
      /(\w+)\s*([-=.]+>|<[-=.]+)\s*(\w+)(?!\s*#)/g,
      (match, from: string, arrow: string, to: string) =>
        this.encodeEdge(match, from, arrow, to)
    );

    return { encoded, elements: new Map(this.elementMap) };
  }

  private encodeNode(match: string, nodeName: string): string {
    const color = encodeColorId("node", this.nodeCounter, "black");
    const id = `node_${nodeName}`;

    this.elementMap.set(color, {
      id,
      type: "node",
      originalColor: "#000000",
      encodedColor: color,
    });

    this.nodeCounter++;
    return `${match} ${color}`;
  }

  private encodeEdge(
    match: string,
    from: string,
    arrow: string,
    to: string
  ): string {
    void match;
    void arrow;
    const color = encodeColorId("edge", this.edgeCounter, "black");
    const id = `edge_${from}_${to}`;

    this.elementMap.set(color, {
      id,
      type: "edge",
      originalColor: "#000000",
      encodedColor: color,
    });

    this.edgeCounter++;
    // PlantUML edge color syntax
    return `${from} -[${color}]-> ${to}`;
  }
}
