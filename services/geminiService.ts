import { GoogleGenAI, Type } from "@google/genai";

// Note: In a real production app, this should be proxied through a backend.
// Using process.env.API_KEY as per instructions.
const apiKey = process.env.API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
}

export interface AiAnalysisResult {
  explanation: string;
  simplifiedEquation: string;
  vhdl: string;
  verilog: string;
}

export interface AiBuilderComponent {
    type: string;
    label: string;
    x: number;
    y: number;
}

export interface AiBuilderConnection {
    sourceLabel: string;
    targetLabel: string;
    targetPinIndex: number;
}

export interface AiBuilderResult {
    components: AiBuilderComponent[];
    connections: AiBuilderConnection[];
    vhdl: string;
    verilog: string;
    explanation: string;
}

export const explainCircuit = async (circuitContext: string): Promise<AiAnalysisResult> => {
  if (!ai) return { explanation: "API Key not configured.", simplifiedEquation: "", vhdl: "", verilog: "" };
  
  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
      You are an expert Digital Logic Engineer.
      I will provide you with either a Boolean Equation OR a Structural Netlist description of a digital circuit.

      Input Circuit:
      ${circuitContext}
      
      TASKS:
      1. ANALYZE: Determine if the circuit is purely Combinational or Sequential.
         - If it contains Flip-Flops (D_FF, JK_FF, etc), Latches, or Clocks, it is SEQUENTIAL.
      2. EXPLAIN: Describe the functionality of the circuit. What does it do? (e.g., "This is a 2-bit counter", "This is a full adder", "This is a state machine").
      3. SIMPLIFY (Combinational Only): If the circuit is purely combinational, simplify the boolean logic using Boolean Algebra. 
         - Return the simplified equation using keywords: AND, OR, NOT, XOR, NAND, NOR, XNOR.
         - If Sequential, return "Sequential Logic - Cannot simplify to single boolean equation".
      4. GENERATE VHDL:
         - Create an Entity and Architecture.
         - If Sequential: Use a 'process(clk)' block with 'rising_edge(clk)' to handle state updates.
         - If Combinational: Use concurrent signal assignments.
      5. GENERATE VERILOG:
         - Create a Module.
         - If Sequential: Use 'always @(posedge clk)' for flip-flops.
         - If Combinational: Use 'assign' statements.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                explanation: { type: Type.STRING, description: "Markdown explanation of the circuit logic." },
                simplifiedEquation: { type: Type.STRING, description: "The simplified boolean equation string (or 'Sequential Logic' note)." },
                vhdl: { type: Type.STRING, description: "VHDL code snippet." },
                verilog: { type: Type.STRING, description: "Verilog code snippet." }
            }
        }
      }
    });

    const text = response.text;
    if (!text) return { explanation: "No response from AI.", simplifiedEquation: "", vhdl: "", verilog: "" };

    const json = JSON.parse(text);
    return {
        explanation: json.explanation || "No analysis available.",
        simplifiedEquation: json.simplifiedEquation || "",
        vhdl: json.vhdl || "-- No VHDL generated",
        verilog: json.verilog || "// No Verilog generated"
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    return { explanation: "Error connecting to AI assistant.", simplifiedEquation: "", vhdl: "", verilog: "" };
  }
};

export const generateCircuitFromText = async (description: string): Promise<AiBuilderResult | null> => {
    if (!ai) return null;

    const model = 'gemini-2.5-flash';
    const prompt = `
    You are an expert Digital Logic Designer and VHDL/Verilog Engineer.
    The user wants to build a digital circuit described as: "${description}".

    Your task is to:
    1. Design the circuit using standard logic gates and flip-flops.
    2. Provide a layout for a visual editor using a COMPACT INTEGER GRID.
    3. Generate the corresponding VHDL and Verilog code.

    Valid Component Types:
    - Combinational: AND, OR, NAND, NOR, XOR, XNOR, NOT
    - Inputs/Outputs: INPUT, OUTPUT
    - Sequential: D_FF, T_FF, JK_FF, SR_FF, CLOCK
    - Displays: HEX_DISPLAY (4-bit input: 8,4,2,1)
    - Sources: PULL_UP, PULL_DOWN

    Layout Rules:
    - Use a COMPACT INTEGER GRID (x=0, 1, 2..., y=0, 1, 2...).
    - Do NOT use pixel coordinates (like 100, 200). Use small integers.
    - x corresponds to logical flow (0=left inputs, 1=next stage, ...).
    - y corresponds to vertical stacking (0=top, 1=below...).
    - Inputs should be at x=0.
    - Outputs should be at the highest x.

    Pin Index Mapping (for 'connections'):
    - NOT: 0=Input
    - AND/OR/NAND/NOR/XOR/XNOR: 0=Input A, 1=Input B
    - D_FF: 0=Data, 1=Clock
    - T_FF: 0=Toggle, 1=Clock
    - JK_FF: 0=J, 1=K, 2=Clock
    - SR_FF: 0=S, 1=R, 2=Clock
    - HEX_DISPLAY: 0=8(MSB), 1=4, 2=2, 3=1(LSB)
    
    Response Format (JSON):
    1. 'components': List of { type, label, x, y }. 'label' must be unique.
    2. 'connections': List of { sourceLabel, targetLabel, targetPinIndex }.
    3. 'vhdl': Complete VHDL code.
    4. 'verilog': Complete Verilog code.
    5. 'explanation': Brief summary of the design.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        components: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                    x: { type: Type.NUMBER },
                                    y: { type: Type.NUMBER }
                                }
                            }
                        },
                        connections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    sourceLabel: { type: Type.STRING },
                                    targetLabel: { type: Type.STRING },
                                    targetPinIndex: { type: Type.NUMBER }
                                }
                            }
                        },
                        vhdl: { type: Type.STRING },
                        verilog: { type: Type.STRING },
                        explanation: { type: Type.STRING }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) return null;
        return JSON.parse(text) as AiBuilderResult;
    } catch (e) {
        console.error("AI Builder Error:", e);
        return null;
    }
};

export const generateCircuitFromHDL = async (code: string): Promise<AiBuilderResult | null> => {
    if (!ai) return null;

    const model = 'gemini-2.5-flash';
    const prompt = `
    You are an expert Digital Logic Engineer.
    The user has provided the following HDL code (VHDL or Verilog):

    ${code}

    Your task is to:
    1. ANALYZE the HDL code to understand the logic structure, gates, and connections.
    2. SYNTHESIZE this logic into a visual circuit using the allowed components.
    3. CREATE a visual layout using a COMPACT INTEGER GRID (x=0, 1, 2..., y=0, 1, 2...).

    Allowed Components:
    - Logic: AND, OR, NAND, NOR, XOR, XNOR, NOT
    - I/O: INPUT, OUTPUT
    - Flip-Flops: D_FF, T_FF, JK_FF, SR_FF
    - Misc: CLOCK, HEX_DISPLAY (4-bit), PULL_UP, PULL_DOWN

    Instructions:
    - Map logic expressions to gates.
    - Map 'process' blocks with clock edges to Flip-Flops.
    - Layout components logically using SMALL INTEGER COORDINATES.
    - Inputs at x=0. Outputs at max x.
    - Avoid gaps in the grid indices.

    Pin Index Mapping:
    - NOT: 0=Input
    - Binary Gates (AND, OR, etc): 0=Input A, 1=Input B
    - D_FF: 0=Data, 1=Clock
    - T_FF: 0=Toggle, 1=Clock
    - JK_FF: 0=J, 1=K, 2=Clock
    - SR_FF: 0=S, 1=R, 2=Clock
    - HEX_DISPLAY: 0=8, 1=4, 2=2, 3=1

    Response Format (JSON):
    1. 'components': List of { type, label, x, y }.
    2. 'connections': List of { sourceLabel, targetLabel, targetPinIndex }.
    3. 'vhdl': Cleaned VHDL code.
    4. 'verilog': Cleaned Verilog code.
    5. 'explanation': Brief summary of the synthesized circuit.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        components: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                    x: { type: Type.NUMBER },
                                    y: { type: Type.NUMBER }
                                }
                            }
                        },
                        connections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    sourceLabel: { type: Type.STRING },
                                    targetLabel: { type: Type.STRING },
                                    targetPinIndex: { type: Type.NUMBER }
                                }
                            }
                        },
                        vhdl: { type: Type.STRING },
                        verilog: { type: Type.STRING },
                        explanation: { type: Type.STRING }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) return null;
        return JSON.parse(text) as AiBuilderResult;
    } catch (e) {
        console.error("HDL Builder Error:", e);
        return null;
    }
};