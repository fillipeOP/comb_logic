// Removed GoogleGenAI import
// import { GoogleGenAI, Type } from "@google/genai";

const AGENT_API_URL = "https://opgpt.apps.k3s-shared-dev.itaipu.int/v2/";

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

interface AgentRequest {
    query: string;
    user: {
        id: string;
        name: string;
        email: string;
        credentials: string[];
        additionalProperties: Record<string, any>;
    };
    chatHistory: { type: string; content: string }[];
    attachments: { contentType: string; name: string; uri: string }[];
    resourceUriFilters: string[];
    options: {
        supportAttachments: boolean;
        exportData: boolean;
        returnOnlyData: boolean;
    };
    additionalArgs: Record<string, any>;
}

// Helper function to call the local agent API
const callAgentApi = async (prompt: string): Promise<string | null> => {
    const payload: AgentRequest = {
        query: prompt,
        user: {
            id: "user-default",
            name: "LogicLab User",
            email: "user@logiclab.internal",
            credentials: [],
            additionalProperties: { additionalProp1: {} }
        },
        chatHistory: [],
        attachments: [],
        resourceUriFilters: [],
        options: {
            supportAttachments: true,
            exportData: false,
            returnOnlyData: false
        },
        additionalArgs: { additionalProp1: {} }
    };

    try {
        const response = await fetch(AGENT_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`Agent API Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        // Assuming the agent returns the answer in a field like 'text' or 'answer' or 'content'.
        if (typeof data === 'string') return data;
        if (data.text) return data.text;
        if (data.answer) return data.answer;
        if (data.content) return data.content;

        return JSON.stringify(data);

    } catch (error) {
        console.error("Agent API Connection Error:", error);
        return null;
    }
};

// Helper to clean Markdown JSON code blocks if present
const cleanJsonString = (str: string): string => {
    // Remove ```json ... ``` wrappers if they exist
    let cleaned = str.trim();
    if (cleaned.startsWith('```')) {
        const firstLineBreak = cleaned.indexOf('\n');
        if (firstLineBreak !== -1) {
            cleaned = cleaned.substring(firstLineBreak + 1);
        }
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.substring(0, cleaned.length - 3);
        }
    }
    return cleaned.trim();
}

export const explainCircuit = async (circuitContext: string): Promise<AiAnalysisResult> => {
  try {
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

      IMPORTANT: Return ONLY a valid JSON object with the following structure:
      {
        "explanation": "Markdown explanation...",
        "simplifiedEquation": "equation or note",
        "vhdl": "code...",
        "verilog": "code..."
      }
      Do not include any other text.
    `;

    const text = await callAgentApi(prompt);
    if (!text) return { explanation: "No response from AI Agent.", simplifiedEquation: "", vhdl: "", verilog: "" };

    const json = JSON.parse(cleanJsonString(text));
    return {
        explanation: json.explanation || "No analysis available.",
        simplifiedEquation: json.simplifiedEquation || "",
        vhdl: json.vhdl || "-- No VHDL generated",
        verilog: json.verilog || "// No Verilog generated"
    };
  } catch (error) {
    console.error("Agent Analysis Error:", error);
    return { explanation: "Error parsing AI response.", simplifiedEquation: "", vhdl: "", verilog: "" };
  }
};

export const generateCircuitFromText = async (description: string): Promise<AiBuilderResult | null> => {
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
    
    IMPORTANT: Return ONLY a valid JSON object with the following structure:
    {
      "components": [ { "type": "...", "label": "...", "x": 0, "y": 0 } ],
      "connections": [ { "sourceLabel": "...", "targetLabel": "...", "targetPinIndex": 0 } ],
      "vhdl": "...",
      "verilog": "...",
      "explanation": "..."
    }
    Do not include any other text.
    `;

    try {
        const text = await callAgentApi(prompt);
        if (!text) return null;
        return JSON.parse(cleanJsonString(text)) as AiBuilderResult;
    } catch (e) {
        console.error("AI Builder Error:", e);
        return null;
    }
};

export const generateCircuitFromHDL = async (code: string): Promise<AiBuilderResult | null> => {
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

    IMPORTANT: Return ONLY a valid JSON object with the following structure:
    {
      "components": [ { "type": "...", "label": "...", "x": 0, "y": 0 } ],
      "connections": [ { "sourceLabel": "...", "targetLabel": "...", "targetPinIndex": 0 } ],
      "vhdl": "...",
      "verilog": "...",
      "explanation": "..."
    }
    Do not include any other text.
    `;

    try {
        const text = await callAgentApi(prompt);
        if (!text) return null;
        return JSON.parse(cleanJsonString(text)) as AiBuilderResult;
    } catch (e) {
        console.error("HDL Builder Error:", e);
        return null;
    }
};
