import React, { useRef, useEffect } from 'react';
import { TimelineKeyframe } from '../types';
import { Plus, Trash2, Clock } from 'lucide-react';

interface TimelineProps {
  duration: number; // in seconds
  currentTime: number;
  keyframes: TimelineKeyframe[];
  onSeek: (time: number) => void;
  onAddKeyframe: () => void;
  onRemoveKeyframe: (id: string) => void;
  onSelectKeyframe: (time: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ 
  duration, 
  currentTime, 
  keyframes, 
  onSeek, 
  onAddKeyframe, 
  onRemoveKeyframe,
  onSelectKeyframe
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!containerRef.current || duration === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percentage * duration);
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 100);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Find active keyframe near current time to highlight
  const nearbyKeyframe = keyframes.find(k => Math.abs(k.time - currentTime) < 0.1);

  return (
    <div className="bg-gray-900 border-t border-cyber-dim p-4 flex flex-col gap-2">
      <div className="flex justify-between items-center text-xs text-cyber-accent font-mono mb-1">
        <div className="flex items-center gap-2">
            <Clock size={14} />
            {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        <div className="flex gap-2">
           <button 
             onClick={nearbyKeyframe ? () => onRemoveKeyframe(nearbyKeyframe.id) : onAddKeyframe}
             className={`px-3 py-1 rounded font-bold uppercase flex items-center gap-1 text-[10px] tracking-wider transition-colors
               ${nearbyKeyframe 
                 ? 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/50' 
                 : 'bg-cyber-accent/20 text-cyber-accent hover:bg-cyber-accent hover:text-black border border-cyber-accent/50'}`}
           >
             {nearbyKeyframe ? <><Trash2 size={10} /> Del Keyframe</> : <><Plus size={10} /> Add Keyframe</>}
           </button>
        </div>
      </div>

      {/* Track Area */}
      <div 
        ref={containerRef}
        onClick={handleTimelineClick}
        className="relative h-12 bg-black border border-gray-700 rounded cursor-crosshair overflow-hidden group"
      >
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '5% 100%' }}>
        </div>

        {/* Progress Fill */}
        <div 
            className="absolute top-0 bottom-0 left-0 bg-cyber-accent/10 border-r border-cyber-accent pointer-events-none"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
        ></div>

        {/* Keyframe Markers */}
        {keyframes.map(kf => (
            <div
                key={kf.id}
                onClick={(e) => { e.stopPropagation(); onSelectKeyframe(kf.time); }}
                className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 border cursor-pointer transition-all hover:scale-125 z-10
                  ${Math.abs(kf.time - currentTime) < 0.1 ? 'bg-cyber-accent border-white shadow-[0_0_10px_#00ff9d]' : 'bg-gray-800 border-cyber-accent'}`}
                style={{ left: `calc(${(kf.time / (duration || 1)) * 100}% - 6px)` }}
                title={`Keyframe at ${formatTime(kf.time)}`}
            ></div>
        ))}
      </div>
      
      <div className="text-[10px] text-gray-500 text-center uppercase tracking-widest">
        Keyframe Timeline
      </div>
    </div>
  );
};
