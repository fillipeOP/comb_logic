import { GateType, Node, Wire } from '../types';

// --- Combinational Evaluation ---

const evaluateGate = (type: GateType, inputs: boolean[]): boolean => {
  const a = !!inputs[0];
  const b = !!inputs[1];
  
  switch (type) {
    case GateType.AND: return a && b;
    case GateType.OR: return a || b;
    case GateType.NAND: return !(a && b);
    case GateType.NOR: return !(a || b);
    case GateType.NOT: return !a;
    case GateType.XOR: return (a ? 1 : 0) !== (b ? 1 : 0);
    case GateType.XNOR: return (a ? 1 : 0) === (b ? 1 : 0);
    default: return false;
  }
};

// --- Simulation ---

export const simulateCircuit = (nodes: Node[], wires: Wire[], clockSpeed: number = 1000): Node[] => {
  // Map for quick access. Deep copy nodes to avoid mutating state directly during calculation
  const nodeMap = new Map(nodes.map(n => [n.id, { ...n, internalState: { ...(n.internalState || {}) } }]));
  const wireMap = new Map<string, boolean>(); 

  // 1. Initialize Wires based on current Node values
  wires.forEach(w => {
    const source = nodeMap.get(w.sourceNodeId);
    let sourceVal = false;
    // Handle Custom Block Outputs vs Standard Gate Outputs
    if (source?.type === GateType.CUSTOM_BLOCK) {
        const outIdx = w.sourcePinIdx;
        sourceVal = source.internalState.outputValues?.[outIdx] ?? false;
    } else {
        sourceVal = source?.value ?? false;
    }
    wireMap.set(w.id, sourceVal);
  });

  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = Math.max(100, nodes.length * 5); 
  const now = Date.now();

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    // Update Wires
    wires.forEach(w => {
      const sourceNode = nodeMap.get(w.sourceNodeId);
      let newVal = false;
      if (sourceNode?.type === GateType.CUSTOM_BLOCK) {
          newVal = sourceNode.internalState.outputValues?.[w.sourcePinIdx] ?? false;
      } else {
          newVal = sourceNode?.value ?? false;
      }
      if (wireMap.get(w.id) !== newVal) {
        wireMap.set(w.id, newVal);
        changed = true;
      }
    });

    // Update Nodes
    for (const node of nodeMap.values()) {
      // Inputs skipped
      if (node.type === GateType.INPUT) continue;

      // PULL_UP / PULL_DOWN Logic
      if (node.type === GateType.PULL_UP) {
          if (!node.value) { node.value = true; changed = true; }
          continue;
      }
      if (node.type === GateType.PULL_DOWN) {
          if (node.value) { node.value = false; changed = true; }
          continue;
      }

      // Clock Logic
      if (node.type === GateType.CLOCK) {
         // If clockSpeed is Infinity (used in Truth Table gen), we freeze the clock
         if (clockSpeed === Infinity) continue;

         const lastToggle = node.internalState.lastToggle || 0;
         if (now - lastToggle > clockSpeed) {
             node.value = !node.value;
             node.internalState.lastToggle = now;
             changed = true;
         }
         continue;
      }

      // Gather Inputs
      const nodeWires = wires.filter(w => w.targetNodeId === node.id);
      nodeWires.sort((a, b) => a.targetPinIdx - b.targetPinIdx);
      
      const inputValues = nodeWires.map(w => wireMap.get(w.id) ?? false);

      // --- CUSTOM BLOCK LOGIC (Recursive Simulation) ---
      if (node.type === GateType.CUSTOM_BLOCK && node.customBlockDefinition) {
          // Initialize Internal State if needed
          if (!node.internalState.innerNodes) {
              node.internalState.innerNodes = JSON.parse(JSON.stringify(node.customBlockDefinition.circuit.nodes));
              node.internalState.innerWires = JSON.parse(JSON.stringify(node.customBlockDefinition.circuit.wires));
              node.internalState.outputValues = new Array(node.customBlockDefinition.outputCount).fill(false);
          }

          // Sort internal inputs/outputs by Y position
          const internalInputs = node.internalState.innerNodes
              .filter((n: Node) => n.type === GateType.INPUT)
              .sort((a: Node, b: Node) => a.position.y - b.position.y);
          
          const internalOutputs = node.internalState.innerNodes
              .filter((n: Node) => n.type === GateType.OUTPUT)
              .sort((a: Node, b: Node) => a.position.y - b.position.y);

          // Map External Inputs -> Internal Inputs
          internalInputs.forEach((inpNode: Node, idx: number) => {
              const val = inputValues[idx] ?? false;
              if (inpNode.value !== val) {
                  inpNode.value = val;
              }
          });

          // Run Recursive Simulation
          const simulatedInnerNodes = simulateCircuit(
              node.internalState.innerNodes, 
              node.internalState.innerWires, 
              clockSpeed
          );
          node.internalState.innerNodes = simulatedInnerNodes;

          // Map Internal Outputs -> External Outputs
          const newOutputValues = internalOutputs.map((outNode: Node) => {
              const drivingWire = node.internalState.innerWires.find((w: Wire) => w.targetNodeId === outNode.id);
              if (!drivingWire) return false;
              const driver = simulatedInnerNodes.find((n: Node) => n.id === drivingWire.sourceNodeId);
              
              if (driver?.type === GateType.CUSTOM_BLOCK) {
                  return driver.internalState.outputValues?.[drivingWire.sourcePinIdx] ?? false;
              }
              return driver?.value ?? false;
          });

          if (JSON.stringify(node.internalState.outputValues) !== JSON.stringify(newOutputValues)) {
              node.internalState.outputValues = newOutputValues;
              changed = true;
          }
          continue;
      }

      // Input Padding for Standard Gates
      if ([GateType.NOT].includes(node.type)) {
         while (inputValues.length < 1) inputValues.push(false);
      } else if (![GateType.OUTPUT, GateType.D_FF, GateType.T_FF, GateType.JK_FF, GateType.SR_FF, GateType.CLOCK, GateType.HEX_DISPLAY].includes(node.type)) {
         while (inputValues.length < 2) inputValues.push(false);
      }

      // Hex Display Logic
      if (node.type === GateType.HEX_DISPLAY) {
          while (inputValues.length < 4) inputValues.push(false);
          const val = (inputValues[0] ? 8 : 0) + (inputValues[1] ? 4 : 0) + (inputValues[2] ? 2 : 0) + (inputValues[3] ? 1 : 0);
          if (node.internalState.displayValue !== val) {
              node.internalState.displayValue = val;
          }
          continue;
      }

      // Standard Combinational Logic
      if (![GateType.D_FF, GateType.T_FF, GateType.JK_FF, GateType.SR_FF, GateType.OUTPUT].includes(node.type)) {
         const output = evaluateGate(node.type, inputValues);
         if (node.value !== output) {
            node.value = output;
            changed = true;
         }
         continue;
      }

      // Output Node
      if (node.type === GateType.OUTPUT) {
         const output = inputValues[0] ?? false;
         if (node.value !== output) {
             node.value = output;
             changed = true;
         }
         continue;
      }

      // Sequential Logic (Edge Triggered)
      const clkIdx = inputValues.length - 1;
      const clkVal = inputValues[clkIdx] ?? false;
      const lastClkVal = node.internalState.lastClk ?? false;
      const isRisingEdge = !lastClkVal && clkVal;

      if (node.internalState.lastClk !== clkVal) {
          node.internalState.lastClk = clkVal;
      }

      if (isRisingEdge) {
          let q = node.value ?? false;
          if (node.type === GateType.D_FF) {
              q = inputValues[0] ?? false;
          } else if (node.type === GateType.T_FF) {
              if (inputValues[0]) q = !q;
          } else if (node.type === GateType.JK_FF) {
              const j = inputValues[0], k = inputValues[1];
              if (j && !k) q = true;
              else if (!j && k) q = false;
              else if (j && k) q = !q;
          } else if (node.type === GateType.SR_FF) {
              const s = inputValues[0], r = inputValues[1];
              if (s && !r) q = true;
              else if (!s && r) q = false;
          }
          if (node.value !== q) {
              node.value = q;
              changed = true;
          }
      }
    }
  }

  return Array.from(nodeMap.values());
};

// --- Generators ---

export const generateEquation = (nodes: Node[], wires: Wire[]): string => {
  const outputs = nodes.filter(n => n.type === GateType.OUTPUT);
  if (outputs.length === 0) return "No Output";

  const getExpr = (nodeId: string, depth: number, pinIdx: number = 0): string => {
    if (depth > 50) return "..."; 
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return "0";
    
    if (node.type === GateType.INPUT) return node.label;
    if (node.type === GateType.CLOCK) return "CLK";
    if (node.type === GateType.PULL_UP) return "1";
    if (node.type === GateType.PULL_DOWN) return "0";
    
    if ([GateType.D_FF, GateType.T_FF, GateType.JK_FF, GateType.SR_FF, GateType.HEX_DISPLAY].includes(node.type)) {
        return `${node.type}_${node.id.slice(-4)}`;
    }
    
    if (node.type === GateType.CUSTOM_BLOCK) {
        return `${node.label}_Out${pinIdx}`;
    }

    const incomingWires = wires.filter(w => w.targetNodeId === nodeId).sort((a, b) => a.targetPinIdx - b.targetPinIdx);
    
    if (node.type === GateType.OUTPUT) {
      if (incomingWires.length === 0) return "0";
      return getExpr(incomingWires[0].sourceNodeId, depth + 1, incomingWires[0].sourcePinIdx);
    }

    const op = node.type;
    const inputs = incomingWires.map(w => getExpr(w.sourceNodeId, depth + 1, w.sourcePinIdx));
    
    const reqInputs = node.type === GateType.NOT ? 1 : 2;
    while (inputs.length < reqInputs) inputs.push("0");

    if (op === GateType.NOT) return `NOT (${inputs[0]})`;
    return `(${inputs[0]} ${op} ${inputs[1]})`;
  };

  return outputs.map(o => `${o.label} = ${getExpr(o.id, 0)}`).join('\n');
};

export const generateCircuitDescription = (nodes: Node[], wires: Wire[]): string => {
  const getLabel = (id: string, pinIdx: number = 0) => {
      const n = nodes.find(x => x.id === id);
      if (!n) return "UNKNOWN";
      if (n.type === GateType.INPUT) return n.label;
      if (n.type === GateType.OUTPUT) return n.label;
      if (n.type === GateType.CLOCK) return "CLOCK";
      if (n.type === GateType.PULL_UP) return "VCC";
      if (n.type === GateType.PULL_DOWN) return "GND";
      if (n.type === GateType.CUSTOM_BLOCK) return `${n.label}_Pin${pinIdx}`;
      return `${n.type}_${n.id.substring(0,4)}`; 
  };

  const lines: string[] = [];
  lines.push("CIRCUIT NETLIST DESCRIPTION:");
  const inputs = nodes.filter(n => n.type === GateType.INPUT);
  lines.push(`INPUTS: ${inputs.map(n => n.label).join(', ')}`);
  const outputs = nodes.filter(n => n.type === GateType.OUTPUT);
  lines.push(`OUTPUTS: ${outputs.map(n => n.label).join(', ')}`);
  lines.push("\nCOMPONENTS & CONNECTIONS:");

  const logicNodes = nodes.filter(n => !([GateType.INPUT, GateType.OUTPUT, GateType.CLOCK, GateType.PULL_UP, GateType.PULL_DOWN].includes(n.type)));
  
  logicNodes.forEach(node => {
      const nodeName = node.label || `${node.type}_${node.id.substring(0,4)}`;
      const incoming = wires.filter(w => w.targetNodeId === node.id).sort((a,b) => a.targetPinIdx - b.targetPinIdx);
      
      let connections: string[] = [];
      if (node.type === GateType.HEX_DISPLAY) {
          connections = incoming.map((w, i) => {
              const weights = ['8 (MSB)', '4', '2', '1 (LSB)'];
              return `Bit ${weights[i]} connected to ${getLabel(w.sourceNodeId, w.sourcePinIdx)}`;
          });
      } else if (node.type === GateType.CUSTOM_BLOCK) {
          connections = incoming.map((w) => `Input Pin ${w.targetPinIdx} connected to ${getLabel(w.sourceNodeId, w.sourcePinIdx)}`);
      } else if ([GateType.D_FF, GateType.T_FF, GateType.JK_FF, GateType.SR_FF].includes(node.type)) {
         const config = { 
             [GateType.D_FF]: ['D', 'CLK'], 
             [GateType.T_FF]: ['T', 'CLK'], 
             [GateType.JK_FF]: ['J', 'K', 'CLK'], 
             [GateType.SR_FF]: ['S', 'R', 'CLK'] 
         }[node.type] || [];
         
         connections = incoming.map(w => `${config[w.targetPinIdx] || `Pin${w.targetPinIdx}`} connected to ${getLabel(w.sourceNodeId, w.sourcePinIdx)}`);
      } else {
         connections = incoming.map((w, i) => `Input ${i} connected to ${getLabel(w.sourceNodeId, w.sourcePinIdx)}`);
      }
      
      lines.push(`  COMPONENT ${nodeName} (${node.type}):`);
      connections.forEach(c => lines.push(`    - ${c}`));
  });

  outputs.forEach(out => {
      const incoming = wires.find(w => w.targetNodeId === out.id);
      if (incoming) {
          lines.push(`  OUTPUT ${out.label} driven by ${getLabel(incoming.sourceNodeId, incoming.sourcePinIdx)}`);
      }
  });

  return lines.join('\n');
};

// --- Parser ---

export const parseEquationToCircuit = (eq: string, outputLabel: string = "Q"): { nodes: Node[], wires: Wire[] } | null => {
  let cleanEq = eq.trim();
  if (cleanEq.includes('=')) cleanEq = cleanEq.split('=')[1].trim();
  cleanEq = cleanEq.replace(/[;.]+$/, '');

  const nodes: Node[] = [];
  const wires: Wire[] = [];
  let nodeIdCounter = 0;
  const nextId = () => `auto_${nodeIdCounter++}`;

  const inputMap = new Map<string, string>(); 

  const createNode = (type: GateType, x: number, y: number, label: string = ""): Node => ({
    id: nextId(), type, position: { x, y }, label, inputs: [], outputs: []
  });

  const PRECEDENCE: Record<string, number> = {
    'OR': 1, 'NOR': 1,
    'XOR': 2, 'XNOR': 2,
    'AND': 3, 'NAND': 3,
    'NOT': 4
  };

  const build = (expr: string, x: number, y: number, depth: number): string => {
    expr = expr.trim();

    while (true) {
        if (expr.startsWith('(') && expr.endsWith(')')) {
            let balance = 0;
            let split = false;
            for (let i = 0; i < expr.length - 1; i++) {
                if (expr[i] === '(') balance++;
                if (expr[i] === ')') balance--;
                if (balance === 0) { split = true; break; }
            }
            if (!split) {
                expr = expr.slice(1, -1).trim();
                continue;
            }
        }
        break;
    }

    if (/^[a-zA-Z0-9_]+$/.test(expr) && !Object.keys(PRECEDENCE).includes(expr.toUpperCase()) && expr.toUpperCase() !== 'NOT') {
        if (inputMap.has(expr)) return inputMap.get(expr)!;
        const id = nextId();
        const inputNode: Node = {
            id, type: GateType.INPUT, position: { x: 50, y: 50 + inputMap.size * 80 }, label: expr, inputs: [], outputs: []
        };
        nodes.push(inputNode);
        inputMap.set(expr, id);
        return id;
    }

    let bestOpIdx = -1;
    let bestOpLen = 0;
    let bestOpType = '';
    let lowestPrec = 99;

    let balance = 0;
    
    for (let i = 0; i < expr.length; i++) {
        const char = expr[i];
        if (char === '(') { balance++; continue; }
        if (char === ')') { balance--; continue; }
        
        if (balance === 0) {
            if (expr.substring(i).toUpperCase().startsWith('NOT')) {
                const prec = PRECEDENCE['NOT'];
                if (prec < lowestPrec && i === 0) {
                     lowestPrec = prec;
                     bestOpIdx = i;
                     bestOpLen = 3;
                     bestOpType = 'NOT';
                }
            }

            for (const op of Object.keys(PRECEDENCE)) {
                if (op === 'NOT') continue;
                const sub = expr.substring(i);
                if (sub.toUpperCase().startsWith(op)) {
                     const validStart = i===0 || /[\s)]/.test(expr[i-1]);
                     const validEnd = (i + op.length === expr.length) || /[\s(]/.test(expr[i+op.length]);
                     
                     if (validStart && validEnd) {
                         const prec = PRECEDENCE[op];
                         if (prec <= lowestPrec) {
                             lowestPrec = prec;
                             bestOpIdx = i;
                             bestOpLen = op.length;
                             bestOpType = op;
                         }
                     }
                }
            }
        }
    }

    if (bestOpIdx !== -1) {
        const opType = bestOpType.toUpperCase() as GateType; 
        
        if (opType === 'NOT') {
            const operandStr = expr.substring(bestOpIdx + bestOpLen).trim();
            const gate = createNode(GateType.NOT, x, y);
            nodes.push(gate);
            
            const childId = build(operandStr, x - 120, y, depth + 1);
            wires.push({ id: nextId(), sourceNodeId: childId, sourcePinIdx: 0, targetNodeId: gate.id, targetPinIdx: 0 });
            return gate.id;
        } else {
            const leftStr = expr.substring(0, bestOpIdx).trim();
            const rightStr = expr.substring(bestOpIdx + bestOpLen).trim();
            
            const gate = createNode(GateType[opType as keyof typeof GateType], x, y);
            nodes.push(gate);
            
            const yOffset = 60 * Math.pow(0.8, depth); 

            const leftId = build(leftStr, x - 150, y - yOffset, depth + 1);
            const rightId = build(rightStr, x - 150, y + yOffset, depth + 1);

            wires.push({ id: nextId(), sourceNodeId: leftId, sourcePinIdx: 0, targetNodeId: gate.id, targetPinIdx: 0 });
            wires.push({ id: nextId(), sourceNodeId: rightId, sourcePinIdx: 0, targetNodeId: gate.id, targetPinIdx: 1 });
            
            return gate.id;
        }
    }
    
    return null;
  };

  try {
      const rootId = build(cleanEq, 800, 300, 0);
      if (!rootId) return null;

      const outputNode = createNode(GateType.OUTPUT, 950, 300, outputLabel);
      nodes.push(outputNode);
      wires.push({ id: nextId(), sourceNodeId: rootId, sourcePinIdx: 0, targetNodeId: outputNode.id, targetPinIdx: 0 });

      return { nodes, wires };
  } catch (e) {
      console.error("Parser Error:", e);
      return null;
  }
};

// --- Truth Table Generator ---

export const generateTruthTable = (nodes: Node[], wires: Wire[]) => {
  try {
      const inputs = nodes.filter(n => n.type === GateType.INPUT).sort((a, b) => a.label.localeCompare(b.label));
      const outputs = nodes.filter(n => n.type === GateType.OUTPUT).sort((a, b) => a.label.localeCompare(b.label));

      if (inputs.length > 10) return null; 

      const combinations = 1 << inputs.length;
      const table: { inputs: Record<string, boolean>, outputs: Record<string, boolean> }[] = [];

      for (let i = 0; i < combinations; i++) {
        // 1. Map overrides for this combination
        const inputOverrides = new Map<string, boolean>();
        const currentInputVals: Record<string, boolean> = {};
        
        inputs.forEach((inp, idx) => {
          const shift = inputs.length - 1 - idx;
          const val = !!((i >> shift) & 1);
          inputOverrides.set(inp.id, val);
          currentInputVals[inp.label] = val;
        });

        // 2. Clone Circuit State with overrides
        const simNodes = nodes.map(n => {
            if (n.type === GateType.INPUT && inputOverrides.has(n.id)) {
                return { ...n, value: inputOverrides.get(n.id) };
            }
            // For other nodes, start fresh to avoid state carry-over (important for Combinational Truth Table)
            // Sequential elements (FF) will start from default false, which is correct for steady-state 
            // combinatorial analysis unless explicit reset logic exists (not modeled here).
            return { ...n, value: false, internalState: {} };
        });

        // 3. Simulate
        // Use Infinity for clockSpeed to freeze CLOCK nodes during this static analysis
        const simulatedNodes = simulateCircuit(simNodes, wires, Infinity); 
        
        // 4. Extract Outputs
        const currentOutputVals: Record<string, boolean> = {};
        outputs.forEach(out => {
          const simNode = simulatedNodes.find(sn => sn.id === out.id);
          currentOutputVals[out.label] = simNode?.value ?? false;
        });

        table.push({ inputs: currentInputVals, outputs: currentOutputVals });
      }
      
      return { headers: [...inputs.map(i => i.label), ...outputs.map(o => o.label)], rows: table };
  } catch (e) {
      console.error("Truth Table Error", e);
      return null;
  }
};