export type ParameterType = 'range' | 'select' | 'boolean' | 'color';

export interface EffectParameter {
  id: string;
  label: string;
  type: ParameterType;
  value: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[]; // For select types
}

export interface EffectDefinition {
  id: string;
  name: string;
  category: 'Glitch' | 'Geometry' | 'Color' | 'Time' | 'Feedback' | 'Utility';
  description: string;
  defaultParams: EffectParameter[];
  // Function to process the frame
  process: (
    ctx: CanvasRenderingContext2D, 
    input: CanvasImageSource, // Current video frame or previous pipe output
    width: number, 
    height: number, 
    params: Record<string, any>,
    t: number,
    auxSources?: CanvasImageSource[] // For mixers
  ) => void;
}

export interface EffectNode {
  id: string; // Unique instance ID
  definitionId: string;
  active: boolean;
  params: Record<string, any>; // Current values key-value
}

export interface VideoSource {
  id: string;
  url: string;
  element: HTMLVideoElement;
  active: boolean;
}

export enum ProcessingStatus {
  IDLE,
  PLAYING,
  RECORDING,
  EXPORTING
}

export interface AudioReactiveConfig {
  isEnabled: boolean;
  sensitivity: number;
  audioSrc: string | null;
}

export const INITIAL_AUDIO_CONFIG: AudioReactiveConfig = {
  isEnabled: false,
  sensitivity: 1.0,
  audioSrc: null
};

// Legacy / Monolith Filter State (required for Gemini service and Controls)
export interface FilterState {
  tileCount: number;
  mirror: number;
  pixelSortX: number;
  pixelSortY: number;
  threshold: number;
  datamosh: number;
  rgbShift: number;
  noise: number;
  wobble: number;
  melt: number;
  ghost: number;
  colorCycle: number;
  jitter: number;
  shatter: number;
  feedbackZoom: number;
  slitScan: number;
  rgbDelay: number;
  contrast: number;
  brightness: number;
  saturation: number;
  hue: number;
}

export const INITIAL_FILTERS: FilterState = {
  tileCount: 1,
  mirror: 0,
  pixelSortX: 0,
  pixelSortY: 0,
  threshold: 0.2,
  datamosh: 0,
  rgbShift: 0,
  noise: 0,
  wobble: 0,
  melt: 0,
  ghost: 0,
  colorCycle: 0,
  jitter: 0,
  shatter: 0,
  feedbackZoom: 0,
  slitScan: 0,
  rgbDelay: 0,
  contrast: 100,
  brightness: 100,
  saturation: 100,
  hue: 0
};

export interface TimelineKeyframe {
  id: string;
  time: number;
  state?: any; 
}