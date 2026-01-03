import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Play, Pause, Download, StopCircle, Video as VideoIcon } from 'lucide-react';
import { Rack } from './components/Rack';
import { EffectNode, VideoSource, ProcessingStatus, AudioReactiveConfig } from './types';
import { EFFECT_LIBRARY } from './utils/effectLibrary';
import { MidiService, ALL_CONTROLS, CONTROL_XL_MAP } from './services/midi';

// Helper to generate IDs
const uid = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  // --- STATE ---
  const [pipeline, setPipeline] = useState<EffectNode[]>([]);
  const [inputs, setInputs] = useState<VideoSource[]>([]);
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  
  // --- REFS ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const midiRef = useRef<MidiService | null>(null);
  
  // Live Refs for Render Loop
  const pipelineRef = useRef(pipeline);
  const inputsRef = useRef(inputs);
  const selectedRef = useRef(selectedEffectId);

  // Sync Refs
  useEffect(() => { pipelineRef.current = pipeline; }, [pipeline]);
  useEffect(() => { inputsRef.current = inputs; }, [inputs]);
  useEffect(() => { selectedRef.current = selectedEffectId; }, [selectedEffectId]);

  // --- MIDI INIT ---
  useEffect(() => {
      midiRef.current = new MidiService();
      const unsub = midiRef.current.onMessage((control, value, channel) => {
          handleMidiMessage(control, value);
      });
      return () => { unsub(); };
  }, []);

  const handleMidiMessage = (control: number, value: number) => {
      const pipe = pipelineRef.current;

      // --- STRATEGY 0: BUTTONS = TOGGLE ENABLE/DISABLE ---
      if (CONTROL_XL_MAP.BUTTONS_TRACK.includes(control)) {
          // Only toggle on press (value ~ 1.0), ignore release (value ~ 0)
          if (value > 0.5) {
              const btnIdx = CONTROL_XL_MAP.BUTTONS_TRACK.indexOf(control);
              setPipeline(prev => prev.map((node, i) => {
                  if (i === btnIdx) {
                      return { ...node, active: !node.active };
                  }
                  return node;
              }));
          }
          return;
      }

      // --- STRATEGY 1: FADERS = MIX / STRENGTH (Dry/Wet) ---
      // Map Fader 1 (Index 0) to Effect 1 Mix, Fader 2 to Effect 2 Mix, etc.
      if (CONTROL_XL_MAP.FADERS.includes(control)) {
          const faderIdx = CONTROL_XL_MAP.FADERS.indexOf(control);
          const targetNode = pipe[faderIdx];
          
          if (targetNode) {
              const def = EFFECT_LIBRARY.find(d => d.id === targetNode.definitionId);
              if (def) {
                  // Look for 'mix', 'opacity', or 'amount' (Standardized on 'mix' mostly now)
                  let mixParam = def.defaultParams.find(p => p.id === 'mix' || p.id === 'opacity' || p.id === 'amount');
                  
                  // If no standard mix param, default to the first parameter
                  if (!mixParam && def.defaultParams.length > 0) {
                      mixParam = def.defaultParams[0];
                  }

                  if (mixParam && mixParam.type === 'range') {
                      setPipeline(prev => prev.map(n => {
                          if (n.id === targetNode.id) {
                              const range = (mixParam!.max || 1) - (mixParam!.min || 0);
                              const newVal = (mixParam!.min || 0) + (value * range);
                              return { ...n, params: { ...n.params, [mixParam!.id]: newVal } };
                          }
                          return n;
                      }));
                      return; // Handled
                  }
              }
          }
      }

      // --- STRATEGY 2: KNOBS = LINEAR PARAMS ---
      // Map all other controls linearly to parameters.
      
      const controlIdx = ALL_CONTROLS.indexOf(control);
      if (controlIdx === -1) return; 

      let paramCounter = 0;
      let targetNodeId: string | null = null;
      let targetParamId: string | null = null;
      let targetParamDef: any = null;

      for (const node of pipe) {
          if (targetNodeId) break;
          const def = EFFECT_LIBRARY.find(d => d.id === node.definitionId);
          if (!def) continue;

          for (const param of def.defaultParams) {
              if (param.type === 'range') {
                  if (paramCounter === controlIdx) {
                      targetNodeId = node.id;
                      targetParamId = param.id;
                      targetParamDef = param;
                      break;
                  }
                  paramCounter++;
              }
          }
      }

      if (targetNodeId && targetParamId && targetParamDef) {
           setPipeline(prev => {
               return prev.map(n => {
                   if (n.id === targetNodeId) {
                       const range = (targetParamDef.max || 100) - (targetParamDef.min || 0);
                       const newVal = (targetParamDef.min || 0) + (value * range);
                       return { ...n, params: { ...n.params, [targetParamId!]: newVal } };
                   }
                   return n;
               });
           });
      }
  };

  // --- ACTIONS ---
  const handleAddEffect = (defId: string) => {
      const def = EFFECT_LIBRARY.find(d => d.id === defId);
      if (!def) return;
      
      const newNode: EffectNode = {
          id: uid(),
          definitionId: defId,
          active: true,
          params: def.defaultParams.reduce((acc, p) => ({ ...acc, [p.id]: p.value }), {})
      };
      
      setPipeline(prev => [...prev, newNode]);
      setSelectedEffectId(newNode.id);
  };

  const handleRemoveEffect = (id: string) => {
      setPipeline(prev => prev.filter(n => n.id !== id));
      if (selectedEffectId === id) setSelectedEffectId(null);
  };

  const handleMoveEffect = (id: string, dir: number) => {
      setPipeline(prev => {
          const idx = prev.findIndex(n => n.id === id);
          if (idx === -1) return prev;
          const newIdx = idx + dir;
          if (newIdx < 0 || newIdx >= prev.length) return prev;
          
          const copy = [...prev];
          [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
          return copy;
      });
  };

  const handleUpdateParam = (nodeId: string, paramId: string, val: any) => {
      setPipeline(prev => prev.map(node => 
          node.id === nodeId ? { ...node, params: { ...node.params, [paramId]: val } } : node
      ));
  };
  
  const handleAddInput = (file: File) => {
      const url = URL.createObjectURL(file);
      const vid = document.createElement('video');
      vid.src = url;
      vid.loop = true;
      vid.muted = true;
      vid.crossOrigin = "anonymous";
      vid.play();
      
      const newSource: VideoSource = {
          id: uid(),
          url,
          element: vid,
          active: inputs.length === 0 // Active by default if first
      };
      setInputs(prev => [...prev, newSource]);
  };
  
  const handleAddCameraInput = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      const vid = document.createElement('video');
      vid.srcObject = stream;
      vid.autoplay = true;
      vid.muted = true;
      vid.play();

      const newSource: VideoSource = {
        id: uid(),
        url: 'Live Camera',
        element: vid,
        active: inputs.length === 0
      };
      setInputs(prev => [...prev, newSource]);
    } catch (e) {
      console.error("Camera access denied", e);
      alert("Could not access camera. Please allow permissions.");
    }
  };
  
  const handleToggleInput = (id: string) => {
      setInputs(prev => prev.map(inp => 
          inp.id === id ? { ...inp, active: !inp.active } : inp
      ));
  };

  // --- RENDER LOOP ---
  const renderFrame = useCallback((time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const currentInputs = inputsRef.current;
      const pipe = pipelineRef.current;

      const activeInputs = currentInputs.filter(i => i.active);
      const mainSource = activeInputs[0];
      const auxSources = activeInputs.slice(1).map(i => i.element);

      // Resize canvas to match main source
      if (mainSource && mainSource.element.videoWidth) {
          if (canvas.width !== mainSource.element.videoWidth || canvas.height !== mainSource.element.videoHeight) {
              canvas.width = mainSource.element.videoWidth;
              canvas.height = mainSource.element.videoHeight;
          }
      }

      if (mainSource) {
          ctx.drawImage(mainSource.element, 0, 0, canvas.width, canvas.height);
          
          pipe.forEach(node => {
              if (!node.active) return;
              const def = EFFECT_LIBRARY.find(d => d.id === node.definitionId);
              if (def) {
                  def.process(
                      ctx, 
                      canvas, 
                      canvas.width, 
                      canvas.height, 
                      node.params, 
                      time / 1000,
                      auxSources
                  );
              }
          });
      }

      animationFrameRef.current = requestAnimationFrame(renderFrame);
  }, []);

  useEffect(() => {
      animationFrameRef.current = requestAnimationFrame(renderFrame);
      return () => cancelAnimationFrame(animationFrameRef.current);
  }, [renderFrame]);

  return (
    <div className="flex h-screen bg-cyber-dark text-white overflow-hidden font-mono">
      {/* LEFT: MAIN CANVAS VIEW */}
      <div className="flex-1 flex flex-col relative bg-black">
        <header className="h-12 border-b border-cyber-dim flex items-center px-4 bg-cyber-dark z-10">
          <div className="flex items-center gap-2">
            <VideoIcon className="text-cyber-accent" />
            <h1 className="text-lg font-bold tracking-widest">GLITCH<span className="text-cyber-accent">RACK</span></h1>
          </div>
        </header>
        
        <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
            <canvas ref={canvasRef} className="max-w-full max-h-full border border-cyber-dim shadow-2xl" />
            
            {inputs.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 pointer-events-none">
                    <div className="text-xl font-bold mb-2">NO SIGNAL</div>
                    <div className="text-xs">Add a video source from the rack on the right</div>
                </div>
            )}
        </div>
      </div>

      {/* RIGHT: RACK */}
      <Rack 
        pipeline={pipeline}
        selectedEffectId={selectedEffectId}
        inputs={inputs}
        onAddEffect={handleAddEffect}
        onRemoveEffect={handleRemoveEffect}
        onMoveEffect={handleMoveEffect}
        onSelectEffect={setSelectedEffectId}
        onUpdateParam={handleUpdateParam}
        onToggleInput={handleToggleInput}
        onAddInput={handleAddInput}
        onAddCamera={handleAddCameraInput}
      />
    </div>
  );
};

export default App;