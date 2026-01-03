import { EffectDefinition } from "../types";

// --- Helper Functions ---
const getBrightness = (r: number, g: number, b: number) => (r * 0.299 + g * 0.587 + b * 0.114);

const getSat = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === 0) return 0;
    return (max - min) / max;
};

const getHue = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    if (max === min) return 0;
    const d = max - min;
    
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return h / 6;
}

const createTempCanvas = (w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
};

// Global buffers
const feedbackBuffers: Record<string, HTMLCanvasElement> = {};
const tempBuffers: Record<string, HTMLCanvasElement> = {};
// Frame counters for rate limiting
const frameCounters: Record<string, number> = {};

export const EFFECT_LIBRARY: EffectDefinition[] = [
    // --- TIME EFFECTS ---
    {
        id: 'time_scan',
        name: 'Time Scan',
        category: 'Time',
        description: 'Slit-scan time displacement. Freeze time in strips.',
        defaultParams: [
            { id: 'mix', label: 'Mix', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'speed', label: 'Speed', type: 'range', min: -20, max: 20, value: 2, step: 0.1 },
            { id: 'scanOffset', label: 'Start / Offset', type: 'range', min: 0, max: 1, value: 0, step: 0.001 },
            { id: 'slit', label: 'Slit Width', type: 'range', min: 1, max: 50, value: 2, step: 1 },
            { id: 'direction', label: 'Axis', type: 'select', options: ['X', 'Y'], value: 'Y' },
            { id: 'behavior', label: 'Mode', type: 'select', options: ['Scan', 'Scroll'], value: 'Scan' }
        ],
        process: (ctx, input, w, h, params) => {
            if (params.mix <= 0) { ctx.drawImage(input,0,0); return; }

            // Ensure buffer exists
            if (!feedbackBuffers['time_scan']) feedbackBuffers['time_scan'] = createTempCanvas(w, h);
            const fb = feedbackBuffers['time_scan'];
            if(fb.width !== w) { fb.width = w; fb.height = h; }
            const fbCtx = fb.getContext('2d')!;

            // State for scan position
            if (frameCounters['time_scan_pos'] === undefined) frameCounters['time_scan_pos'] = 0;
            
            const speed = params.speed;
            const slit = Math.max(1, params.slit);
            const vertical = params.direction === 'Y';
            const limit = vertical ? h : w;
            
            if (params.behavior === 'Scan') {
                // SCANNER MODE: Updates a strip of the buffer at the moving scan line position
                
                // Update position
                frameCounters['time_scan_pos'] += speed;
                
                // Calculate Effective Position (Animation + Manual Offset)
                const offsetPixels = (params.scanOffset * limit);
                let effectivePos = (frameCounters['time_scan_pos'] + offsetPixels) % limit;
                if (effectivePos < 0) effectivePos += limit;
                
                const pos = Math.floor(effectivePos);

                // Draw slit from INPUT to BUFFER at current Position
                if (vertical) {
                    // Updating a horizontal row at Y=pos
                    fbCtx.drawImage(input, 0, pos, w, slit, 0, pos, w, slit);
                } else {
                    // Updating a vertical column at X=pos
                    fbCtx.drawImage(input, pos, 0, slit, h, pos, 0, slit, h);
                }
                
                // Draw Buffer
                ctx.drawImage(fb, 0, 0);

                // Optional: Draw the "Scan Line" indicator if speed is 0 to help manual positioning
                if (Math.abs(speed) < 0.1) {
                    ctx.save();
                    ctx.fillStyle = 'rgba(0, 255, 157, 0.5)';
                    if (vertical) ctx.fillRect(0, pos, w, 2);
                    else ctx.fillRect(pos, 0, 2, h);
                    ctx.restore();
                }

            } else {
                // SCROLL MODE (Waterfall): Shifts the buffer and adds new line at edge
                
                const shift = Math.abs(speed); 
                if (shift < 0.1) {
                     ctx.drawImage(fb, 0, 0);
                     return;
                }
                
                if (!tempBuffers['scan_swap']) tempBuffers['scan_swap'] = createTempCanvas(w, h);
                const swap = tempBuffers['scan_swap'];
                if(swap.width !== w) { swap.width = w; swap.height = h; }
                const swapCtx = swap.getContext('2d')!;
                
                swapCtx.clearRect(0,0,w,h);
                swapCtx.drawImage(fb, 0, 0); // Copy current buffer to swap
                
                fbCtx.clearRect(0,0,w,h); // Clear FB

                const sY = Math.min(Math.max(0, params.scanOffset * h), h-1);
                const sX = Math.min(Math.max(0, params.scanOffset * w), w-1);

                if (vertical) {
                     if (speed > 0) {
                        fbCtx.drawImage(swap, 0, 0, w, h - shift, 0, shift, w, h - shift); 
                        fbCtx.drawImage(input, 0, sY, w, shift, 0, 0, w, shift); 
                     } else {
                        const absSpeed = Math.abs(speed);
                        fbCtx.drawImage(swap, 0, absSpeed, w, h - absSpeed, 0, 0, w, h - absSpeed); 
                        fbCtx.drawImage(input, 0, sY, w, absSpeed, 0, h - absSpeed, w, absSpeed); 
                     }
                } else {
                     if (speed > 0) {
                        fbCtx.drawImage(swap, 0, 0, w - shift, h, shift, 0, w - shift, h);
                        fbCtx.drawImage(input, sX, 0, shift, h, 0, 0, shift, h);
                     } else {
                        const absSpeed = Math.abs(speed);
                        fbCtx.drawImage(swap, absSpeed, 0, w - absSpeed, h, 0, 0, w - absSpeed, h);
                        fbCtx.drawImage(input, sX, 0, absSpeed, h, w - absSpeed, 0, absSpeed, h);
                     }
                }
                
                ctx.drawImage(fb, 0, 0);
            }
            
            // Mix Dry
            if (params.mix < 1) {
                ctx.save();
                ctx.globalAlpha = 1 - params.mix;
                ctx.drawImage(input, 0, 0);
                ctx.restore();
            }
        }
    },

    // --- ADVANCED PIXEL SORT ---
    {
        id: 'pixel_sort_pro',
        name: 'Pixel Sort (God Mode)',
        category: 'Glitch',
        description: 'Advanced sorting by Luma, Hue, or Saturation with masking.',
        defaultParams: [
            { id: 'mix', label: 'Dry / Wet', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'mode', label: 'Trigger Mode', type: 'select', options: ['Luma', 'Hue', 'Saturation', 'Red', 'Blue'], value: 'Luma' },
            { id: 'threshLow', label: 'Threshold Low', type: 'range', min: 0, max: 1, value: 0.2, step: 0.01 },
            { id: 'threshHigh', label: 'Threshold High', type: 'range', min: 0, max: 1, value: 0.8, step: 0.01 },
            { id: 'direction', label: 'Direction', type: 'select', options: ['X', 'Y', 'Cross'], value: 'X' },
            { id: 'reverse', label: 'Reverse Sort', type: 'range', min: 0, max: 1, value: 0, step: 1 }, 
            { id: 'quality', label: 'Res/Speed', type: 'range', min: 1, max: 4, value: 1, step: 1 } 
        ],
        process: (ctx, input, w, h, params) => {
            if (params.mix <= 0) {
                ctx.drawImage(input, 0, 0, w, h);
                return;
            }
            ctx.drawImage(input, 0, 0, w, h);
            
            const idata = ctx.getImageData(0,0,w,h);
            const d = idata.data;
            const mode = params.mode;
            const tLo = params.threshLow * 255;
            const tHi = params.threshHigh * 255;
            const rev = params.reverse > 0.5;
            const step = Math.floor(params.quality);

            const getValue = (i: number) => {
                const r = d[i]; const g = d[i+1]; const b = d[i+2];
                switch(mode) {
                    case 'Luma': return r * 0.299 + g * 0.587 + b * 0.114;
                    case 'Hue': return getHue(r,g,b) * 255;
                    case 'Saturation': return getSat(r,g,b) * 255;
                    case 'Red': return r;
                    case 'Blue': return b;
                    default: return r;
                }
            };

            const sortSpan = (indices: number[]) => {
                const pixelStore = [];
                for(let k=0; k<indices.length; k++) {
                    const idx = indices[k];
                    pixelStore.push({
                        r: d[idx], g: d[idx+1], b: d[idx+2], a: d[idx+3],
                        val: getValue(idx)
                    });
                }
                if (rev) pixelStore.sort((a,b) => b.val - a.val);
                else pixelStore.sort((a,b) => a.val - b.val);

                for(let k=0; k<indices.length; k++) {
                    const idx = indices[k];
                    const p = pixelStore[k];
                    d[idx] = p.r; d[idx+1] = p.g; d[idx+2] = p.b; d[idx+3] = p.a;
                }
            };

            if (params.direction === 'X' || params.direction === 'Cross') {
                for(let y=0; y<h; y+=step) {
                    const rowOff = y*w*4;
                    let currentSpan: number[] = [];
                    for(let x=0; x<w; x++) {
                        const idx = rowOff + x*4;
                        const val = getValue(idx);
                        if (val >= tLo && val <= tHi) {
                            currentSpan.push(idx);
                        } else {
                            if (currentSpan.length > 1) sortSpan(currentSpan);
                            currentSpan = [];
                        }
                    }
                    if (currentSpan.length > 1) sortSpan(currentSpan);
                }
            }

            if (params.direction === 'Y' || params.direction === 'Cross') {
                for(let x=0; x<w; x+=step) {
                    let currentSpan: number[] = [];
                    for(let y=0; y<h; y++) {
                        const idx = (y*w + x)*4;
                        const val = getValue(idx);
                        if (val >= tLo && val <= tHi) {
                            currentSpan.push(idx);
                        } else {
                            if (currentSpan.length > 1) sortSpan(currentSpan);
                            currentSpan = [];
                        }
                    }
                    if (currentSpan.length > 1) sortSpan(currentSpan);
                }
            }

            ctx.putImageData(idata, 0, 0);

            if (params.mix < 1) {
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1 - params.mix;
                ctx.drawImage(input, 0, 0, w, h);
                ctx.restore();
            }
        }
    },

    // --- FEEDBACK ---
    {
        id: 'liquid_feedback',
        name: 'Liquid Feedback',
        category: 'Feedback',
        description: 'Recursive loop with adjustable speed and transform.',
        defaultParams: [
            { id: 'mix', label: 'Dry / Wet', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'speed', label: 'Update Speed', type: 'range', min: 0.01, max: 1, value: 1, step: 0.01 },
            { id: 'decay', label: 'Decay', type: 'range', min: 0, max: 0.99, value: 0.95, step: 0.01 },
            { id: 'scale', label: 'Scale', type: 'range', min: 0.5, max: 2.0, value: 1.01, step: 0.001 },
            { id: 'rotate', label: 'Rotate', type: 'range', min: -180, max: 180, value: 0, step: 0.1 }, 
            { id: 'tx', label: 'Move X', type: 'range', min: -500, max: 500, value: 0, step: 1 }, 
            { id: 'hue', label: 'Hue Shift', type: 'range', min: -180, max: 180, value: 1, step: 0.1 },
            { id: 'blend', label: 'Mode', type: 'select', options: ['source-over', 'screen', 'difference', 'overlay', 'hard-light'], value: 'hard-light' }
        ],
        process: (ctx, input, w, h, params) => {
             if (!frameCounters['liquid']) frameCounters['liquid'] = 0;
             frameCounters['liquid'] += params.speed;
             
             if (!feedbackBuffers['liquid']) feedbackBuffers['liquid'] = createTempCanvas(w, h);
             const fb = feedbackBuffers['liquid'];
             if(fb.width !== w) { fb.width = w; fb.height = h; }
             const fbCtx = fb.getContext('2d')!;

             if (!tempBuffers['liquid_swap']) tempBuffers['liquid_swap'] = createTempCanvas(w, h);
             const swap = tempBuffers['liquid_swap'];
             if(swap.width !== w) { swap.width = w; swap.height = h; }
             const swapCtx = swap.getContext('2d')!;

             swapCtx.clearRect(0,0,w,h);
             swapCtx.drawImage(input, 0, 0, w, h);

             if (frameCounters['liquid'] >= 1) {
                 frameCounters['liquid'] %= 1;
                 
                 ctx.clearRect(0,0,w,h);
                 ctx.save();
                 ctx.translate(w/2, h/2);
                 ctx.scale(params.scale, params.scale);
                 ctx.rotate(params.rotate * 0.0174533);
                 ctx.translate(params.tx, 0); 
                 ctx.translate(-w/2, -h/2);
                 if (Math.abs(params.hue) > 0.1) ctx.filter = `hue-rotate(${params.hue}deg)`;
                 ctx.globalAlpha = params.decay;
                 ctx.drawImage(fb, 0, 0, w, h);
                 ctx.restore();

                 ctx.save();
                 ctx.globalCompositeOperation = params.blend;
                 ctx.drawImage(swap, 0, 0, w, h);
                 ctx.restore();

                 fbCtx.clearRect(0,0,w,h);
                 fbCtx.drawImage(ctx.canvas, 0, 0);
             } else {
                 ctx.clearRect(0,0,w,h);
                 ctx.drawImage(fb, 0, 0);
             }

             if (params.mix < 1) {
                 ctx.save();
                 ctx.globalAlpha = 1 - params.mix;
                 ctx.globalCompositeOperation = 'source-over';
                 ctx.drawImage(input, 0, 0, w, h);
                 ctx.restore();
             }
        }
    },
    {
        id: 'hyper_echo',
        name: 'Hyper Echo',
        category: 'Feedback',
        description: 'Deep feedback trails with zoom, rotation, and strobing.',
        defaultParams: [
            { id: 'mix', label: 'Decay/Trail', type: 'range', min: 0, max: 0.99, value: 0.85, step: 0.01 },
            { id: 'zoom', label: 'Zoom', type: 'range', min: 0.5, max: 1.5, value: 1.05, step: 0.001 },
            { id: 'spin', label: 'Spin', type: 'range', min: -45, max: 45, value: 0, step: 0.1 },
            { id: 'xOff', label: 'Shift X', type: 'range', min: -100, max: 100, value: 0, step: 1 },
            { id: 'yOff', label: 'Shift Y', type: 'range', min: -100, max: 100, value: 0, step: 1 },
            { id: 'hue', label: 'Hue Cycle', type: 'range', min: 0, max: 180, value: 5, step: 1 },
            { id: 'blend', label: 'Blend', type: 'select', options: ['source-over', 'screen', 'lighten', 'difference', 'multiply'], value: 'screen' }
        ],
        process: (ctx, input, w, h, params) => {
            // Setup Buffer
            if (!feedbackBuffers['hyper_echo']) feedbackBuffers['hyper_echo'] = createTempCanvas(w, h);
            const fb = feedbackBuffers['hyper_echo'];
            if(fb.width !== w) { fb.width = w; fb.height = h; }
            const fbCtx = fb.getContext('2d')!;

            // 1. Clear Main Canvas
            ctx.clearRect(0,0,w,h);

            // 2. Draw Feedback Loop onto Main Canvas (The "Echo")
            ctx.save();
            ctx.translate(w/2, h/2);
            ctx.scale(params.zoom, params.zoom);
            ctx.rotate(params.spin * 0.01745); // Deg to Rad
            ctx.translate(params.xOff, params.yOff);
            ctx.translate(-w/2, -h/2);
            ctx.globalAlpha = params.mix; // Decay
            if (params.hue !== 0) ctx.filter = `hue-rotate(${params.hue}deg)`;
            ctx.drawImage(fb, 0, 0);
            ctx.restore();

            // 3. Composite New Input Frame
            ctx.save();
            ctx.globalCompositeOperation = params.blend;
            // Note: If blend is 'source-over', input covers echo.
            // If we want echo 'in front', we reverse order, but standard echo puts input in front.
            // However, typical video feedback logic is: Buffer = (Buffer * decay) + Input
            ctx.drawImage(input, 0, 0, w, h);
            ctx.restore();

            // 4. Capture Result back to Buffer
            fbCtx.clearRect(0,0,w,h);
            fbCtx.drawImage(ctx.canvas, 0, 0);
        }
    },

    // --- NEW GEOMETRY EFFECTS ---
    {
        id: 'vertex_displacement',
        name: '3D Vertex Displacement',
        category: 'Geometry',
        description: 'Simulates a 3D mesh where vertices are displaced by noise or audio.',
        defaultParams: [
            { id: 'mix', label: 'Mix', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'density', label: 'Mesh Density', type: 'range', min: 5, max: 50, value: 20, step: 1 },
            { id: 'amount', label: 'Displacement', type: 'range', min: 0, max: 100, value: 30, step: 1 },
            { id: 'speed', label: 'Speed', type: 'range', min: 0, max: 5, value: 1, step: 0.1 },
            { id: 'sensitivity', label: 'Audio Sens', type: 'range', min: 0, max: 5, value: 1, step: 0.1 },
            { id: 'mode', label: 'Driver', type: 'select', options: ['Noise', 'Sine', 'Audio Sim'], value: 'Noise' }
        ],
        process: (ctx, input, w, h, params, t) => {
            if (params.mix <= 0) { ctx.drawImage(input, 0, 0); return; }

            // Cache input for sampling
            if (!tempBuffers['vertex_mesh']) tempBuffers['vertex_mesh'] = createTempCanvas(w, h);
            const tb = tempBuffers['vertex_mesh'];
            if(tb.width !== w) { tb.width = w; tb.height = h; }
            const tbCtx = tb.getContext('2d')!;
            tbCtx.drawImage(input, 0, 0, w, h);

            ctx.clearRect(0,0,w,h);

            const cols = Math.floor(params.density);
            const rows = Math.floor(params.density);
            const cw = w / cols;
            const ch = h / rows;
            const amp = params.amount;

            for(let y=0; y<rows; y++) {
                for(let x=0; x<cols; x++) {
                    const cx = x * cw;
                    const cy = y * ch;
                    const centerX = cx + cw/2;
                    const centerY = cy + ch/2;

                    // Calculate Displacement based on mode
                    let z = 0;
                    if (params.mode === 'Noise') {
                         // Perlin-ish noise approximation
                         z = Math.sin(x * 0.32 + t * params.speed) + Math.cos(y * 0.45 - t * params.speed * 1.2);
                         z /= 2;
                    } else if (params.mode === 'Sine') {
                         // Radial sine wave
                         const dist = Math.sqrt(Math.pow(x - cols/2, 2) + Math.pow(y - rows/2, 2));
                         z = Math.sin(dist * 0.5 - t * params.speed);
                    } else {
                         // Audio Sim: High frequency random jitter simulating audio bands
                         // Using time and position to seed pseudo-randomness that is frame-coherent enough
                         const rand = Math.sin(x * 12.9898 + y * 78.233 + t * 50); 
                         z = rand * params.sensitivity;
                    }

                    // Apply intensity
                    const displacement = z * amp;

                    // 3D Projection Simulation
                    // We simulate Z depth by scaling the cell and shifting it relative to center
                    // Positive Z = Closer (Larger scale, shift away from center)
                    const scale = 1 + (displacement * 0.01);
                    
                    // Offset based on "Angle of View" simulation (Wobble)
                    const offX = displacement * Math.cos(t * 0.5) * 0.5;
                    const offY = displacement * Math.sin(t * 0.5) * 0.5;

                    const dw = cw * scale;
                    const dh = ch * scale;
                    
                    // Draw cell centered at new position
                    // Source: cx, cy, cw, ch
                    // Dest: shifted center
                    ctx.drawImage(tb, cx, cy, cw, ch, (cx + offX) - (dw - cw)/2, (cy + offY) - (dh - ch)/2, dw, dh);
                }
            }

             if (params.mix < 1) {
                 ctx.save();
                 ctx.globalAlpha = 1 - params.mix;
                 ctx.drawImage(input, 0, 0);
                 ctx.restore();
             }
        }
    },

    {
        id: 'fractal_tiling',
        name: 'Fractal Tiling',
        category: 'Geometry',
        description: 'Mirrored recursive grid with scrolling and rotation.',
        defaultParams: [
            { id: 'mix', label: 'Mix', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'tiles', label: 'Grid Size', type: 'range', min: 1, max: 50, value: 2, step: 0.1 },
            { id: 'mirror', label: 'Mirror', type: 'select', options: ['None', 'X', 'Y', 'XY'], value: 'XY' },
            { id: 'scrollX', label: 'Scroll X', type: 'range', min: -50, max: 50, value: 0, step: 0.1 },
            { id: 'scrollY', label: 'Scroll Y', type: 'range', min: -50, max: 50, value: 0, step: 0.1 },
            { id: 'angle', label: 'Tile Angle', type: 'range', min: -180, max: 180, value: 0, step: 1 }
        ],
        process: (ctx, input, w, h, params, t) => {
            if (params.mix <= 0) { ctx.drawImage(input, 0, 0); return; }

            const tiles = Math.max(1, params.tiles);
            const cols = Math.ceil(tiles);
            const rows = Math.ceil(tiles);
            const tileW = w / tiles;
            const tileH = h / tiles;
            
            // Handle Dry/Wet
            if (params.mix >= 1) ctx.clearRect(0,0,w,h);
            else ctx.drawImage(input, 0, 0);

            ctx.save();
            if (params.mix < 1) ctx.globalAlpha = params.mix;

            // Pre-calculate scroll offsets
            const offX = (t * params.scrollX * 50);
            const offY = (t * params.scrollY * 50);

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    ctx.save();
                    
                    let dx = x * tileW;
                    let dy = y * tileH;
                    
                    ctx.translate(dx, dy);
                    
                    // Mirroring Logic
                    let flipX = false;
                    let flipY = false;
                    if (params.mirror === 'X' || params.mirror === 'XY') {
                        if (x % 2 !== 0) flipX = true;
                    }
                    if (params.mirror === 'Y' || params.mirror === 'XY') {
                        if (y % 2 !== 0) flipY = true;
                    }
                    
                    // Scale for tile size and flip
                    // Note: If we flip, we translate back
                    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
                    if (flipX) ctx.translate(-tileW, 0);
                    if (flipY) ctx.translate(0, -tileH);

                    // Rotation (Center of tile)
                    if (params.angle !== 0) {
                        ctx.translate(tileW/2, tileH/2);
                        ctx.rotate(params.angle * 0.01745);
                        ctx.translate(-tileW/2, -tileH/2);
                    }
                    
                    // Drawing
                    const effW = w; 
                    const effH = h;
                    let sx = (-offX) % effW;
                    let sy = (-offY) % effH;
                    if (sx < 0) sx += effW;
                    if (sy < 0) sy += effH;

                    // Optimize: If scroll is 0, one draw.
                    if (Math.abs(params.scrollX) < 0.1 && Math.abs(params.scrollY) < 0.1) {
                         ctx.drawImage(input, 0, 0, w, h, 0, 0, tileW, tileH);
                    } else {
                         // Relative shift in 0..1 space
                         const u = sx / effW; 
                         const v = sy / effH;
                         
                         // Draw 4 quadrants
                         // TL
                         ctx.drawImage(input, sx, sy, w-sx, h-sy, 0, 0, (1-u)*tileW, (1-v)*tileH);
                         // TR
                         if (u > 0) ctx.drawImage(input, 0, sy, sx, h-sy, (1-u)*tileW, 0, u*tileW, (1-v)*tileH);
                         // BL
                         if (v > 0) ctx.drawImage(input, sx, 0, w-sx, sy, 0, (1-v)*tileH, (1-u)*tileW, v*tileH);
                         // BR
                         if (u > 0 && v > 0) ctx.drawImage(input, 0, 0, sx, sy, (1-u)*tileW, (1-v)*tileH, u*tileW, v*tileH);
                    }
                    
                    ctx.restore();
                }
            }
            ctx.restore();
        }
    },

    {
        id: 'hypnotic_ripples',
        name: 'Hypnotic Ripples',
        category: 'Geometry',
        description: 'Psychedelic radial sine wave distortions.',
        defaultParams: [
            { id: 'mix', label: 'Dry / Wet', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'freq', label: 'Frequency', type: 'range', min: 1, max: 100, value: 20, step: 1 },
            { id: 'amp', label: 'Amplitude', type: 'range', min: 0, max: 50, value: 10, step: 1 },
            { id: 'speed', label: 'Speed', type: 'range', min: 0, max: 5, value: 1, step: 0.1 },
            { id: 'centerX', label: 'Center X', type: 'range', min: 0, max: 1, value: 0.5, step: 0.01 }
        ],
        process: (ctx, input, w, h, params, t) => {
             if (params.mix <= 0) { ctx.drawImage(input, 0, 0); return; }
             
             const cx = w * params.centerX;
             const cy = h / 2;
             
             const strips = 50; 
             const sh = h / strips;
             
             if (!tempBuffers['ripples']) tempBuffers['ripples'] = createTempCanvas(w, h);
             const tb = tempBuffers['ripples'];
             if(tb.width !== w) { tb.width = w; tb.height = h; }
             const tbCtx = tb.getContext('2d')!;
             tbCtx.drawImage(input, 0, 0);

             ctx.clearRect(0,0,w,h);
             
             for(let i=0; i<strips; i++) {
                 const y = i * sh;
                 const dy = y - cy;
                 const dist = Math.abs(dy); 
                 
                 const shift = Math.sin((dist * 0.01 * params.freq) - (t * params.speed)) * params.amp;
                 
                 const scale = 1 + (shift * 0.002);
                 const sw = w * scale;
                 const sx = (w - sw) / 2;
                 
                 ctx.drawImage(tb, 0, y, w, sh, sx + shift, y, sw, sh);
             }
             
             if (params.mix < 1) {
                 ctx.save();
                 ctx.globalAlpha = 1 - params.mix;
                 ctx.drawImage(input, 0, 0);
                 ctx.restore();
             }
        }
    },
    {
        id: 'spectral_acid',
        name: 'Spectral Acid',
        category: 'Color',
        description: 'Psychedelic gradient mapping and hue cycling.',
        defaultParams: [
            { id: 'mix', label: 'Mix', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'speed', label: 'Cycle Speed', type: 'range', min: 0, max: 10, value: 2, step: 0.1 },
            { id: 'freq', label: 'Banding', type: 'range', min: 1, max: 20, value: 3, step: 0.1 },
            { id: 'pop', label: 'Pop/Neon', type: 'range', min: 0, max: 1, value: 0.5, step: 0.01 },
            { id: 'mode', label: 'Palette', type: 'select', options: ['Rainbow', 'Thermal', 'Plasma'], value: 'Rainbow' }
        ],
        process: (ctx, input, w, h, params, t) => {
            if (params.mix <= 0) { ctx.drawImage(input, 0, 0); return; }
            
            ctx.drawImage(input, 0, 0, w, h);
            const idata = ctx.getImageData(0,0,w,h);
            const d = idata.data;
            const len = d.length;
            
            const time = t * params.speed;
            const freq = params.freq * 0.1;
            
            for(let i=0; i<len; i+=4) {
                const r = d[i];
                const g = d[i+1];
                const b = d[i+2];
                
                // Luminance
                const l = (r + g + b) / 765; // 0-1
                
                // Map luminance to color based on mode
                let nr, ng, nb;
                
                // Value to drive the cosine palette
                const v = (l * 10 * freq) + time;
                
                if (params.mode === 'Rainbow') {
                    // Cosine based rainbow
                    nr = (0.5 + 0.5 * Math.cos(v)) * 255;
                    ng = (0.5 + 0.5 * Math.cos(v + 2.09)) * 255; // + 1/3 tau
                    nb = (0.5 + 0.5 * Math.cos(v + 4.18)) * 255; // + 2/3 tau
                } else if (params.mode === 'Plasma') {
                    nr = (0.5 + 0.5 * Math.sin(v)) * 255;
                    ng = (0.5 + 0.5 * Math.cos(v * 1.3)) * 255;
                    nb = (0.5 + 0.5 * Math.sin(v * 0.7)) * 255;
                } else { // Thermal
                    const h = (l + time * 0.1) % 1;
                    // Tight cosine approximation for thermal spectrum
                    nr = Math.max(0, Math.min(255, (1.5 - Math.abs(h * 6 - 3)) * 255));
                    ng = Math.max(0, Math.min(255, (1.5 - Math.abs(h * 6 - 2)) * 255));
                    nb = Math.max(0, Math.min(255, (1.5 - Math.abs(h * 6 - 4.5)) * 255));
                }
                
                // Pop: Increase contrast/saturation
                if (params.pop > 0) {
                     nr = (nr - 128) * (1 + params.pop) + 128;
                     ng = (ng - 128) * (1 + params.pop) + 128;
                     nb = (nb - 128) * (1 + params.pop) + 128;
                }

                if (params.mix < 1) {
                    d[i] = r * (1 - params.mix) + nr * params.mix;
                    d[i+1] = g * (1 - params.mix) + ng * params.mix;
                    d[i+2] = b * (1 - params.mix) + nb * params.mix;
                } else {
                    d[i] = nr;
                    d[i+1] = ng;
                    d[i+2] = nb;
                }
            }
            
            ctx.putImageData(idata, 0, 0);
        }
    },
    {
        id: 'cyborg_vision',
        name: 'Cyborg Vision',
        category: 'Color',
        description: 'Edge detection overlay with scanlines.',
        defaultParams: [
            { id: 'mix', label: 'Opacity', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'thresh', label: 'Edge Thresh', type: 'range', min: 10, max: 100, value: 30, step: 1 },
            { id: 'color', label: 'Color Hue', type: 'range', min: 0, max: 360, value: 0, step: 1 } 
        ],
        process: (ctx, input, w, h, params) => {
            if (params.mix <= 0) { ctx.drawImage(input, 0, 0); return; }
            
            ctx.drawImage(input, 0, 0);
            
            const idata = ctx.getImageData(0,0,w,h);
            const d = idata.data;
            const w4 = w*4;
            const thresh = params.thresh;
            
            if (!tempBuffers['cyborg']) tempBuffers['cyborg'] = createTempCanvas(w, h);
            const tb = tempBuffers['cyborg'];
            if(tb.width !== w) { tb.width = w; tb.height = h; }
            const tbCtx = tb.getContext('2d')!;
            const tData = tbCtx.createImageData(w, h);
            const td = tData.data;

            for(let y=1; y<h-1; y++) {
                for(let x=1; x<w-1; x++) {
                    const i = (y*w + x)*4;
                    const bri = (d[i] + d[i+1] + d[i+2]) / 3;
                    const right = (d[i+4] + d[i+5] + d[i+6]) / 3;
                    const down = (d[i+w4] + d[i+w4+1] + d[i+w4+2]) / 3;
                    
                    if (Math.abs(bri - right) > thresh || Math.abs(bri - down) > thresh) {
                        td[i] = 255; td[i+1] = 255; td[i+2] = 255; td[i+3] = 255;
                    } 
                }
            }
            tbCtx.putImageData(tData, 0, 0);
            
            ctx.save();
            ctx.globalAlpha = params.mix;
            ctx.globalCompositeOperation = 'screen';
            ctx.filter = `sepia(1) saturate(1000%) hue-rotate(${params.color}deg)`;
            ctx.drawImage(tb, 0, 0);
            ctx.filter = 'none';
            ctx.fillStyle = `rgba(0,0,0,0.5)`;
            for(let y=0; y<h; y+=4) ctx.fillRect(0,y,w,2);
            ctx.restore();
        }
    },
    {
        id: 'halftone_trippy',
        name: 'Psychedelic Halftone',
        category: 'Color',
        description: 'Converts brightness to colored dots.',
        defaultParams: [
            { id: 'mix', label: 'Dry / Wet', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'size', label: 'Dot Size', type: 'range', min: 4, max: 30, value: 10, step: 1 },
            { id: 'cycle', label: 'Color Cycle', type: 'range', min: 0, max: 10, value: 2, step: 0.1 }
        ],
        process: (ctx, input, w, h, params, t) => {
             if (params.mix <= 0) { ctx.drawImage(input, 0, 0); return; }
             
             const size = Math.floor(params.size);
             const cols = Math.ceil(w / size);
             const rows = Math.ceil(h / size);
             
             if (!tempBuffers['small']) tempBuffers['small'] = createTempCanvas(cols, rows);
             const sm = tempBuffers['small'];
             if(sm.width !== cols || sm.height !== rows) { sm.width = cols; sm.height = rows; }
             const smCtx = sm.getContext('2d')!;
             smCtx.drawImage(input, 0, 0, cols, rows);
             const idata = smCtx.getImageData(0,0,cols,rows);
             const d = idata.data;
             
             if (params.mix >= 1) {
                 ctx.fillStyle = 'black'; 
                 ctx.fillRect(0,0,w,h);
             } else {
                 ctx.drawImage(input, 0, 0);
             }

             const hueShift = t * params.cycle * 50;

             for(let y=0; y<rows; y++) {
                 for(let x=0; x<cols; x++) {
                     const i = (y*cols + x) * 4;
                     const bri = (d[i] + d[i+1] + d[i+2]) / 765; // 0-1
                     if (bri < 0.1) continue;
                     
                     const radius = (size/2) * bri * params.mix;
                     const cx = x * size + size/2;
                     const cy = y * size + size/2;
                     
                     ctx.beginPath();
                     ctx.arc(cx, cy, radius, 0, Math.PI*2);
                     ctx.fillStyle = `hsl(${bri * 360 + hueShift}, 80%, 50%)`;
                     ctx.fill();
                 }
             }
        }
    },
    {
        id: 'mirror_dimension',
        name: 'Mirror Dimension',
        category: 'Geometry',
        description: '4-way Kaleidoscopic tunnel.',
        defaultParams: [
            { id: 'mix', label: 'Mix', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'zoom', label: 'Zoom', type: 'range', min: 0.1, max: 2, value: 1, step: 0.01 },
            { id: 'angle', label: 'Rotation', type: 'range', min: 0, max: 360, value: 0, step: 1 }
        ],
        process: (ctx, input, w, h, params) => {
            if (params.mix <= 0) { ctx.drawImage(input, 0, 0); return; }
            
            if (!tempBuffers['mirror']) tempBuffers['mirror'] = createTempCanvas(w, h);
            const tb = tempBuffers['mirror'];
            if(tb.width !== w) { tb.width = w; tb.height = h; }
            const tbCtx = tb.getContext('2d')!;
            tbCtx.drawImage(input, 0, 0);

            if (params.mix < 1) ctx.drawImage(input, 0, 0);
            
            ctx.save();
            if (params.mix < 1) ctx.globalAlpha = params.mix;
            
            ctx.translate(w/2, h/2);
            ctx.rotate(params.angle * 0.01745);
            ctx.scale(params.zoom, params.zoom);
            
            ctx.scale(1, 1);
            ctx.drawImage(tb, -w/2, -h/2, w/2, h/2, -w/2, -h/2, w/2, h/2);
            ctx.scale(-1, 1);
            ctx.drawImage(tb, -w/2, -h/2, w/2, h/2, -w/2, -h/2, w/2, h/2);
            ctx.scale(1, -1);
            ctx.drawImage(tb, -w/2, -h/2, w/2, h/2, -w/2, -h/2, w/2, h/2);
            ctx.scale(-1, 1);
            ctx.drawImage(tb, -w/2, -h/2, w/2, h/2, -w/2, -h/2, w/2, h/2);

            ctx.restore();
        }
    },

    // --- UTILITY / MIXER ---
    {
        id: 'mixer',
        name: 'Video Mixer',
        category: 'Utility',
        description: 'Blend current stream with another input source.',
        defaultParams: [
            { id: 'mix', label: 'Crossfader', type: 'range', min: 0, max: 1, value: 0.5, step: 0.01 },
            { id: 'mode', label: 'Blend Mode', type: 'select', options: ['source-over', 'screen', 'multiply', 'difference', 'exclusion', 'hard-light'], value: 'screen' },
            { id: 'sourceIdx', label: 'Source Input #', type: 'range', min: 0, max: 3, value: 1, step: 1 } 
        ],
        process: (ctx, input, w, h, params, t, aux) => {
            ctx.drawImage(input, 0, 0, w, h);
            if (aux && aux.length > 0) {
                const idx = Math.min(Math.floor(params.sourceIdx), aux.length - 1);
                if (aux[idx]) {
                    ctx.save();
                    ctx.globalAlpha = params.mix;
                    ctx.globalCompositeOperation = params.mode;
                    ctx.drawImage(aux[idx], 0, 0, w, h);
                    ctx.restore();
                }
            }
        }
    },

    // --- GLITCH FUNDAMENTALS ---
    {
        id: 'datamosh',
        name: 'Datamosh Sim',
        category: 'Glitch',
        description: 'Simulate compression artifacts by block copying.',
        defaultParams: [
            { id: 'mix', label: 'Intensity', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'threshold', label: 'Probability', type: 'range', min: 0, max: 1, value: 0.1, step: 0.01 },
            { id: 'blockSize', label: 'Block Size', type: 'range', min: 16, max: 128, value: 32, step: 1 }
        ],
        process: (ctx, input, w, h, params) => {
             ctx.drawImage(input, 0, 0, w, h);
             if (params.mix <= 0 || params.threshold <= 0) return;
             
             const loops = Math.floor(params.threshold * 50 * params.mix); 
             for(let i=0; i<loops; i++) {
                 const bs = params.blockSize;
                 const sx = Math.floor(Math.random() * (w - bs));
                 const sy = Math.floor(Math.random() * (h - bs));
                 const dx = Math.floor(Math.random() * (w - bs));
                 const dy = Math.floor(Math.random() * (h - bs));
                 
                 ctx.drawImage(ctx.canvas, sx, sy, bs, bs, dx, dy, bs, bs);
             }
        }
    },
    {
        id: 'rgb_shift',
        name: 'RGB Split',
        category: 'Glitch',
        description: 'Spatially offset Red and Blue channels.',
        defaultParams: [
            { id: 'mix', label: 'Dry / Wet', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'amount', label: 'Offset', type: 'range', min: 0, max: 200, value: 20, step: 1 },
            { id: 'angle', label: 'Angle', type: 'range', min: 0, max: 6.28, value: 0, step: 0.1 }
        ],
        process: (ctx, input, w, h, params) => {
            if (params.mix <= 0) { ctx.drawImage(input,0,0); return; }

            const dx = Math.cos(params.angle) * params.amount * params.mix;
            const dy = Math.sin(params.angle) * params.amount * params.mix;
            
            ctx.drawImage(input, 0, 0, w, h);
            
            ctx.globalCompositeOperation = 'screen';
            ctx.save();
            ctx.globalAlpha = 0.7; // Hardcoded intensity
            ctx.translate(dx, dy);
            ctx.drawImage(input, 0, 0, w, h);
            ctx.restore();
            
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.translate(-dx, -dy);
            ctx.drawImage(input, 0, 0, w, h);
            ctx.restore();
            
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
    },
    {
        id: 'noise',
        name: 'Digital Noise',
        category: 'Glitch',
        description: 'Random pixel grain.',
        defaultParams: [
            { id: 'mix', label: 'Amount', type: 'range', min: 0, max: 1, value: 0.5, step: 0.01 }
        ],
        process: (ctx, input, w, h, params) => {
            ctx.drawImage(input, 0, 0, w, h);
            if (params.mix <= 0) return;
            
            const idata = ctx.getImageData(0,0,w,h);
            const d = idata.data;
            const amt = params.mix * 255;
            for(let i=0; i<d.length; i+=4) {
                const n = (Math.random() - 0.5) * amt;
                d[i] = d[i] + n;
                d[i+1] = d[i+1] + n;
                d[i+2] = d[i+2] + n;
            }
            ctx.putImageData(idata, 0, 0);
        }
    },

    // --- DISTORTION ---
    {
        id: 'melt',
        name: 'Melt',
        category: 'Geometry',
        description: 'Dripping pixels.',
        defaultParams: [
             { id: 'mix', label: 'Dry / Wet', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
             { id: 'amount', label: 'Melt Amount', type: 'range', min: 0, max: 200, value: 50, step: 1 },
             { id: 'wave', label: 'Waviness', type: 'range', min: 0, max: 50, value: 10, step: 1 }
        ],
        process: (ctx, input, w, h, params, t) => {
            if (params.mix <= 0) { ctx.drawImage(input, 0, 0); return; }
            
            if (params.mix < 1) {
                if (!tempBuffers['melt']) tempBuffers['melt'] = createTempCanvas(w, h);
                const tb = tempBuffers['melt'];
                if(tb.width !== w) { tb.width = w; tb.height = h; }
                const tbCtx = tb.getContext('2d')!;
                tbCtx.clearRect(0,0,w,h);
                
                const stripW = Math.max(5, Math.floor(w / 50));
                for(let x=0; x<w; x+=stripW) {
                    const yOff = Math.abs(Math.sin(x * 0.05 + t) * params.amount) + (Math.random() * params.wave);
                    tbCtx.drawImage(input, x, 0, stripW, h, x, yOff, stripW, h);
                }

                ctx.drawImage(input, 0, 0);
                ctx.save();
                ctx.globalAlpha = params.mix;
                ctx.drawImage(tb, 0, 0);
                ctx.restore();
            } else {
                 const stripW = Math.max(5, Math.floor(w / 50));
                 for(let x=0; x<w; x+=stripW) {
                    const yOff = Math.abs(Math.sin(x * 0.05 + t) * params.amount) + (Math.random() * params.wave);
                    ctx.drawImage(input, x, 0, stripW, h, x, yOff, stripW, h);
                 }
            }
        }
    },
    {
        id: 'lens_distortion',
        name: 'Fisheye',
        category: 'Geometry',
        description: 'Simulated lens curvature.',
        defaultParams: [
            { id: 'mix', label: 'Amount', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
            { id: 'bulge', label: 'Bulge', type: 'range', min: -1, max: 1, value: 0.5, step: 0.01 }
        ],
        process: (ctx, input, w, h, params) => {
            if (params.mix <= 0) { ctx.drawImage(input,0,0); return; }
            
            ctx.save();
            ctx.translate(w/2, h/2);
            const s = 1 + (params.bulge * params.mix);
            ctx.scale(s, s);
            ctx.translate(-w/2, -h/2);
            ctx.drawImage(input, 0, 0);
            ctx.restore();
        }
    },

    // --- COLOR / STYLE ---
    {
        id: 'color_grade',
        name: 'Color Grade',
        category: 'Color',
        description: 'Basic adjustments.',
        defaultParams: [
             { id: 'mix', label: 'Intensity', type: 'range', min: 0, max: 1, value: 1, step: 0.01 },
             { id: 'contrast', label: 'Contrast', type: 'range', min: 0, max: 200, value: 100, step: 1 },
             { id: 'saturate', label: 'Saturation', type: 'range', min: 0, max: 200, value: 100, step: 1 }
        ],
        process: (ctx, input, w, h, params) => {
            ctx.drawImage(input, 0, 0, w, h);
            if (params.mix <= 0) return;
            
            const c = 100 + ((params.contrast - 100) * params.mix);
            const s = 100 + ((params.saturate - 100) * params.mix);
            
            ctx.save();
            ctx.globalCompositeOperation = 'copy'; 
            ctx.filter = `contrast(${c}%) saturate(${s}%)`;
            ctx.drawImage(ctx.canvas, 0, 0);
            ctx.restore();
        }
    },
    {
        id: 'invert',
        name: 'Invert',
        category: 'Color',
        description: 'Negative image.',
        defaultParams: [
             { id: 'mix', label: 'Opacity', type: 'range', min: 0, max: 1, value: 1, step: 0.01 }
        ],
        process: (ctx, input, w, h, params) => {
            ctx.drawImage(input, 0, 0, w, h);
            if (params.mix <= 0) return;
            
            if (params.mix >= 1) {
                ctx.filter = 'invert(100%)';
                ctx.drawImage(input, 0, 0, w, h);
                ctx.filter = 'none';
            } else {
                ctx.save();
                ctx.filter = 'invert(100%)';
                ctx.globalAlpha = params.mix;
                ctx.drawImage(input, 0, 0, w, h);
                ctx.restore();
            }
        }
    }
];

export const getEffectDef = (id: string) => EFFECT_LIBRARY.find(e => e.id === id);