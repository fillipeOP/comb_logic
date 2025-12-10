export enum GateType {
  AND = 'AND',
  OR = 'OR',
  NAND = 'NAND',
  NOR = 'NOR',
  NOT = 'NOT',
  XOR = 'XOR',
  XNOR = 'XNOR',
  INPUT = 'INPUT',
  OUTPUT = 'OUTPUT',
  // IO & Sources
  PULL_UP = 'PULL_UP',
  PULL_DOWN = 'PULL_DOWN',
  // Sequential Logic
  CLOCK = 'CLOCK',
  D_FF = 'D_FF',
  T_FF = 'T_FF',
  JK_FF = 'JK_FF',
  SR_FF = 'SR_FF',
  // Displays
  HEX_DISPLAY = 'HEX_DISPLAY',
  // Custom
  CUSTOM_BLOCK = 'CUSTOM_BLOCK'
}

export interface Position {
  x: number;
  y: number;
}

export interface Node {
  id: string;
  type: GateType;
  position: Position;
  rotation?: number; // 0, 90, 180, 270
  label: string; // For Inputs/Outputs (e.g., "A", "Q")
  inputs: string[]; // Array of Pin IDs
  outputs: string[]; // Array of Pin IDs
  value?: boolean; // Current simulation value
  internalState?: any; // For sequential logic (memory, previous clock state, etc)
  customBlockDefinition?: CustomBlock; // Stores the schema for Black Boxes
}

export interface Wire {
  id: string;
  sourceNodeId: string;
  sourcePinIdx: number;
  targetNodeId: string;
  targetPinIdx: number;
  value?: boolean;
}

export interface CircuitState {
  nodes: Node[];
  wires: Wire[];
}

export interface CustomBlock {
  id: string;
  name: string;
  circuit: CircuitState;
  inputCount: number;
  outputCount: number;
}

interface GateConfig {
  inputs: number;
  outputs: number;
  color: string;
  path?: string; // SVG Path for standard gates
  shape?: 'path' | 'rect' | 'circle'; // Render type
  width?: number;
  height?: number;
  pinLabels?: string[]; // Labels for input pins (e.g. J, K, >)
}

export const GATE_CONFIG: Record<GateType, GateConfig> = {
  // Combinational
  [GateType.AND]: { inputs: 2, outputs: 1, color: '#3b82f6', shape: 'path', path: "M 10 10 V 50 H 30 A 20 20 0 0 0 30 10 Z M 50 30 L 56 30 M 0 23.3 L 10 23.3 M 0 36.7 L 10 36.7" },
  [GateType.OR]: { inputs: 2, outputs: 1, color: '#22c55e', shape: 'path', path: "M 10 10 V 50 Q 25 50 40 30 Q 25 10 10 10 M 10 10 Q 20 30 10 50 M 40 30 L 56 30 M 0 23.3 L 10 23.3 M 0 36.7 L 10 36.7" },
  [GateType.NAND]: { inputs: 2, outputs: 1, color: '#ef4444', shape: 'path', path: "M 10 10 V 50 H 30 A 20 20 0 0 0 30 10 Z M 50 30 A 3 3 0 1 1 56 30 A 3 3 0 1 1 50 30 M 0 23.3 L 10 23.3 M 0 36.7 L 10 36.7" },
  [GateType.NOR]: { inputs: 2, outputs: 1, color: '#f97316', shape: 'path', path: "M 10 10 V 50 Q 25 50 40 30 Q 25 10 10 10 M 10 10 Q 20 30 10 50 M 40 30 A 3 3 0 1 1 46 30 A 3 3 0 1 1 40 30 M 46 30 L 56 30 M 0 23.3 L 10 23.3 M 0 36.7 L 10 36.7" },
  [GateType.NOT]: { inputs: 1, outputs: 1, color: '#eab308', shape: 'path', path: "M 10 10 V 50 L 40 30 Z M 40 30 A 3 3 0 1 1 46 30 A 3 3 0 1 1 40 30 M 0 30 L 10 30" },
  [GateType.XOR]: { inputs: 2, outputs: 1, color: '#a855f7', shape: 'path', path: "M 15 10 V 50 Q 30 50 45 30 Q 30 10 15 10 M 15 10 Q 25 30 15 50 M 5 10 Q 15 30 5 50 M 45 30 L 56 30 M 0 23.3 L 5 23.3 M 0 36.7 L 5 36.7" },
  [GateType.XNOR]: { inputs: 2, outputs: 1, color: '#ec4899', shape: 'path', path: "M 15 10 V 50 Q 30 50 45 30 Q 30 10 15 10 M 15 10 Q 25 30 15 50 M 5 10 Q 15 30 5 50 M 45 30 A 3 3 0 1 1 51 30 A 3 3 0 1 1 45 30 M 51 30 L 56 30 M 0 23.3 L 5 23.3 M 0 36.7 L 5 36.7" },
  
  // IO & Sources
  [GateType.INPUT]: { inputs: 0, outputs: 1, color: '#94a3b8', shape: 'path', path: "M 10 10 H 40 V 50 H 10 Z M 40 30 L 56 30" },
  [GateType.OUTPUT]: { inputs: 1, outputs: 0, color: '#94a3b8', shape: 'path', path: "M 10 10 H 40 V 50 H 10 A 5 5 0 0 0 15 45 Z M 0 30 L 10 30" },
  [GateType.PULL_UP]: { inputs: 0, outputs: 1, color: '#ef4444', shape: 'rect', width: 30, height: 30, pinLabels: [] },
  [GateType.PULL_DOWN]: { inputs: 0, outputs: 1, color: '#3b82f6', shape: 'rect', width: 30, height: 30, pinLabels: [] },
  
  // Sequential
  [GateType.CLOCK]: { inputs: 0, outputs: 1, color: '#10b981', shape: 'rect', width: 40, height: 40, pinLabels: [] },
  [GateType.D_FF]: { inputs: 2, outputs: 1, color: '#6366f1', shape: 'rect', width: 60, height: 80, pinLabels: ['D', '>'] },
  [GateType.T_FF]: { inputs: 2, outputs: 1, color: '#8b5cf6', shape: 'rect', width: 60, height: 80, pinLabels: ['T', '>'] },
  [GateType.JK_FF]: { inputs: 3, outputs: 1, color: '#d946ef', shape: 'rect', width: 60, height: 80, pinLabels: ['J', 'K', '>'] },
  [GateType.SR_FF]: { inputs: 3, outputs: 1, color: '#f43f5e', shape: 'rect', width: 60, height: 80, pinLabels: ['S', 'R', '>'] },

  // Displays
  [GateType.HEX_DISPLAY]: { inputs: 4, outputs: 0, color: '#111827', shape: 'rect', width: 60, height: 90, pinLabels: ['8', '4', '2', '1'] },

  // Custom
  [GateType.CUSTOM_BLOCK]: { inputs: 0, outputs: 0, color: '#4c1d95', shape: 'rect', width: 100, height: 100, pinLabels: [] }
};