import React, { useState, useEffect, useCallback } from 'react';
import { GateType, Node, Wire, CustomBlock } from './types';
import { Canvas } from './components/Canvas';
import { simulateCircuit, generateEquation, generateTruthTable, parseEquationToCircuit, generateCircuitDescription } from './utils/circuitLogic';
import { explainCircuit, AiAnalysisResult, generateCircuitFromText, generateCircuitFromHDL } from './services/geminiService';
import { 
  Save, Cpu, MousePointer2, Table, FileText, Wand2, Type, X, ArrowRightCircle, CheckCircle, AlertTriangle, HelpCircle,
  Copy, Check, Undo, Redo, Grid, Play, Square, Settings, Bot, Download, Upload, PlusSquare, ChevronDown, ChevronRight, Code, RotateCw, Plus, Minus
} from 'lucide-react';

const CopyableCode = ({ code, lang }: { code: string, lang: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  
  return ( 
    <div className="relative group mt-2">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
         <button onClick={handleCopy} className="p-1.5 bg-slate-700/80 backdrop-blur rounded hover:bg-slate-600 text-slate-300 shadow-lg border border-slate-600" title="Copy">
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
         </button>
      </div>
      <div className="absolute top-0 left-0 px-2 py-1 bg-slate-800 text-[10px] text-slate-500 font-bold uppercase rounded-br">{lang}</div>
      <pre className="bg-slate-950 p-4 pt-6 rounded border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-60 scrollbar-thin">{code}</pre>
    </div> 
  );
};

// Interface for a Workspace Tab
interface CircuitTab {
  id: string;
  name: string;
  nodes: Node[];
  wires: Wire[];
  history: {nodes: Node[], wires: Wire[]}[];
  historyIndex: number;
}

export default function App() {
  // --- Tab Management State ---
  const [tabs, setTabs] = useState<CircuitTab[]>([
    { id: 'main', name: 'Main Circuit', nodes: [], wires: [], history: [{nodes: [], wires: []}], historyIndex: 0 }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('main');

  // Derived state for the active tab
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const nodes = activeTab.nodes;
  const wires = activeTab.wires;
  const history = activeTab.history;
  const historyIndex = activeTab.historyIndex;

  // --- Global/UI State ---
  const [activeTool, setActiveTool] = useState<GateType | 'CURSOR'>('CURSOR');
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [clockSpeed, setClockSpeed] = useState(1000); 
  
  // Modals
  const [showTruthTable, setShowTruthTable] = useState(false);
  const [showEquationInput, setShowEquationInput] = useState(false);
  const [showSaveBlockModal, setShowSaveBlockModal] = useState(false);
  const [showTruthTableBuilder, setShowTruthTableBuilder] = useState(false);
  const [showAiBuilderModal, setShowAiBuilderModal] = useState(false);
  const [showHdlImportModal, setShowHdlImportModal] = useState(false);
  
  // Modal Inputs
  const [equationInput, setEquationInput] = useState('');
  const [blockNameInput, setBlockNameInput] = useState('');
  const [aiBuilderInput, setAiBuilderInput] = useState('');
  const [hdlInput, setHdlInput] = useState('');
  const [openInNewTab, setOpenInNewTab] = useState(false); // Checkbox state for builders

  // Truth Table Logic
  const [ttNumInputs, setTtNumInputs] = useState(2);
  const [ttOutputs, setTtOutputs] = useState<boolean[]>(Array(4).fill(false)); 
  const [truthTableData, setTruthTableData] = useState<{headers: string[], rows: any[]} | null>(null);

  // Analysis
  const [generatedEquation, setGeneratedEquation] = useState('');
  const [aiData, setAiData] = useState<AiAnalysisResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiTab, setAiTab] = useState<'analysis' | 'vhdl' | 'verilog'>('analysis');

  // System
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);
  const [confirmation, setConfirmation] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  // Library
  const [customBlocks, setCustomBlocks] = useState<CustomBlock[]>(() => { try { const saved = localStorage.getItem('logiclab_blocks'); return saved ? JSON.parse(saved) : []; } catch (e) { return []; } });
  const [expandedSections, setExpandedSections] = useState({ io: true, combinational: true, sequential: true, saved: true });

  // --- Proxied State Setters (to maintain compatibility with existing logic) ---

  const setNodes = useCallback((action: React.SetStateAction<Node[]>) => {
    setTabs(prevTabs => prevTabs.map(tab => {
      if (tab.id !== activeTabId) return tab;
      const newNodes = typeof action === 'function' ? action(tab.nodes) : action;
      return { ...tab, nodes: newNodes };
    }));
  }, [activeTabId]);

  const setWires = useCallback((action: React.SetStateAction<Wire[]>) => {
    setTabs(prevTabs => prevTabs.map(tab => {
      if (tab.id !== activeTabId) return tab;
      const newWires = typeof action === 'function' ? action(tab.wires) : action;
      return { ...tab, wires: newWires };
    }));
  }, [activeTabId]);

  // --- Tab Operations ---

  const createNewTab = (name: string, initialNodes: Node[] = [], initialWires: Wire[] = []) => {
    const newId = `tab_${Date.now()}`;
    const newTab: CircuitTab = {
      id: newId,
      name: name,
      nodes: initialNodes,
      wires: initialWires,
      history: [{nodes: initialNodes, wires: initialWires}],
      historyIndex: 0
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    return newId;
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      showNotification("Cannot close the last tab.", "error");
      return;
    }
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const updateTabName = (id: string, newName: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
  };

  // --- History Logic (Scoped to Active Tab) ---

  const addToHistory = useCallback((newNodes: Node[], newWires: Wire[]) => {
    setTabs(prevTabs => prevTabs.map(tab => {
      if (tab.id !== activeTabId) return tab;
      
      const newHistory = tab.history.slice(0, tab.historyIndex + 1);
      // Clean values to avoid storing transient simulation state
      const cleanNodes = newNodes.map(n => ({...n, value: false, internalState: n.internalState})); // Keep internalState struct but maybe reset values? Keeping struct is safer for FFs
      const cleanWires = newWires.map(w => ({...w, value: false}));
      
      newHistory.push({ nodes: cleanNodes, wires: cleanWires });
      return { ...tab, history: newHistory, historyIndex: newHistory.length - 1 };
    }));
  }, [activeTabId]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setNodes(prev.nodes);
      setWires(prev.wires);
      setTabs(prevTabs => prevTabs.map(t => t.id === activeTabId ? { ...t, historyIndex: t.historyIndex - 1 } : t));
    }
  }, [history, historyIndex, activeTabId, setNodes, setWires]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setNodes(next.nodes);
      setWires(next.wires);
      setTabs(prevTabs => prevTabs.map(t => t.id === activeTabId ? { ...t, historyIndex: t.historyIndex + 1 } : t));
    }
  }, [history, historyIndex, activeTabId, setNodes, setWires]);

  // --- Effects ---

  useEffect(() => { setTtOutputs(Array(1 << ttNumInputs).fill(false)); }, [ttNumInputs]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); } 
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); } 
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  useEffect(() => { localStorage.setItem('logiclab_blocks', JSON.stringify(customBlocks)); }, [customBlocks]);

  // Simulation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate active tab only
      const updatedNodes = simulateCircuit(nodes, wires, clockSpeed);
      setNodes(prev => {
         const changed = updatedNodes.some((n, i) => n.value !== prev[i]?.value || n.internalState?.lastToggle !== prev[i]?.internalState?.lastToggle || n.internalState?.displayValue !== prev[i]?.internalState?.displayValue || JSON.stringify(n.internalState?.outputValues) !== JSON.stringify(prev[i]?.internalState?.outputValues));
         return changed ? updatedNodes : prev;
      });
    }, 100); 
    return () => clearInterval(interval);
  }, [nodes, wires, clockSpeed, setNodes]);

  // --- Handlers ---

  const showNotification = (message: string, type: 'error' | 'success' = 'success') => { setNotification({ message, type }); setTimeout(() => setNotification(null), 3000); };
  const triggerConfirmation = (title: string, message: string, onConfirm: () => void) => { setConfirmation({ isOpen: true, title, message, onConfirm }); };
  const handleConfirmAction = () => { confirmation.onConfirm(); setConfirmation({ ...confirmation, isOpen: false }); };
  const toggleNodeValue = (nodeId: string) => { if (!isSimulationMode) return; setNodes(prev => prev.map(n => { if (n.id === nodeId && n.type === GateType.INPUT) { return { ...n, value: !n.value }; } return n; })); };
  const toggleSection = (section: keyof typeof expandedSections) => { setExpandedSections(prev => ({...prev, [section]: !prev[section]})); };

  const handleGenerateEquation = () => { const eq = generateEquation(nodes, wires); setGeneratedEquation(eq); setAiData(null); setAiTab('analysis'); };
  
  const handleAskGemini = async () => { 
      const hasSequential = nodes.some(n => [GateType.D_FF, GateType.T_FF, GateType.JK_FF, GateType.SR_FF, GateType.CLOCK, GateType.HEX_DISPLAY, GateType.CUSTOM_BLOCK].includes(n.type)); 
      let context = hasSequential ? generateCircuitDescription(nodes, wires) : (generatedEquation || generateEquation(nodes, wires)); 
      if (!context || context === "No Output") if (nodes.length > 0) context = generateCircuitDescription(nodes, wires); 
      if (!context) return; 
      setIsAiLoading(true); const result = await explainCircuit(context); setAiData(result); setIsAiLoading(false); 
  };

  const handleSimplifyCircuit = () => { 
      if (!aiData?.simplifiedEquation) return; 
      if (aiData.simplifiedEquation.toLowerCase().includes("sequential")) { showNotification("Cannot redraw sequential.", "error"); return; } 
      const outputNode = nodes.find(n => n.type === GateType.OUTPUT); const targetLabel = outputNode ? outputNode.label : "Q"; 
      const result = parseEquationToCircuit(aiData.simplifiedEquation, targetLabel); 
      if (result) triggerConfirmation("Redraw?", "Replace circuit?", () => { setNodes(result.nodes); setWires(result.wires); addToHistory(result.nodes, result.wires); setGeneratedEquation(aiData.simplifiedEquation); setAiData(null); showNotification("Simplified!"); }); 
      else showNotification("Parse error.", "error"); 
  };

  const handleImportEquation = (eqText?: string) => { 
      const textToParse = eqText || equationInput; 
      const result = parseEquationToCircuit(textToParse); 
      if (result) { setNodes(result.nodes); setWires(result.wires); addToHistory(result.nodes, result.wires); setShowEquationInput(false); setEquationInput(''); showNotification("Generated."); } 
      else showNotification("Invalid Format.", "error"); 
  };
  
  const handleAiBuild = async () => {
    if (!aiBuilderInput.trim()) return; 
    setIsAiLoading(true); 
    const result = await generateCircuitFromText(aiBuilderInput); 
    setIsAiLoading(false);
    if (!result) { showNotification("Failed.", "error"); return; }
    
    try {
        const newNodes: Node[] = []; const newWires: Wire[] = []; const labelToIdMap = new Map<string, string>();
        
        // Coordinate Compression
        const uniqueX = Array.from(new Set(result.components.map(c => c.x))).sort((a, b) => a - b);
        const uniqueY = Array.from(new Set(result.components.map(c => c.y))).sort((a, b) => a - b);
        const mapX = new Map(uniqueX.map((val, index) => [val, index]));
        const mapY = new Map(uniqueY.map((val, index) => [val, index]));

        result.components.forEach((comp) => { 
             const id = `ai_${Date.now()}_${Math.random().toString(36).substr(2,9)}`; labelToIdMap.set(comp.label, id); 
             const typeKey = comp.type.toUpperCase().replace('-', '_'); 
             let gateType = GateType.AND; if (Object.values(GateType).includes(typeKey as GateType)) gateType = typeKey as GateType; else if (typeKey === 'INPUT') gateType = GateType.INPUT; else if (typeKey === 'OUTPUT') gateType = GateType.OUTPUT; else if (typeKey === 'D_FLIP_FLOP') gateType = GateType.D_FF; else if (typeKey === 'JK_FLIP_FLOP') gateType = GateType.JK_FF; else if (typeKey === 'CLOCK') gateType = GateType.CLOCK; else if (typeKey === 'HEX_DISPLAY') gateType = GateType.HEX_DISPLAY; 
             const gridX = mapX.get(comp.x) ?? 0; const gridY = mapY.get(comp.y) ?? 0;
             const x = gridX * 180 + 100; const y = gridY * 120 + 100;
             newNodes.push({ id, type: gateType, label: comp.label, position: { x, y }, inputs: [], outputs: [], internalState: {} }); 
        });
        result.connections.forEach((conn) => { const sourceId = labelToIdMap.get(conn.sourceLabel); const targetId = labelToIdMap.get(conn.targetLabel); if (sourceId && targetId) newWires.push({ id: `wire_${Date.now()}_${Math.random().toString(36).substr(2,9)}`, sourceNodeId: sourceId, sourcePinIdx: 0, targetNodeId: targetId, targetPinIdx: conn.targetPinIndex }); });
        
        const finishBuild = () => {
            if (openInNewTab) {
                createNewTab(`AI Gen ${tabs.length}`, newNodes, newWires);
            } else {
                setNodes(newNodes); setWires(newWires); addToHistory(newNodes, newWires); 
            }
            setAiData({ explanation: result.explanation, simplifiedEquation: "", vhdl: result.vhdl, verilog: result.verilog }); 
            setAiTab('analysis'); setShowAiBuilderModal(false); setAiBuilderInput(''); showNotification("Built!");
        };

        if (!openInNewTab && nodes.length > 0) {
            triggerConfirmation("Overwrite Canvas?", "This will replace your current circuit. Open in new tab instead?", finishBuild);
        } else {
            finishBuild();
        }
    } catch (e) { showNotification("Error.", "error"); }
  };
  
  const handleHdlBuild = async () => {
    if (!hdlInput.trim()) return;
    setIsAiLoading(true);
    const result = await generateCircuitFromHDL(hdlInput);
    setIsAiLoading(false);
    if (!result) { showNotification("Failed to synthesize.", "error"); return; }
    try {
        const newNodes: Node[] = []; const newWires: Wire[] = []; const labelToIdMap = new Map<string, string>();
        
        const uniqueX = Array.from(new Set(result.components.map(c => c.x))).sort((a, b) => a - b);
        const uniqueY = Array.from(new Set(result.components.map(c => c.y))).sort((a, b) => a - b);
        const mapX = new Map(uniqueX.map((val, index) => [val, index]));
        const mapY = new Map(uniqueY.map((val, index) => [val, index]));

        result.components.forEach((comp) => { 
             const id = `hdl_${Date.now()}_${Math.random().toString(36).substr(2,9)}`; labelToIdMap.set(comp.label, id); 
             const typeKey = comp.type.toUpperCase().replace('-', '_');
             let gateType = GateType.AND;
             if (Object.values(GateType).includes(typeKey as GateType)) gateType = typeKey as GateType;
             else if (typeKey === 'INPUT') gateType = GateType.INPUT; else if (typeKey === 'OUTPUT') gateType = GateType.OUTPUT; else if (typeKey === 'D_FLIP_FLOP') gateType = GateType.D_FF; else if (typeKey === 'JK_FLIP_FLOP') gateType = GateType.JK_FF; else if (typeKey === 'CLOCK') gateType = GateType.CLOCK; else if (typeKey === 'HEX_DISPLAY') gateType = GateType.HEX_DISPLAY; else if (typeKey === 'PULL_UP') gateType = GateType.PULL_UP; else if (typeKey === 'PULL_DOWN') gateType = GateType.PULL_DOWN;
             const gridX = mapX.get(comp.x) ?? 0; const gridY = mapY.get(comp.y) ?? 0;
             const x = gridX * 180 + 100; const y = gridY * 120 + 100;
             newNodes.push({ id, type: gateType, label: comp.label, position: { x, y }, inputs: [], outputs: [], internalState: {} }); 
        });
        result.connections.forEach((conn) => { const sourceId = labelToIdMap.get(conn.sourceLabel); const targetId = labelToIdMap.get(conn.targetLabel); if (sourceId && targetId) { newWires.push({ id: `wire_${Date.now()}_${Math.random().toString(36).substr(2,9)}`, sourceNodeId: sourceId, sourcePinIdx: 0, targetNodeId: targetId, targetPinIdx: conn.targetPinIndex }); } });
        
        const finishBuild = () => {
            if (openInNewTab) {
                createNewTab(`HDL Import ${tabs.length}`, newNodes, newWires);
            } else {
                setNodes(newNodes); setWires(newWires); addToHistory(newNodes, newWires);
            }
            setAiData({ explanation: result.explanation, simplifiedEquation: "", vhdl: result.vhdl, verilog: result.verilog }); 
            setAiTab('analysis'); setShowHdlImportModal(false); setHdlInput(''); showNotification("Built!"); 
        };

        if (!openInNewTab && nodes.length > 0) {
            triggerConfirmation("Overwrite Canvas?", "Replace current canvas?", finishBuild);
        } else {
            finishBuild();
        }
    } catch (e) { showNotification("Error.", "error"); }
  };

  const handleShowTruthTable = () => { const data = generateTruthTable(nodes, wires); if (data) { setTruthTableData(data); setShowTruthTable(true); } else showNotification("Error generating table.", "error"); };
  const handleBuildFromTruthTable = () => { 
      const inputs = ['A', 'B', 'C', 'D'].slice(0, ttNumInputs); const minterms: string[] = []; 
      ttOutputs.forEach((outVal, rowIndex) => { if (outVal) { const terms = inputs.map((label, bitIndex) => { const shift = ttNumInputs - 1 - bitIndex; const bit = (rowIndex >> shift) & 1; return bit === 1 ? label : `NOT ${label}`; }); minterms.push(`(${terms.join(' AND ')})`); } }); 
      let equation = "Q = 0"; if (minterms.length > 0) equation = minterms.join(' OR '); else if (ttOutputs.every(v => v)) equation = `${inputs[0]} OR NOT ${inputs[0]}`; 
      
      const finishBuild = () => {
          const result = parseEquationToCircuit(equation);
          if (result) {
              if (openInNewTab) createNewTab(`TT Gen ${tabs.length}`, result.nodes, result.wires);
              else { setNodes(result.nodes); setWires(result.wires); addToHistory(result.nodes, result.wires); }
              setShowTruthTableBuilder(false);
          }
      };
      finishBuild();
  };

  const handleSaveBlock = () => { if (!blockNameInput.trim()) { showNotification("Enter name.", "error"); return; } const inputs = nodes.filter(n => n.type === GateType.INPUT).length; const outputs = nodes.filter(n => n.type === GateType.OUTPUT).length; const newBlock: CustomBlock = { id: Date.now().toString(), name: blockNameInput, circuit: { nodes, wires }, inputCount: inputs, outputCount: outputs }; setCustomBlocks([...customBlocks, newBlock]); setShowSaveBlockModal(false); setBlockNameInput(''); showNotification(`Saved!`); };
  const loadBlock = (block: CustomBlock) => { triggerConfirmation("Load?", `Load "${block.name}"?`, () => { setNodes(block.circuit.nodes); setWires(block.circuit.wires); addToHistory(block.circuit.nodes, block.circuit.wires); showNotification(`Loaded.`); }); };
  const addCustomBlockToCanvas = (block: CustomBlock) => { const newNode: Node = { id: `custom_${Date.now()}`, type: GateType.CUSTOM_BLOCK, position: { x: 100, y: 100 }, label: block.name, inputs: [], outputs: [], internalState: {}, customBlockDefinition: block }; const newNodes = [...nodes, newNode]; setNodes(newNodes); addToHistory(newNodes, wires); showNotification(`Added.`); };
  const handleExportBlocks = () => { if (customBlocks.length === 0) { showNotification("No blocks.", "error"); return; } const blob = new Blob([JSON.stringify(customBlocks, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `logiclab_blocks.json`; document.body.appendChild(link); link.click(); document.body.removeChild(link); showNotification("Exported."); };
  const handleImportBlocks = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => { try { const imported = JSON.parse(event.target?.result as string); if (Array.isArray(imported) && imported.every(b => b.id && b.name && b.circuit)) { setCustomBlocks(prev => { const existingIds = new Set(prev.map(b => b.id)); const newBlocks = imported.filter((b: CustomBlock) => !existingIds.has(b.id)); return [...prev, ...newBlocks]; }); showNotification(`Imported.`); } else showNotification("Invalid.", "error"); } catch (err) { showNotification("Failed.", "error"); } }; reader.readAsText(file); e.target.value = ''; };
  const clearCanvas = () => { triggerConfirmation("Clear?", "Sure?", () => { setNodes([]); setWires([]); addToHistory([], []); }); };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 font-sans">
      {/* Notifications */}
      {notification && ( <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 border animate-fade-in-down ${notification.type === 'success' ? 'bg-emerald-900/90 border-emerald-500' : 'bg-red-900/90 border-red-500'} text-white`}> {notification.type === 'success' ? <CheckCircle size={20}/> : <AlertTriangle size={20}/>} <span className="font-medium">{notification.message}</span> </div> )}

      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl">
        <div className="p-4 border-b border-slate-800"><h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center gap-2"><Cpu /> LogicLab</h1></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Mode & Tools */}
          <div>
            <h3 className="text-xs uppercase text-slate-500 font-semibold mb-3 tracking-wider">Mode</h3>
            <button onClick={() => { setIsSimulationMode(!isSimulationMode); setActiveTool('CURSOR'); }} className={`w-full p-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${isSimulationMode ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{isSimulationMode ? <Play size={18} fill="currentColor" /> : <Square size={18} />}{isSimulationMode ? "SIMULATION ON" : "DESIGN MODE"}</button>
            {isSimulationMode && ( <div className="mt-4 p-3 bg-slate-800/50 rounded border border-slate-700"><div className="flex items-center justify-between text-xs text-slate-400 mb-2"><span className="flex items-center gap-1"><Settings size={12}/> Clock Speed</span><span>{clockSpeed}ms</span></div><input type="range" min="100" max="2000" step="100" value={clockSpeed} onChange={(e) => setClockSpeed(Number(e.target.value))} className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"/><div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>Fast</span><span>Slow</span></div></div> )}
          </div>
          
          <div className={isSimulationMode ? 'opacity-30 pointer-events-none grayscale' : ''}>
             <h3 className="text-xs uppercase text-slate-500 font-semibold mb-3 tracking-wider">Tools</h3>
             <div className="grid grid-cols-2 gap-2">
               <button onClick={() => setActiveTool('CURSOR')} className={`p-2 rounded flex items-center justify-center gap-2 text-sm transition-colors ${activeTool === 'CURSOR' ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700'}`}><MousePointer2 size={16}/> Cursor</button>
               <button onClick={clearCanvas} className="p-2 rounded flex items-center justify-center gap-2 text-sm bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-900/50">Clear</button>
               <button onClick={undo} disabled={historyIndex <= 0} className="p-2 rounded flex items-center justify-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-50"><Undo size={14} /> Undo</button>
               <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 rounded flex items-center justify-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-50"><Redo size={14} /> Redo</button>
             </div>
          </div>

          <div className={`space-y-4 ${isSimulationMode ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
            <div>
                <button onClick={() => toggleSection('io')} className="flex items-center w-full text-xs uppercase text-slate-500 font-semibold mb-2 tracking-wider hover:text-slate-300">
                    {expandedSections.io ? <ChevronDown size={14} className="mr-1"/> : <ChevronRight size={14} className="mr-1"/>} IO & Sources
                </button>
                {expandedSections.io && (
                    <div className="grid grid-cols-2 gap-2 animate-fade-in">
                        {[GateType.INPUT, GateType.OUTPUT, GateType.HEX_DISPLAY, GateType.CLOCK, GateType.PULL_UP, GateType.PULL_DOWN].map(type => (
                            <button key={type} onClick={() => setActiveTool(type)} className={`p-2 rounded text-sm font-medium border transition-all ${activeTool === type ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300'}`}>
                                {type.replace('_', ' ').replace('HEX DISPLAY', 'HEX')}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div>
                <button onClick={() => toggleSection('combinational')} className="flex items-center w-full text-xs uppercase text-slate-500 font-semibold mb-2 tracking-wider hover:text-slate-300">
                    {expandedSections.combinational ? <ChevronDown size={14} className="mr-1"/> : <ChevronRight size={14} className="mr-1"/>} Combinational
                </button>
                {expandedSections.combinational && (
                    <div className="grid grid-cols-2 gap-2 animate-fade-in">
                        {[GateType.AND, GateType.OR, GateType.NOT, GateType.NAND, GateType.NOR, GateType.XOR, GateType.XNOR].map(type => (
                            <button key={type} onClick={() => setActiveTool(type)} className={`p-2 rounded text-sm font-medium border transition-all ${activeTool === type ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300'}`}>
                                {type}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div>
                <button onClick={() => toggleSection('sequential')} className="flex items-center w-full text-xs uppercase text-slate-500 font-semibold mb-2 tracking-wider hover:text-slate-300">
                    {expandedSections.sequential ? <ChevronDown size={14} className="mr-1"/> : <ChevronRight size={14} className="mr-1"/>} Sequential
                </button>
                {expandedSections.sequential && (
                    <div className="grid grid-cols-2 gap-2 animate-fade-in">
                        {[GateType.D_FF, GateType.T_FF, GateType.JK_FF, GateType.SR_FF].map(type => (
                            <button key={type} onClick={() => setActiveTool(type)} className={`p-2 rounded text-sm font-medium border transition-all ${activeTool === type ? 'bg-purple-600/20 border-purple-500 text-purple-200' : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300'}`}>
                                {type.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                )}
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase text-slate-500 font-semibold mb-3 tracking-wider">Actions</h3>
            <div className="space-y-2">
              <button onClick={() => { setOpenInNewTab(false); setShowAiBuilderModal(true); }} className="w-full p-2 rounded bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-700/50 hover:from-purple-800/50 hover:to-blue-800/50 text-left text-sm flex items-center gap-2"><Bot size={16} className="text-purple-300"/><span className="font-bold text-purple-100">Build with AI</span></button>
              <button onClick={() => { setOpenInNewTab(false); setShowHdlImportModal(true); }} className="w-full p-2 rounded bg-gradient-to-r from-pink-900/50 to-red-900/50 border border-pink-700/50 hover:from-pink-800/50 hover:to-red-800/50 text-left text-sm flex items-center gap-2"><Code size={16} className="text-pink-300"/><span className="font-bold text-pink-100">HDL to Circuit</span></button>
              <button onClick={handleGenerateEquation} className="w-full p-2 rounded bg-slate-800 hover:bg-slate-700 text-left text-sm flex items-center gap-2"><FileText size={16} className="text-emerald-400"/> Get Equation</button>
              <button onClick={() => setShowEquationInput(true)} className="w-full p-2 rounded bg-slate-800 hover:bg-slate-700 text-left text-sm flex items-center gap-2"><Type size={16} className="text-amber-400"/> Equation to Circuit</button>
              <button onClick={handleShowTruthTable} className="w-full p-2 rounded bg-slate-800 hover:bg-slate-700 text-left text-sm flex items-center gap-2"><Table size={16} className="text-purple-400"/> Get Truth Table</button>
              <button onClick={() => { setOpenInNewTab(false); setShowTruthTableBuilder(true); }} className="w-full p-2 rounded bg-slate-800 hover:bg-slate-700 text-left text-sm flex items-center gap-2"><Grid size={16} className="text-pink-400"/> Truth Table to Circuit</button>
              <button onClick={() => setShowSaveBlockModal(true)} className="w-full p-2 rounded bg-slate-800 hover:bg-slate-700 text-left text-sm flex items-center gap-2"><Save size={16} className="text-cyan-400"/> Save Logic Block</button>
            </div>
          </div>

          <div className={isSimulationMode ? 'opacity-30 pointer-events-none' : ''}>
              <div className="flex justify-between items-center mb-2">
                 <button onClick={() => toggleSection('saved')} className="flex items-center text-xs uppercase text-slate-500 font-semibold tracking-wider hover:text-slate-300">
                    {expandedSections.saved ? <ChevronDown size={14} className="mr-1"/> : <ChevronRight size={14} className="mr-1"/>} Saved Blocks
                 </button>
                 <div className="flex gap-1">
                    <button onClick={handleExportBlocks} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Export"><Download size={14}/></button>
                    <label className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer" title="Import"><Upload size={14}/><input type="file" className="hidden" accept=".json" onChange={handleImportBlocks}/></label>
                 </div>
              </div>
              {expandedSections.saved && (
                  customBlocks.length > 0 ? (
                    <div className="space-y-1 animate-fade-in">
                        {customBlocks.map(block => (
                        <div key={block.id} className="flex gap-1">
                            <button onClick={() => loadBlock(block)} className="flex-1 text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 rounded truncate group flex justify-between items-center" title="Open/Edit">
                                <span>{block.name}</span>
                                <span className="text-xs opacity-50 group-hover:opacity-100">({block.inputCount}i/{block.outputCount}o)</span>
                            </button>
                            <button onClick={() => addCustomBlockToCanvas(block)} className="px-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded" title="Add as Component">
                                <PlusSquare size={14} />
                            </button>
                        </div>
                        ))}
                    </div>
                  ) : ( <div className="text-xs text-slate-600 text-center py-4 italic">No blocks saved.</div> )
              )}
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-slate-950">
        {/* Tab Bar */}
        <div className="flex items-center bg-slate-900 border-b border-slate-800 px-2 overflow-x-auto">
            {tabs.map(tab => (
                <div 
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer border-r border-slate-800 hover:bg-slate-800 transition-colors group ${activeTabId === tab.id ? 'bg-slate-800 text-white border-t-2 border-t-blue-500' : 'text-slate-400 border-t-2 border-t-transparent'}`}
                >
                    {isSimulationMode && activeTabId === tab.id && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>}
                    <span className="truncate max-w-[120px]">
                        {/* Editable Name if Active? For now static input */}
                        {activeTabId === tab.id && !isSimulationMode ? (
                            <input 
                                className="bg-transparent outline-none w-full"
                                value={tab.name}
                                onChange={(e) => updateTabName(tab.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : tab.name}
                    </span>
                    <button 
                        onClick={(e) => closeTab(tab.id, e)}
                        className={`p-0.5 rounded-full hover:bg-slate-700 ${tabs.length === 1 ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                        <X size={12} />
                    </button>
                </div>
            ))}
            <button 
                onClick={() => createNewTab(`Circuit ${tabs.length + 1}`)}
                className="p-2 text-slate-500 hover:text-white hover:bg-slate-800"
                title="New Tab"
            >
                <Plus size={16} />
            </button>
        </div>

        <div className="flex-1 relative">
            <Canvas nodes={nodes} wires={wires} setNodes={setNodes} setWires={setWires} activeTool={activeTool} setActiveTool={setActiveTool} addToHistory={addToHistory} isSimulationMode={isSimulationMode} toggleNodeValue={toggleNodeValue}/>
            
            <div className={`absolute top-4 right-4 backdrop-blur border p-4 rounded-lg shadow-2xl max-w-md pointer-events-none select-none transition-colors ${isSimulationMode ? 'bg-emerald-900/80 border-emerald-700' : 'bg-slate-900/90 border-slate-700'}`}>
                <h2 className="text-sm font-bold text-slate-300 mb-1">{isSimulationMode ? "Interactive Simulation" : "Design Mode"}</h2>
                <div className={`flex items-center gap-2 text-xs ${isSimulationMode ? 'text-white' : 'text-emerald-400'}`}><span className="relative flex h-3 w-3"><span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSimulationMode ? 'bg-white' : 'bg-emerald-400'}`}></span><span className={`relative inline-flex rounded-full h-3 w-3 ${isSimulationMode ? 'bg-white' : 'bg-emerald-500'}`}></span></span>{isSimulationMode ? "Running..." : "Active"}</div>
            </div>
        </div>

        {(generatedEquation || aiData) && ( <div className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 shadow-xl z-20 max-h-[60vh] overflow-y-auto"><div className="container mx-auto max-w-4xl flex flex-col gap-4"><div className="flex justify-between items-start"><div><h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Analysis</h3>{generatedEquation && <code className="bg-slate-950 px-4 py-2 rounded border border-slate-800 text-lg text-blue-300 font-mono block">{generatedEquation}</code>}</div><button onClick={() => { setGeneratedEquation(''); setAiData(null); }} className="text-slate-500 hover:text-slate-300"><X size={20}/></button></div><div className="bg-slate-800/50 rounded p-4 border border-slate-700/50"><div className="flex items-center gap-3 mb-4"><Wand2 size={18} className="text-purple-400"/><h4 className="font-semibold text-slate-200">Gemini AI</h4></div>{aiData ? (<div><div className="flex gap-4 border-b border-slate-700 mb-4"><button onClick={()=>setAiTab('analysis')} className={`pb-2 text-sm font-medium border-b-2 ${aiTab==='analysis'?'border-purple-500 text-white':'border-transparent text-slate-400'}`}>Analysis</button><button onClick={()=>setAiTab('vhdl')} className={`pb-2 text-sm font-medium border-b-2 ${aiTab==='vhdl'?'border-purple-500 text-white':'border-transparent text-slate-400'}`}>VHDL</button><button onClick={()=>setAiTab('verilog')} className={`pb-2 text-sm font-medium border-b-2 ${aiTab==='verilog'?'border-purple-500 text-white':'border-transparent text-slate-400'}`}>Verilog</button></div>{aiTab==='analysis'&&(<div className="space-y-4"><div className="prose prose-invert text-slate-300 whitespace-pre-wrap">{aiData.explanation}</div>{aiData.simplifiedEquation && !aiData.simplifiedEquation.includes("Sequential") && (<div className="flex justify-between bg-slate-900/50 p-3 rounded items-center"><code className="text-emerald-400">{aiData.simplifiedEquation}</code><button onClick={handleSimplifyCircuit} className="bg-emerald-600 px-3 py-1 rounded text-xs">Redraw</button></div>)}</div>)}{aiTab==='vhdl'&&<CopyableCode code={aiData.vhdl} lang="VHDL"/>}{aiTab==='verilog'&&<CopyableCode code={aiData.verilog} lang="Verilog"/>}</div>) : (<button onClick={handleAskGemini} disabled={isAiLoading} className="text-sm bg-purple-600 px-4 py-2 rounded text-white">{isAiLoading?'Analyzing...':'Analyze'}</button>)}</div></div></div> )}
        
        {/* Modals */}
        {showAiBuilderModal && <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-purple-500/50 rounded-xl p-6 max-w-lg w-full"><h3 className="text-white font-bold text-xl mb-4">Build with AI</h3><textarea className="w-full bg-slate-950 text-white p-3 rounded border border-slate-700 h-32" value={aiBuilderInput} onChange={e=>setAiBuilderInput(e.target.value)} placeholder="Describe circuit..."/><div className="flex items-center gap-2 mt-4 text-sm text-slate-400"><input type="checkbox" checked={openInNewTab} onChange={e => setOpenInNewTab(e.target.checked)} className="rounded bg-slate-800 border-slate-600"/> Open in new tab</div><div className="flex justify-end gap-2 mt-4"><button onClick={()=>setShowAiBuilderModal(false)} className="text-slate-300 px-4 py-2">Cancel</button><button onClick={handleAiBuild} className="bg-purple-600 text-white px-4 py-2 rounded">{isAiLoading?'Generating...':'Generate'}</button></div></div></div>}
        
        {showHdlImportModal && <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-pink-500/50 rounded-xl p-6 max-w-lg w-full"><h3 className="text-white font-bold text-xl mb-4">HDL to Circuit</h3><textarea className="w-full bg-slate-950 text-white p-3 rounded border border-slate-700 h-32 font-mono text-sm" value={hdlInput} onChange={e=>setHdlInput(e.target.value)} placeholder="Paste VHDL or Verilog code here..."/><div className="flex items-center gap-2 mt-4 text-sm text-slate-400"><input type="checkbox" checked={openInNewTab} onChange={e => setOpenInNewTab(e.target.checked)} className="rounded bg-slate-800 border-slate-600"/> Open in new tab</div><div className="flex justify-end gap-2 mt-4"><button onClick={()=>setShowHdlImportModal(false)} className="text-slate-300 px-4 py-2">Cancel</button><button onClick={handleHdlBuild} className="bg-pink-600 text-white px-4 py-2 rounded">{isAiLoading?'Synthesizing...':'Build Circuit'}</button></div></div></div>}
        
        {showEquationInput && <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full"><h3 className="text-white font-bold text-xl mb-4">Equation</h3><input className="w-full bg-slate-950 text-white p-3 rounded border border-slate-700" value={equationInput} onChange={e=>setEquationInput(e.target.value)} placeholder="Q = A AND B"/><div className="flex justify-end gap-2 mt-4"><button onClick={()=>setShowEquationInput(false)} className="text-slate-300 px-4 py-2">Cancel</button><button onClick={()=>handleImportEquation()} className="bg-blue-600 text-white px-4 py-2 rounded">Import</button></div></div></div>}
        
        {showSaveBlockModal && <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full"><h3 className="text-white font-bold text-xl mb-4">Save Block</h3><input className="w-full bg-slate-950 text-white p-3 rounded border border-slate-700" value={blockNameInput} onChange={e=>setBlockNameInput(e.target.value)} placeholder="Name"/><div className="flex justify-end gap-2 mt-4"><button onClick={()=>setShowSaveBlockModal(false)} className="text-slate-300 px-4 py-2">Cancel</button><button onClick={handleSaveBlock} className="bg-cyan-600 text-white px-4 py-2 rounded">Save</button></div></div></div>}
        
        {showTruthTableBuilder && <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full max-h-[90vh] flex flex-col"><div className="flex justify-between mb-4"><h3 className="text-white font-bold">Truth Table Builder</h3><div className="flex gap-1">{[2,3,4].map(n=><button key={n} onClick={()=>setTtNumInputs(n)} className={`px-2 py-1 rounded border ${ttNumInputs===n?'bg-pink-600 border-pink-500':'border-slate-700'}`}>{n}</button>)}</div></div><div className="overflow-auto flex-1"><table className="w-full text-center text-sm"><thead><tr>{Array.from({length:ttNumInputs}).map((_,i)=><th key={i} className="text-slate-400 pb-2">{'ABCD'[i]}</th>)}<th className="text-pink-400 pb-2">Q</th></tr></thead><tbody>{Array.from({length:1<<ttNumInputs}).map((_,r)=><tr key={r} className="border-b border-slate-800/50">{Array.from({length:ttNumInputs}).map((_,c)=><td key={c} className="py-2 text-slate-500">{(r>>(ttNumInputs-1-c))&1}</td>)}<td className="py-2"><button onClick={()=>{const n=[...ttOutputs];n[r]=!n[r];setTtOutputs(n);}} className={`w-6 h-6 rounded ${ttOutputs[r]?'bg-pink-500 text-white':'bg-slate-800 text-slate-600'}`}>{ttOutputs[r]?'1':'0'}</button></td></tr>)}</tbody></table></div><div className="flex items-center gap-2 mt-4 text-sm text-slate-400"><input type="checkbox" checked={openInNewTab} onChange={e => setOpenInNewTab(e.target.checked)} className="rounded bg-slate-800 border-slate-600"/> Open in new tab</div><div className="mt-4 flex justify-end gap-2"><button onClick={()=>setShowTruthTableBuilder(false)} className="text-slate-300 px-4 py-2">Cancel</button><button onClick={handleBuildFromTruthTable} className="bg-pink-600 text-white px-4 py-2 rounded">Generate</button></div></div></div>}
        
        {showTruthTable && truthTableData && <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"><div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-3xl w-full max-h-[80vh] flex flex-col"><div className="flex justify-between mb-4"><h3 className="text-white font-bold text-xl"><Table size={20} className="inline mr-2"/>Truth Table</h3><button onClick={()=>setShowTruthTable(false)} className="text-slate-400 hover:text-white"><X/></button></div><div className="overflow-auto flex-1"><table className="w-full text-left text-sm"><thead><tr className="bg-slate-800 text-slate-300">{truthTableData.headers.map(h=><th key={h} className="p-2 border-b border-slate-700">{h}</th>)}</tr></thead><tbody>{truthTableData.rows.map((r,i)=><tr key={i} className="hover:bg-slate-800/50 border-b border-slate-800/50">{truthTableData.headers.map(h=>{const v=r.inputs[h]??r.outputs[h];return(<td key={h} className={`p-2 ${v?'text-emerald-400 font-bold':'text-slate-600'}`}>{v?'1':'0'}</td>)})}</tr>)}</tbody></table></div></div></div>}
        
        {/* Confirmation Modal - HIGH Z-INDEX (z-[70]) */}
        {confirmation.isOpen && <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70]"><div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full border-l-4 border-l-yellow-500 shadow-2xl"><h3 className="text-white font-bold text-lg mb-2">{confirmation.title}</h3><p className="text-slate-400 text-sm mb-4">{confirmation.message}</p><div className="flex justify-end gap-2"><button onClick={()=>setConfirmation({...confirmation,isOpen:false})} className="text-slate-300 px-3 py-1">Cancel</button><button onClick={handleConfirmAction} className="bg-yellow-600 text-white px-3 py-1 rounded">Confirm</button></div></div></div>}
      </div>
    </div>
  );
}