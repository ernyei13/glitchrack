import React from 'react';
import { EffectNode, EffectDefinition, VideoSource } from '../types';
import { EFFECT_LIBRARY } from '../utils/effectLibrary';
import { X, ArrowUp, ArrowDown, Sliders as SliderIcon, Plus, Video, GripVertical } from 'lucide-react';

interface RackProps {
  pipeline: EffectNode[];
  selectedEffectId: string | null;
  inputs: VideoSource[];
  onAddEffect: (defId: string) => void;
  onRemoveEffect: (id: string) => void;
  onMoveEffect: (id: string, direction: -1 | 1) => void;
  onSelectEffect: (id: string) => void;
  onUpdateParam: (nodeId: string, paramId: string, value: any) => void;
  onToggleInput: (id: string) => void;
  onAddInput: (file: File) => void;
}

export const Rack: React.FC<RackProps> = ({
  pipeline,
  selectedEffectId,
  inputs,
  onAddEffect,
  onRemoveEffect,
  onMoveEffect,
  onSelectEffect,
  onUpdateParam,
  onToggleInput,
  onAddInput
}) => {
  
  const selectedNode = pipeline.find(n => n.id === selectedEffectId);
  const selectedDef = selectedNode ? EFFECT_LIBRARY.find(d => d.id === selectedNode.definitionId) : null;

  return (
    <div className="flex h-full bg-cyber-panel border-l border-cyber-dim w-[450px] flex-col overflow-hidden">
      
      {/* TABS / HEADER */}
      <div className="flex bg-black border-b border-cyber-dim">
        <div className="px-4 py-3 text-sm font-bold text-cyber-accent border-r border-cyber-dim">EFFECT RACK</div>
        <div className="px-4 py-3 text-sm font-bold text-gray-500 hover:text-white cursor-pointer">LIBRARY</div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* INPUTS SECTION */}
        <div className="p-4 border-b border-cyber-dim bg-gray-900/50">
           <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-2"><Video size={12}/> VIDEO SOURCES</h3>
           <div className="space-y-2">
              {inputs.map((inp, idx) => (
                  <div key={inp.id} className={`flex items-center justify-between p-2 rounded text-xs border ${inp.active ? 'border-cyber-accent bg-cyber-accent/10' : 'border-gray-700 bg-black'}`}>
                      <div className="truncate flex-1" title={inp.url}>Source {idx + 1}</div>
                      <input 
                        type="checkbox" 
                        checked={inp.active} 
                        onChange={() => onToggleInput(inp.id)} 
                        className="accent-cyber-accent"
                      />
                  </div>
              ))}
              <label className="flex items-center justify-center p-2 border border-dashed border-gray-600 rounded text-xs text-gray-500 hover:text-white hover:border-white cursor-pointer transition-colors">
                  <Plus size={14} className="mr-1"/> Add Video File
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && onAddInput(e.target.files[0])} />
              </label>
           </div>
        </div>

        {/* PIPELINE LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-black/50">
            {pipeline.length === 0 && (
                <div className="text-center text-gray-600 text-xs py-8">
                    Drag effects here or click + from Library
                </div>
            )}
            
            {pipeline.map((node, index) => {
                const def = EFFECT_LIBRARY.find(d => d.id === node.definitionId);
                const isSelected = node.id === selectedEffectId;
                
                return (
                    <div 
                        key={node.id} 
                        onClick={() => onSelectEffect(node.id)}
                        className={`relative group border rounded p-2 transition-all cursor-pointer
                            ${isSelected ? 'border-cyber-accent bg-cyber-accent/5' : 'border-gray-800 bg-gray-900 hover:border-gray-600'}
                        `}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <div className="font-bold text-sm text-white flex items-center gap-2">
                                <span className="text-[10px] bg-gray-800 px-1 rounded text-gray-400">{index + 1}</span>
                                {def?.name}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); onMoveEffect(node.id, -1); }} className="p-1 hover:text-white text-gray-500"><ArrowUp size={12}/></button>
                                <button onClick={(e) => { e.stopPropagation(); onMoveEffect(node.id, 1); }} className="p-1 hover:text-white text-gray-500"><ArrowDown size={12}/></button>
                                <button onClick={(e) => { e.stopPropagation(); onRemoveEffect(node.id); }} className="p-1 hover:text-red-500 text-gray-500"><X size={12}/></button>
                            </div>
                        </div>
                        
                        {/* Inline Controls for Selected */}
                        {isSelected && def && (
                            <div className="mt-3 space-y-3 pl-2 border-l border-cyber-dim">
                                {def.defaultParams.map(param => (
                                    <div key={param.id} className="text-xs">
                                        <div className="flex justify-between text-gray-400 mb-1">
                                            <span>{param.label}</span>
                                            <span className="text-cyber-accent font-mono">
                                                {typeof node.params[param.id] === 'number' ? Number(node.params[param.id]).toFixed(2) : node.params[param.id]}
                                            </span>
                                        </div>
                                        {param.type === 'range' && (
                                            <input 
                                                type="range" 
                                                min={param.min} max={param.max} step={param.step}
                                                value={node.params[param.id]}
                                                onChange={(e) => onUpdateParam(node.id, param.id, parseFloat(e.target.value))}
                                                className="w-full h-1 bg-gray-700 appearance-none rounded"
                                            />
                                        )}
                                        {param.type === 'select' && (
                                            <select 
                                                value={node.params[param.id]}
                                                onChange={(e) => onUpdateParam(node.id, param.id, e.target.value)}
                                                className="w-full bg-black border border-gray-700 text-white p-1"
                                            >
                                                {param.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        )}
                                    </div>
                                ))}
                                <div className="text-[10px] text-green-500 mt-2 font-mono flex items-center gap-1">
                                    <SliderIcon size={10}/> MIDI FOCUS ACTIVE (TOP KNOBS)
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* LIBRARY (Mini) */}
        <div className="h-1/3 border-t border-cyber-dim flex flex-col bg-gray-900">
            <div className="p-2 text-xs font-bold text-gray-400 bg-black">AVAILABLE EFFECTS</div>
            <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2">
                {EFFECT_LIBRARY.map(def => (
                    <button 
                        key={def.id}
                        onClick={() => onAddEffect(def.id)}
                        className="text-left p-2 border border-gray-700 rounded hover:border-cyber-accent hover:bg-gray-800 transition-colors"
                    >
                        <div className="text-xs font-bold text-white">{def.name}</div>
                        <div className="text-[10px] text-gray-500">{def.category}</div>
                    </button>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};