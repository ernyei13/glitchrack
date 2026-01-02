import React from 'react';
import { FilterState, AudioReactiveConfig, TimelineKeyframe } from '../types';
import { Sliders, Activity, Zap, Droplet, Sparkles, Layers, Music, Upload, Eye, Tornado, Clock } from 'lucide-react';
import { Timeline } from './Timeline';

interface ControlsProps {
  filters: FilterState;
  onChange: (key: keyof FilterState, value: number) => void;
  onGenerateAI: (prompt: string) => void;
  isGenerating: boolean;
  
  // Audio
  audioConfig: AudioReactiveConfig;
  onAudioChange: (newState: Partial<AudioReactiveConfig>) => void;
  
  // Timeline
  duration: number;
  currentTime: number;
  keyframes: TimelineKeyframe[];
  onSeek: (time: number) => void;
  onAddKeyframe: () => void;
  onRemoveKeyframe: (id: string) => void;
  onSelectKeyframe: (time: number) => void;
}

const ControlGroup: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="mb-6 border-l-2 border-cyber-dim pl-4">
    <div className="flex items-center gap-2 mb-3 text-cyber-accent uppercase text-xs font-bold tracking-widest">
      {icon}
      {title}
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

const Slider: React.FC<{ 
  label: string; 
  value: number; 
  min: number; 
  max: number; 
  step?: number;
  onChange: (val: number) => void 
}> = ({ label, value, min, max, step = 1, onChange }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-xs text-gray-400">
      <span>{label}</span>
      <span className="font-mono text-cyber-accent">{value.toFixed(step < 1 ? 2 : 0)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full"
    />
  </div>
);

export const Controls: React.FC<ControlsProps> = ({ 
  filters, 
  onChange, 
  onGenerateAI, 
  isGenerating,
  audioConfig,
  onAudioChange,
  duration,
  currentTime,
  keyframes,
  onSeek,
  onAddKeyframe,
  onRemoveKeyframe,
  onSelectKeyframe
}) => {
  const [prompt, setPrompt] = React.useState('');

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerateAI(prompt);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onAudioChange({ audioSrc: url, isEnabled: true });
    }
  };

  return (
    <div className="flex flex-col h-full w-full md:w-96 flex-shrink-0 border-l border-cyber-dim bg-cyber-panel">
      
      {/* Scrollable Controls Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-2xl font-bold mb-6 text-white tracking-tighter flex items-center gap-2">
          <Sliders className="text-cyber-accent" />
          PARAMETERS
        </h2>

        {/* AI Generator */}
        <div className="mb-8 bg-gray-900 p-4 rounded border border-cyber-dim">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" /> AI PRESET GEN
          </h3>
          <form onSubmit={handleAiSubmit} className="flex flex-col gap-2">
            <input 
              type="text" 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. 'Broken VHS tape'"
              className="bg-black border border-gray-700 text-xs p-2 text-white focus:border-cyber-accent outline-none"
            />
            <button 
              type="submit" 
              disabled={isGenerating || !prompt}
              className={`text-xs font-bold py-2 px-4 uppercase tracking-wider transition-colors 
                ${isGenerating ? 'bg-gray-700 text-gray-500' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
            >
              {isGenerating ? 'Dreaming...' : 'Generate Settings'}
            </button>
          </form>
        </div>

        {/* Audio Reactivity */}
        <div className="mb-8 bg-gray-900 p-4 rounded border border-cyber-dim border-l-4 border-l-green-500">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Music size={14} className="text-green-400" /> AUDIO REACTIVITY
          </h3>
          <div className="flex flex-col gap-3">
             <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 text-white py-2 px-3 rounded flex items-center justify-center gap-2 text-xs font-bold border border-gray-600 transition-colors">
                <Upload size={14} />
                {audioConfig.audioSrc ? "CHANGE AUDIO TRACK" : "UPLOAD AUDIO"}
                <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
             </label>
             
             {audioConfig.audioSrc && (
               <div className="text-[10px] text-green-400 font-mono truncate">
                  Track loaded. Video audio muted.
               </div>
             )}

             <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="audioEnabled"
                  checked={audioConfig.isEnabled}
                  onChange={(e) => onAudioChange({ isEnabled: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-500 text-cyber-accent focus:ring-0"
                />
                <label htmlFor="audioEnabled" className="text-xs text-gray-300 font-bold select-none">
                  ENABLE REACTIVITY
                </label>
             </div>
             
             {audioConfig.isEnabled && (
               <Slider 
                  label="Beat Sensitivity" 
                  value={audioConfig.sensitivity} 
                  min={0} 
                  max={5} 
                  step={0.1} 
                  onChange={(v) => onAudioChange({ sensitivity: v })} 
               />
             )}
          </div>
        </div>
        
        <ControlGroup title="Time Warp (Hyperspective)" icon={<Clock size={16} />}>
          <Slider label="Slit Scan (Time Stretch)" value={filters.slitScan} min={0} max={1} step={0.01} onChange={(v) => onChange('slitScan', v)} />
          <Slider label="RGB Delay (Ghost)" value={filters.rgbDelay} min={0} max={1} step={0.01} onChange={(v) => onChange('rgbDelay', v)} />
        </ControlGroup>

        <ControlGroup title="Mind Bending" icon={<Tornado size={16} />}>
          <Slider label="Feedback Zoom (Tunnel)" value={filters.feedbackZoom} min={-0.5} max={0.5} step={0.01} onChange={(v) => onChange('feedbackZoom', v)} />
          <Slider label="Jitter (Shake)" value={filters.jitter} min={0} max={10} step={0.1} onChange={(v) => onChange('jitter', v)} />
          <Slider label="Shatter (Glass)" value={filters.shatter} min={0} max={1} step={0.01} onChange={(v) => onChange('shatter', v)} />
        </ControlGroup>

        <ControlGroup title="Reality Distortion" icon={<Eye size={16} />}>
          <Slider label="Wobble (Distort)" value={filters.wobble} min={0} max={10} step={0.1} onChange={(v) => onChange('wobble', v)} />
          <Slider label="Melt (Drip)" value={filters.melt} min={0} max={10} step={0.1} onChange={(v) => onChange('melt', v)} />
          <Slider label="Ghost (Trails)" value={filters.ghost} min={0} max={0.99} step={0.01} onChange={(v) => onChange('ghost', v)} />
          <Slider label="Color Cycle Speed" value={filters.colorCycle} min={0} max={20} step={0.1} onChange={(v) => onChange('colorCycle', v)} />
        </ControlGroup>

        <ControlGroup title="Geometry & Fractal" icon={<Layers size={16} />}>
          <Slider label="Tile Count" value={filters.tileCount} min={1} max={20} step={0.1} onChange={(v) => onChange('tileCount', v)} />
          <Slider label="Fractal Mirror" value={filters.mirror} min={0} max={2} step={1} onChange={(v) => onChange('mirror', v)} />
        </ControlGroup>

        <ControlGroup title="Pixel Sorting" icon={<Activity size={16} />}>
          <Slider label="Horizontal Power" value={filters.pixelSortX} min={0} max={200} onChange={(v) => onChange('pixelSortX', v)} />
          <Slider label="Vertical Power" value={filters.pixelSortY} min={0} max={200} onChange={(v) => onChange('pixelSortY', v)} />
          <Slider label="Luma Threshold" value={filters.threshold} min={0} max={1} step={0.01} onChange={(v) => onChange('threshold', v)} />
        </ControlGroup>

        <ControlGroup title="Glitch & Mosh" icon={<Zap size={16} />}>
          <Slider label="RGB Shift (Spatial)" value={filters.rgbShift} min={0} max={100} onChange={(v) => onChange('rgbShift', v)} />
          <Slider label="Noise" value={filters.noise} min={0} max={1} step={0.01} onChange={(v) => onChange('noise', v)} />
          <Slider label="Datamosh Prob." value={filters.datamosh} min={0} max={1} step={0.01} onChange={(v) => onChange('datamosh', v)} />
        </ControlGroup>

        <ControlGroup title="Color Grade" icon={<Droplet size={16} />}>
          <Slider label="Contrast" value={filters.contrast} min={0} max={500} onChange={(v) => onChange('contrast', v)} />
          <Slider label="Brightness" value={filters.brightness} min={0} max={500} onChange={(v) => onChange('brightness', v)} />
          <Slider label="Saturation" value={filters.saturation} min={0} max={500} onChange={(v) => onChange('saturation', v)} />
          <Slider label="Hue Rotate" value={filters.hue} min={0} max={360} onChange={(v) => onChange('hue', v)} />
        </ControlGroup>
      </div>

      {/* Fixed Timeline at Bottom of Sidebar */}
      <Timeline 
        duration={duration} 
        currentTime={currentTime}
        keyframes={keyframes}
        onSeek={onSeek}
        onAddKeyframe={onAddKeyframe}
        onRemoveKeyframe={onRemoveKeyframe}
        onSelectKeyframe={onSelectKeyframe}
      />
    </div>
  );
};
