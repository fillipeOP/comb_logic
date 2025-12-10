import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Node, Wire, GateType, GATE_CONFIG, Position } from '../types';
import { Trash2, Clock, Plus, Minus, RotateCcw, Move, Box, ArrowUp, ArrowDown, RotateCw } from 'lucide-react';

interface CanvasProps {
  nodes: Node[];
  wires: Wire[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setWires: React.Dispatch<React.SetStateAction<Wire[]>>;
  activeTool: GateType | 'CURSOR' | null;
  setActiveTool: (t: GateType | 'CURSOR' | null) => void;
  addToHistory: (n: Node[], w: Wire[]) => void;
  isSimulationMode?: boolean;
  toggleNodeValue?: (id: string) => void;
}

const GRID_SIZE = 20;

export const Canvas: React.FC<CanvasProps> = ({ 
  nodes, wires, setNodes, setWires, activeTool, setActiveTool, addToHistory,
  isSimulationMode = false, toggleNodeValue
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [offset, setOffset] = useState<Position>({ x: 0, y: 0 });
  const [wiringStart, setWiringStart] = useState<{ nodeId: string, pinIdx: number, isInput: boolean } | null>(null);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const [hoveredPin, setHoveredPin] = useState<{nodeId: string, pinIdx: number, isInput: boolean} | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const lastPanRef = useRef({ x: 0, y: 0 });

  const getMousePosition = (evt: React.MouseEvent | MouseEvent | React.WheelEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    const screenX = (evt.clientX - CTM.e) / CTM.a;
    const screenY = (evt.clientY - CTM.f) / CTM.d;
    return { x: (screenX - pan.x) / zoom, y: (screenY - pan.y) / zoom };
  };

  const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  const deleteNode = useCallback((id: string) => {
    if (isSimulationMode) return;
    const newNodes = nodes.filter(n => n.id !== id);
    const newWires = wires.filter(w => w.sourceNodeId !== id && w.targetNodeId !== id);
    setNodes(newNodes); setWires(newWires);
    if (selectedNodeId === id) setSelectedNodeId(null);
    addToHistory(newNodes, newWires);
  }, [nodes, wires, selectedNodeId, setNodes, setWires, addToHistory, isSimulationMode]);

  const deleteWire = useCallback((id: string) => {
    if (isSimulationMode) return;
    const newWires = wires.filter(w => w.id !== id);
    setWires(newWires);
    if (selectedWireId === id) setSelectedWireId(null);
    addToHistory(nodes, newWires);
  }, [wires, nodes, selectedWireId, setWires, addToHistory, isSimulationMode]);

  const rotateNode = useCallback((id: string) => {
      if (isSimulationMode) return;
      setNodes(prev => {
          const newNodes = prev.map(n => {
              if (n.id === id) {
                  return { ...n, rotation: ((n.rotation || 0) + 90) % 360 };
              }
              return n;
          });
          addToHistory(newNodes, wires);
          return newNodes;
      });
  }, [isSimulationMode, wires, addToHistory, setNodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
      if ((e.key === 'Delete' || e.key === 'Backspace')) { 
          if (selectedNodeId) { deleteNode(selectedNodeId); e.preventDefault(); } 
          else if (selectedWireId) { deleteWire(selectedWireId); e.preventDefault(); } 
      }
      if (e.key === 'r' || e.key === 'R') {
          if (selectedNodeId) { rotateNode(selectedNodeId); e.preventDefault(); }
      }
      if (e.key === 'Escape') { setWiringStart(null); setActiveTool('CURSOR'); setSelectedNodeId(null); setSelectedWireId(null); setIsPanning(false); }
      if (e.code === 'Space' && !e.repeat) setIsSpacePressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpacePressed(false); };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [selectedNodeId, selectedWireId, deleteNode, deleteWire, rotateNode, setActiveTool]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) e.preventDefault(); 
    const zoomSensitivity = 0.001; const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.min(Math.max(0.2, zoom * (1 + delta)), 5);
    const mouseWorld = getMousePosition(e);
    if (!svgRef.current) return;
    const CTM = svgRef.current.getScreenCTM(); if (!CTM) return;
    const screenX = (e.clientX - CTM.e) / CTM.a; const screenY = (e.clientY - CTM.f) / CTM.d;
    const newPanX = screenX - mouseWorld.x * newZoom; const newPanY = screenY - mouseWorld.y * newZoom;
    setZoom(newZoom); setPan({ x: newPanX, y: newPanY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (isSpacePressed && e.button === 0)) { setIsPanning(true); lastPanRef.current = { x: e.clientX, y: e.clientY }; return; }
    if (isSimulationMode) return; 
    const pos = getMousePosition(e);
    if (e.target === svgRef.current) { setSelectedNodeId(null); setSelectedWireId(null); if (wiringStart) setWiringStart(null); }
    if (activeTool && activeTool !== 'CURSOR') {
      const newNode: Node = {
        id: `gate_${Date.now()}`, type: activeTool, position: { x: snapToGrid(pos.x), y: snapToGrid(pos.y) },
        label: activeTool === GateType.INPUT ? `I${nodes.filter(n => n.type === GateType.INPUT).length}` : 
               activeTool === GateType.OUTPUT ? `Q${nodes.filter(n => n.type === GateType.OUTPUT).length}` : 
               activeTool === GateType.CLOCK ? `CLK` : '',
        rotation: 0,
        inputs: [], outputs: [], internalState: {}
      };
      const newNodes = [...nodes, newNode];
      setNodes(newNodes); addToHistory(newNodes, wires); setActiveTool('CURSOR');
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    if (isSimulationMode) { if (node.type === GateType.INPUT && toggleNodeValue) toggleNodeValue(node.id); return; }
    if (activeTool === 'CURSOR') {
        const pos = getMousePosition(e);
        setOffset({ x: pos.x - node.position.x, y: pos.y - node.position.y });
        setDraggingNode(node.id); setSelectedNodeId(node.id); setSelectedWireId(null); 
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) { const dx = e.clientX - lastPanRef.current.x; const dy = e.clientY - lastPanRef.current.y; setPan(prev => ({ x: prev.x + dx, y: prev.y + dy })); lastPanRef.current = { x: e.clientX, y: e.clientY }; return; }
    const pos = getMousePosition(e); setMousePos(pos);
    if (draggingNode && !isSimulationMode) { setNodes(prev => prev.map(n => { if (n.id === draggingNode) { return { ...n, position: { x: snapToGrid(pos.x - offset.x), y: snapToGrid(pos.y - offset.y) } }; } return n; })); }
  };

  const handleMouseUp = () => { if (isPanning) { setIsPanning(false); return; } if (draggingNode && !isSimulationMode) addToHistory(nodes, wires); setDraggingNode(null); };
  const handlePinMouseDown = (e: React.MouseEvent, nodeId: string, pinIdx: number, isInput: boolean) => { e.stopPropagation(); e.preventDefault(); if (activeTool !== 'CURSOR' || isSimulationMode) return; if (!wiringStart) setWiringStart({ nodeId, pinIdx, isInput }); };
  const handlePinMouseUp = (e: React.MouseEvent, nodeId: string, pinIdx: number, isInput: boolean) => { e.stopPropagation(); e.preventDefault(); if (activeTool !== 'CURSOR' || isSimulationMode) return; if (wiringStart) { const isSamePin = wiringStart.nodeId === nodeId && wiringStart.pinIdx === pinIdx && wiringStart.isInput === isInput; if (isSamePin) return; if (wiringStart.isInput === isInput) { setWiringStart(null); return; } let sourceNodeId, sourcePinIdx, targetNodeId, targetPinIdx; if (wiringStart.isInput) { sourceNodeId = nodeId; sourcePinIdx = pinIdx; targetNodeId = wiringStart.nodeId; targetPinIdx = wiringStart.pinIdx; } else { sourceNodeId = wiringStart.nodeId; sourcePinIdx = wiringStart.pinIdx; targetNodeId = nodeId; targetPinIdx = pinIdx; } const existing = wires.find(w => w.targetNodeId === targetNodeId && w.targetPinIdx === targetPinIdx); if (!existing) { const newWire: Wire = { id: `wire_${Date.now()}`, sourceNodeId, sourcePinIdx, targetNodeId, targetPinIdx }; const newWires = [...wires, newWire]; setWires(newWires); addToHistory(nodes, newWires); } setWiringStart(null); } };

  // Helper to calculate rotated offset
  const getRotatedOffset = (x: number, y: number, cx: number, cy: number, angle: number) => {
      const rad = (angle * Math.PI) / 180;
      const dx = x - cx;
      const dy = y - cy;
      return {
          x: cx + (dx * Math.cos(rad) - dy * Math.sin(rad)),
          y: cy + (dx * Math.sin(rad) + dy * Math.cos(rad))
      };
  };

  const getPinPos = (node: Node, index: number, isInput: boolean) => {
    let config = GATE_CONFIG[node.type];
    if (node.type === GateType.CUSTOM_BLOCK && node.customBlockDefinition) {
        const h = Math.max(node.customBlockDefinition.inputCount, node.customBlockDefinition.outputCount) * 20 + 40;
        config = { ...config, width: 100, height: h, inputs: node.customBlockDefinition.inputCount, outputs: node.customBlockDefinition.outputCount };
    }

    const width = config.width || (config.outputs > 0 ? 60 : 50); // Fallback for path-based gates
    const height = config.height || 60;
    const cx = width / 2;
    const cy = height / 2; // Center relative to node group

    let localX = 0;
    let localY = 0;

    if (config.shape === 'rect') {
        if (isInput) {
            const step = height / (config.inputs + 1);
            localX = 0;
            localY = (index + 1) * step;
        } else {
            if (node.type === GateType.CUSTOM_BLOCK) {
                const step = height / (config.outputs + 1);
                localX = width;
                localY = (index + 1) * step;
            } else {
                localX = width;
                localY = height / 2;
            }
        }
    } else {
        // Path based gates (standard)
        if (isInput) {
            const step = 40 / (config.inputs + 1);
            localX = 0;
            localY = (index + 1) * step + 10;
        } else {
            const xOffset = node.type === GateType.NOT ? 46 : 56;
            localX = xOffset;
            localY = 30;
        }
    }

    // Apply rotation relative to center of the component
    const rot = node.rotation || 0;
    const rotated = getRotatedOffset(localX, localY, cx, cy, rot);

    return {
        x: node.position.x + rotated.x,
        y: node.position.y + rotated.y
    };
  };

  const updateLabel = (id: string, newLabel: string) => { setNodes(prev => prev.map(n => n.id === id ? {...n, label: newLabel} : n)); }
  const renderHexDisplay = (node: Node, config: any) => {
      const val = node.internalState?.displayValue ?? 0;
      const hexMap = [[1,1,1,1,1,1,0], [0,1,1,0,0,0,0], [1,1,0,1,1,0,1], [1,1,1,1,0,0,1], [0,1,1,0,0,1,1], [1,0,1,1,0,1,1], [1,0,1,1,1,1,1], [1,1,1,0,0,0,0], [1,1,1,1,1,1,1], [1,1,1,1,0,1,1], [1,1,1,0,1,1,1], [0,0,1,1,1,1,1], [1,0,0,1,1,1,0], [0,1,1,1,1,0,1], [1,0,0,1,1,1,1], [1,0,0,0,1,1,1]];
      const active = hexMap[val] || hexMap[0];
      const segColor = isSimulationMode ? '#ef4444' : '#374151'; const offColor = '#1f2937';
      return ( <g transform="translate(0, 0)"> 
        <path d="M 15 15 L 45 15" stroke={active[0] ? segColor : offColor} strokeWidth="4" strokeLinecap="round" className={active[0] && isSimulationMode ? "filter drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" : ""}/>
        <path d="M 45 15 L 45 45" stroke={active[1] ? segColor : offColor} strokeWidth="4" strokeLinecap="round" className={active[1] && isSimulationMode ? "filter drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" : ""}/>
        <path d="M 45 45 L 45 75" stroke={active[2] ? segColor : offColor} strokeWidth="4" strokeLinecap="round" className={active[2] && isSimulationMode ? "filter drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" : ""}/>
        <path d="M 15 75 L 45 75" stroke={active[3] ? segColor : offColor} strokeWidth="4" strokeLinecap="round" className={active[3] && isSimulationMode ? "filter drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" : ""}/>
        <path d="M 15 45 L 15 75" stroke={active[4] ? segColor : offColor} strokeWidth="4" strokeLinecap="round" className={active[4] && isSimulationMode ? "filter drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" : ""}/>
        <path d="M 15 15 L 15 45" stroke={active[5] ? segColor : offColor} strokeWidth="4" strokeLinecap="round" className={active[5] && isSimulationMode ? "filter drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" : ""}/>
        <path d="M 15 45 L 45 45" stroke={active[6] ? segColor : offColor} strokeWidth="4" strokeLinecap="round" className={active[6] && isSimulationMode ? "filter drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" : ""}/>
      </g> );
  };
  const zoomIn = () => setZoom(z => Math.min(z * 1.2, 5));
  const zoomOut = () => setZoom(z => Math.max(z / 1.2, 0.2));
  const resetView = () => { setZoom(1); setPan({x:0, y:0}); };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900">
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
            {selectedNodeId && !isSimulationMode && (
                <button onClick={() => rotateNode(selectedNodeId)} className="p-2 bg-slate-800 rounded-full border border-slate-700 text-purple-400 hover:bg-slate-700 hover:text-purple-300 shadow-lg transition-colors" title="Rotate (R)">
                    <RotateCw size={20} />
                </button>
            )}
            <button onClick={zoomIn} className="p-2 bg-slate-800 rounded-full border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white shadow-lg transition-colors"><Plus size={20} /></button>
            <button onClick={resetView} className="p-2 bg-slate-800 rounded-full border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white shadow-lg transition-colors"><RotateCcw size={20} /></button>
            <button onClick={zoomOut} className="p-2 bg-slate-800 rounded-full border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white shadow-lg transition-colors"><Minus size={20} /></button>
        </div>
        {isPanning && (<div className="absolute inset-0 z-50 cursor-grabbing flex items-center justify-center pointer-events-none"><Move size={48} className="text-white/20" /></div>)}

        <svg ref={svgRef} className={`w-full h-full touch-none outline-none ${isPanning || isSpacePressed ? 'cursor-grab active:cursor-grabbing' : (isSimulationMode ? 'cursor-default' : 'cursor-crosshair')}`} tabIndex={0} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel} onContextMenu={(e) => e.preventDefault()}>
        <defs>
            <pattern id="grid" width={GRID_SIZE * zoom} height={GRID_SIZE * zoom} patternUnits="userSpaceOnUse" patternTransform={`translate(${pan.x}, ${pan.y})`}><path d={`M ${GRID_SIZE * zoom} 0 L 0 0 0 ${GRID_SIZE * zoom}`} fill="none" stroke="#1e293b" strokeWidth={1} /></pattern>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" /></marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {wires.map(wire => {
                const source = nodes.find(n => n.id === wire.sourceNodeId);
                const target = nodes.find(n => n.id === wire.targetNodeId);
                if (!source || !target) return null;
                const p1 = getPinPos(source, wire.sourcePinIdx, false);
                const p2 = getPinPos(target, wire.targetPinIdx, true);
                const midX = (p1.x + p2.x) / 2;
                const path = `M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;
                const isSelected = selectedWireId === wire.id;
                const strokeColor = isSelected ? '#f97316' : (wire.value ? (isSimulationMode ? '#22c55e' : '#4ade80') : '#475569');
                const strokeWidth = isSelected ? "4" : (isSimulationMode && wire.value ? "4" : "3");
                return ( <g key={wire.id} className="group"><path d={path} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" className="transition-all duration-100"/>{!isSimulationMode && ( <path d={path} stroke="transparent" strokeWidth="12" fill="none" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedWireId(wire.id); setSelectedNodeId(null); }} onDoubleClick={(e) => { e.stopPropagation(); deleteWire(wire.id); }}><title>Click to select, Double click to delete</title></path> )}</g> );
            })}
            {wiringStart && !isSimulationMode && ( <path d={`M ${getPinPos(nodes.find(n=>n.id===wiringStart.nodeId)!, wiringStart.pinIdx, wiringStart.isInput).x} ${getPinPos(nodes.find(n=>n.id===wiringStart.nodeId)!, wiringStart.pinIdx, wiringStart.isInput).y} L ${mousePos.x} ${mousePos.y}`} stroke="#94a3b8" strokeWidth="2" strokeDasharray="5,5" fill="none" pointerEvents="none" markerEnd="url(#arrowhead)"/> )}
            {nodes.map(node => {
                let config = GATE_CONFIG[node.type];
                if (node.type === GateType.CUSTOM_BLOCK && node.customBlockDefinition) {
                    const h = Math.max(node.customBlockDefinition.inputCount, node.customBlockDefinition.outputCount) * 20 + 40;
                    config = { ...config, width: 100, height: h, inputs: node.customBlockDefinition.inputCount, outputs: node.customBlockDefinition.outputCount };
                }
                const isSelected = selectedNodeId === node.id;
                const isDragging = draggingNode === node.id;
                const simColor = isSimulationMode && node.value ? '#ecfccb' : (node.value ? '#e0f2fe' : config.color);
                const simStroke = isSimulationMode && node.value ? '#84cc16' : (node.value ? config.color : 'none');
                const isRect = config.shape === 'rect';
                const isHex = node.type === GateType.HEX_DISPLAY;
                
                // Rotation center for SVG Transform (Center of bounding box)
                const w = config.width || (config.outputs > 0 ? 60 : 50);
                const h = config.height || 60;
                const rot = node.rotation || 0;

                return (
                <g key={node.id} transform={`translate(${node.position.x}, ${node.position.y}) rotate(${rot}, ${w/2}, ${h/2})`} className={`${isDragging ? 'opacity-80' : 'opacity-100'} select-none ${isSimulationMode && node.type === GateType.INPUT ? 'cursor-pointer' : ''}`} onMouseDown={(e) => handleNodeMouseDown(e, node)}>
                    {isSelected && !isSimulationMode && ( <rect x="-5" y="-5" width={isRect ? (config.width! + 10) : 70} height={isRect ? (config.height! + 10) : 70} fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,2" rx="4" className="animate-pulse"/> )}
                    {isRect ? (
                        <g>
                            <rect width={config.width} height={config.height} rx="4" fill={isHex ? '#000000' : simColor} stroke={isHex ? '#374151' : simStroke} strokeWidth={isSimulationMode && node.value ? "3" : "2"} className="filter drop-shadow-lg transition-colors duration-200"/>
                            {isHex && renderHexDisplay(node, config)}
                            {node.type === GateType.CUSTOM_BLOCK ? (
                                <g>
                                    <text x={config.width!/2} y={15} textAnchor="middle" fontSize="10" className="fill-purple-200 font-bold pointer-events-none truncate px-1" style={{maxWidth: config.width! - 10}}>{node.label || node.customBlockDefinition?.name}</text>
                                    {Array.from({length: config.inputs}).map((_, i) => ( <text key={`il-${i}`} x="6" y={(i + 1) * (config.height! / (config.inputs + 1)) + 4} fontSize="8" className="fill-purple-300 pointer-events-none">I{i}</text> ))}
                                    {Array.from({length: config.outputs}).map((_, i) => ( <text key={`ol-${i}`} x={config.width! - 12} y={(i + 1) * (config.height! / (config.outputs + 1)) + 4} fontSize="8" className="fill-purple-300 pointer-events-none">O{i}</text> ))}
                                    <Box x={config.width!/2 - 12} y={config.height!/2 - 12} size={24} className="text-purple-400 opacity-20 pointer-events-none" />
                                </g>
                            ) : (
                                <g>
                                    {config.pinLabels?.map((label, i) => { const step = config.height! / (config.inputs + 1); return ( <text key={i} x="6" y={(i + 1) * step + 4} fontSize="10" className={`font-bold pointer-events-none ${isHex ? 'fill-slate-500' : 'fill-slate-700'}`}>{label}</text> ); })}
                                    {node.type !== GateType.CLOCK && !isHex && !([GateType.PULL_UP, GateType.PULL_DOWN].includes(node.type)) && ( <text x={config.width! - 15} y={config.height! / 2 + 4} fontSize="10" className="fill-slate-700 font-bold pointer-events-none">Q</text> )}
                                    {!isHex && ( <text x={config.width!/2} y={15} textAnchor="middle" fontSize="9" className="fill-slate-500 font-bold pointer-events-none opacity-50">{node.type.replace('_', ' ')}</text> )}
                                    {node.type === GateType.CLOCK && ( <foreignObject x="8" y="8" width="24" height="24" className="pointer-events-none"><Clock size={24} className={node.value ? "text-emerald-600 animate-spin" : "text-slate-500"} /></foreignObject> )}
                                    {node.type === GateType.PULL_UP && ( <g transform="translate(7, 10)"><ArrowUp size={16} className="text-white" /></g> )}
                                    {node.type === GateType.PULL_DOWN && ( <g transform="translate(7, 10)"><ArrowDown size={16} className="text-white" /></g> )}
                                </g>
                            )}
                        </g>
                    ) : ( <path d={config.path} fill={simColor} stroke={simStroke} strokeWidth={isSimulationMode && node.value ? "3" : "2"} className="filter drop-shadow-lg transition-colors duration-200"/> )}
                    {(node.type === GateType.INPUT || node.type === GateType.OUTPUT) && ( <foreignObject x="15" y="20" width="20" height="20" className="pointer-events-none"><div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-900">{node.label}</div></foreignObject> )}
                    {(node.type === GateType.INPUT || node.type === GateType.OUTPUT) && !isSimulationMode && ( <foreignObject x="15" y="20" width="20" height="20" className="opacity-0 hover:opacity-100"><input className="w-full h-full bg-white/50 text-center text-xs font-bold text-slate-900 outline-none" value={node.label} onChange={(e) => updateLabel(node.id, e.target.value)} onMouseDown={(e) => e.stopPropagation()} /></foreignObject> )}
                    {isSimulationMode && !isHex && node.type !== GateType.CUSTOM_BLOCK && ( <g transform={`translate(${isRect ? config.width! + 5 : (node.type === GateType.NOT ? 55 : 65)}, ${isRect ? config.height!/2 - 8 : 22})`}><rect width="16" height="16" rx="4" fill={node.value ? '#22c55e' : '#334155'} stroke={node.value ? '#15803d' : '#475569'} strokeWidth="1"/><text x="8" y="12" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" pointerEvents="none">{node.value ? '1' : '0'}</text></g> )}
                    {!isSimulationMode && ( <g className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer" onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}><circle cx={isRect ? config.width! - 5 : 30} cy={-10} r="8" fill="#ef4444" /><Trash2 size={10} x={isRect ? config.width! - 10 : 25} y={-15} stroke="white" /></g> )}
                    {Array.from({ length: config.inputs }).map((_, i) => {
                        let px = 0, py = 0;
                        if (isRect) { const step = config.height! / (config.inputs + 1); px = 0; py = (i + 1) * step; } else { const step = 40 / (config.inputs + 1); px = 0; py = (i + 1) * step + 10; }
                        const isValidTarget = wiringStart && !wiringStart.isInput; const isHovered = hoveredPin?.nodeId === node.id && hoveredPin?.pinIdx === i && hoveredPin?.isInput === true;
                        return ( <g key={`in-${i}`} onMouseEnter={() => !isSimulationMode && setHoveredPin({nodeId: node.id, pinIdx: i, isInput: true})} onMouseLeave={() => !isSimulationMode && setHoveredPin(null)} onMouseDown={(e) => handlePinMouseDown(e, node.id, i, true)} onMouseUp={(e) => handlePinMouseUp(e, node.id, i, true)}><circle cx={px} cy={py} r="12" fill="transparent" className={isSimulationMode ? '' : "cursor-pointer"} /><circle cx={px} cy={py} r="5" fill={isValidTarget && isHovered ? "#4ade80" : "#cbd5e1"} stroke={isValidTarget && isHovered ? "#166534" : "none"} strokeWidth="2" className={isSimulationMode ? '' : "cursor-pointer"}/></g> );
                    })}
                    {Array.from({length: config.outputs}).map((_, i) => {
                        let cx = 0, cy = 0;
                        if (isRect) { cx = config.width!; if (node.type === GateType.CUSTOM_BLOCK) { const step = config.height! / (config.outputs + 1); cy = (i + 1) * step; } else { cy = config.height! / 2; } } else { cx = node.type === GateType.NOT ? 46 : 56; cy = 30; }
                        const isValidTarget = wiringStart && wiringStart.isInput; const isHovered = hoveredPin?.nodeId === node.id && hoveredPin?.pinIdx === i && hoveredPin?.isInput === false;
                        return ( <g key={`out-${i}`} onMouseEnter={() => !isSimulationMode && setHoveredPin({nodeId: node.id, pinIdx: i, isInput: false})} onMouseLeave={() => !isSimulationMode && setHoveredPin(null)} onMouseDown={(e) => handlePinMouseDown(e, node.id, i, false)} onMouseUp={(e) => handlePinMouseUp(e, node.id, i, false)}><circle cx={cx} cy={cy} r="12" fill="transparent" className={isSimulationMode ? '' : "cursor-pointer"} /><circle cx={cx} cy={cy} r="5" fill={isValidTarget && isHovered ? "#4ade80" : "#cbd5e1"} stroke={isValidTarget && isHovered ? "#166534" : "none"} strokeWidth="2" className={isSimulationMode ? '' : "cursor-pointer"}/></g> );
                    })}
                </g>
                );
            })}
        </g>
        </svg>
    </div>
  );
};