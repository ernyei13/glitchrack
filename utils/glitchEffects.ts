import { FilterState } from "../types";

// Helper to check brightness for sorting
const getBrightness = (r: number, g: number, b: number) => (r * 0.299 + g * 0.587 + b * 0.114) / 255;

// Draws the video frame with tiling and mirroring
export const drawGeometry = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  filters: FilterState
) => {
  const tileCount = Math.max(1, filters.tileCount);
  const tileW = width / tileCount;
  const tileH = height / tileCount;

  if (tileCount <= 1 && filters.mirror === 0) {
    ctx.drawImage(video, 0, 0, width, height);
    return;
  }

  const safeTileCount = Math.min(tileCount, 50); 

  for (let x = 0; x < safeTileCount; x++) {
    for (let y = 0; y < safeTileCount; y++) {
      ctx.save();
      ctx.translate(x * tileW, y * tileH);
      
      let scaleX = 1;
      let scaleY = 1;

      if (filters.mirror > 0) {
        if (x % 2 !== 0) {
            ctx.translate(tileW, 0);
            scaleX = -1;
        }
        if (filters.mirror > 1 && y % 2 !== 0) {
            ctx.translate(0, tileH);
            scaleY = -1;
        }
      }
      
      ctx.scale(scaleX, scaleY);
      // Draw slightly larger to avoid gaps
      ctx.drawImage(video, -1, -1, tileW + 2, tileH + 2);
      ctx.restore();
    }
  }
};

// Temporal Effects (Slit Scan / RGB Delay)
// Requires access to the history buffer
export const applyTemporalEffects = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    filters: FilterState,
    buffer: HTMLCanvasElement[],
    headIndex: number
) => {
    // 1. RGB Delay (Temporal Chromatic Aberration)
    if (filters.rgbDelay > 0 && buffer.length > 0) {
        // We need to composite 3 frames: Current (R), T-delay (G), T-2*delay (B)
        // This is expensive as it requires getImageData/putImageData blending or globalCompositeOperation
        
        const delayFrames = Math.floor(filters.rgbDelay * (buffer.length / 3));
        if (delayFrames > 0) {
            // Calculate indices
            // headIndex is current frame (Red)
            let gIdx = headIndex - delayFrames;
            if (gIdx < 0) gIdx += buffer.length;
            
            let bIdx = headIndex - (delayFrames * 2);
            if (bIdx < 0) bIdx += buffer.length;

            // We can use 'screen' or 'lighten' blend mode to mix channels
            // But true RGB channel separation in Canvas2D is tricky without pixel manip.
            // Fast approach: Draw G and B frames with 'screen' blend and color filters?
            // Better approach: Use multiply blending with pure colors?
            
            // "Poor man's" RGB Delay using blend modes:
            // 1. Draw Red frame (Current ctx state, likely already drawn).
            // Actually, ctx currently has the geometry/video drawn.
            // We'll treat current canvas as Red channel approx (it's full color, but we'll overlay others).
            
            ctx.save();
            ctx.globalCompositeOperation = 'difference'; 
            // Difference with Green frame creates magenta/green split
            ctx.drawImage(buffer[gIdx], 0, 0, width, height);
            
            ctx.globalCompositeOperation = 'difference';
            // Difference with Blue frame
            ctx.drawImage(buffer[bIdx], 0, 0, width, height);
            
            // Re-invert to get something visible? The logic above creates trippy colors but not strict RGB shift.
            // For strict RGB shift, we have to do pixel manipulation which is slow for full frames.
            // Let's stick to 'screen' blend of offset frames for a ghosting effect which looks like RGB delay.
            ctx.restore();
            
            // Alternative: Ghosting (Echo)
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.globalCompositeOperation = 'lighten';
            // Draw delayed frames slightly tinted?
            // This is a "hyperspective" style visual, even if not strict RGB delay.
            // Let's actually just draw the delayed frames with specific channel masks using multiply?
            // Too slow.
            // Let's just draw the delayed frames with low opacity to create "trails".
            // ctx.drawImage(buffer[gIdx], -10 * filters.rgbDelay, 0); // spatial offset too
            ctx.restore();
        }
    }

    // 2. Slit Scan (Time Displacement)
    if (filters.slitScan > 0 && buffer.length > 0) {
        // Draw horizontal strips from history
        const totalStrips = height; // per pixel line? or blocks?
        // Optimization: blocks of 2px
        const stripHeight = 2; 
        
        for (let y = 0; y < height; y += stripHeight) {
            // Map y position to time delay
            // Top = current, Bottom = old
            const relativeY = y / height; // 0 to 1
            const delay = Math.floor(relativeY * (buffer.length - 1) * filters.slitScan);
            
            let frameIdx = headIndex - delay;
            if (frameIdx < 0) frameIdx += buffer.length;
            
            const sourceCanvas = buffer[frameIdx];
            if (sourceCanvas) {
                ctx.drawImage(sourceCanvas, 
                    0, y, width, stripHeight, // source rect
                    0, y, width, stripHeight  // dest rect
                );
            }
        }
    }
}

// Applies post-processing distortions (Wobble/Melt/Jitter/Shatter)
export const applyDistortion = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    filters: FilterState,
    time: number // monotonic time for animation
) => {
    if (filters.wobble === 0 && filters.melt === 0 && filters.jitter === 0 && filters.shatter === 0) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCtx.drawImage(ctx.canvas, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // 1. Jitter (Scanline displacement)
    if (filters.wobble > 0 || filters.jitter > 0) {
        const sliceHeight = filters.jitter > 0 ? 2 : 4; 
        const wobbleAmp = filters.wobble * 50;
        const jitterAmp = filters.jitter * 50;

        for (let y = 0; y < height; y += sliceHeight) {
            let offsetX = 0;
            
            // Wobble
            if (filters.wobble > 0) {
                offsetX += Math.sin((y * 0.05) + (time * 0.05)) * wobbleAmp;
            }
            
            // Jitter
            if (filters.jitter > 0) {
                const noise = Math.sin((y * 12.9898) + time) * 43758.5453;
                const fract = noise - Math.floor(noise);
                offsetX += (fract - 0.5) * jitterAmp;
            }

            ctx.drawImage(
                tempCanvas,
                0, y, width, sliceHeight, 
                offsetX, y, width, sliceHeight
            );
            
            // Wrap X
            if (offsetX !== 0) {
                 if (offsetX > 0) {
                     ctx.drawImage(tempCanvas, width - offsetX, y, offsetX, sliceHeight, 0, y, offsetX, sliceHeight);
                 } else {
                     ctx.drawImage(tempCanvas, 0, y, -offsetX, sliceHeight, width + offsetX, y, -offsetX, sliceHeight);
                 }
            }
        }
    } else {
        ctx.drawImage(tempCanvas, 0, 0);
    }

    // 2. Melt (Column Shifting)
    if (filters.melt > 0) {
        tempCtx.clearRect(0,0,width,height);
        tempCtx.drawImage(ctx.canvas, 0, 0);
        ctx.clearRect(0,0,width,height);

        const stripWidth = Math.max(2, Math.floor(50 / (filters.melt + 0.1))); 
        const maxShift = filters.melt * 200; 
        
        for (let x = 0; x < width; x += stripWidth) {
            const noise = Math.sin(x * 0.1 + time * 0.005); 
            const offsetY = Math.abs(noise * maxShift);
            
            ctx.drawImage(
                tempCanvas,
                x, 0, stripWidth, height,
                x, offsetY, stripWidth, height
            );
        }
    }

    // 3. Shatter (Block Displacement)
    if (filters.shatter > 0) {
        tempCtx.clearRect(0,0,width,height);
        tempCtx.drawImage(ctx.canvas, 0, 0);

        const blocks = Math.floor(filters.shatter * 20) + 1; 
        const maxOffset = filters.shatter * 100;

        for (let i = 0; i < blocks; i++) {
             const rx = Math.random() * width;
             const ry = Math.random() * height;
             const rw = (Math.random() * 100) + 50;
             const rh = (Math.random() * 100) + 50;
             
             const ox = (Math.random() - 0.5) * maxOffset;
             const oy = (Math.random() - 0.5) * maxOffset;

             ctx.drawImage(
                 tempCanvas,
                 rx, ry, rw, rh,
                 rx + ox, ry + oy, rw, rh
             );
        }
    }
};

export const applyEffects = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filters: FilterState,
  frameCount: number
) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const len = data.length;

  // 1. Pixel Sorting
  if (filters.pixelSortX > 0) {
    const rowLoops = Math.floor(filters.pixelSortX);
    const step = Math.max(1, Math.floor(200 / (filters.pixelSortX + 1))); 
    
    for (let i = 0; i < height; i += step) {
       let start = -1;
       const rowOffset = i * width * 4;
       
       for (let x = 0; x < width; x++) {
         const idx = rowOffset + (x * 4);
         const b = getBrightness(data[idx], data[idx+1], data[idx+2]);
         
         if (b > filters.threshold) {
           if (start < 0) start = x;
         } else {
           if (start >= 0) {
             const spanLen = x - start;
             if (spanLen > 2) {
                const segment = [];
                for (let k = 0; k < spanLen; k++) {
                    const pIdx = rowOffset + ((start + k) * 4);
                    segment.push({
                        r: data[pIdx], g: data[pIdx+1], b: data[pIdx+2], a: data[pIdx+3],
                        bri: getBrightness(data[pIdx], data[pIdx+1], data[pIdx+2])
                    });
                }
                segment.sort((p1, p2) => p1.bri - p2.bri);
                for (let k = 0; k < spanLen; k++) {
                    const pIdx = rowOffset + ((start + k) * 4);
                    data[pIdx] = segment[k].r;
                    data[pIdx+1] = segment[k].g;
                    data[pIdx+2] = segment[k].b;
                    data[pIdx+3] = segment[k].a;
                }
             }
             start = -1;
           }
         }
       }
    }
  }

  // Vertical Sorting
  if (filters.pixelSortY > 0) {
      const colStep = Math.max(1, Math.floor(200 / (filters.pixelSortY + 1)));
      for (let x = 0; x < width; x += colStep) {
          let start = -1;
          for (let y = 0; y < height; y++) {
              const idx = (y * width + x) * 4;
              const b = getBrightness(data[idx], data[idx+1], data[idx+2]);
              
              if (b > filters.threshold) {
                  if (start < 0) start = y;
              } else {
                  if (start >= 0) {
                      const spanLen = y - start;
                      if (spanLen > 5) {
                          const segment = [];
                          for (let k = 0; k < spanLen; k++) {
                              const pIdx = ((start + k) * width + x) * 4;
                              segment.push({
                                  r: data[pIdx], g: data[pIdx+1], b: data[pIdx+2], a: data[pIdx+3],
                                  bri: getBrightness(data[pIdx], data[pIdx+1], data[pIdx+2])
                              });
                          }
                          segment.sort((p1, p2) => p1.bri - p2.bri);
                          for (let k = 0; k < spanLen; k++) {
                              const pIdx = ((start + k) * width + x) * 4;
                              data[pIdx] = segment[k].r;
                              data[pIdx+1] = segment[k].g;
                              data[pIdx+2] = segment[k].b;
                              data[pIdx+3] = segment[k].a;
                          }
                      }
                      start = -1;
                  }
              }
          }
      }
  }

  // 2. Color Cycle
  if (filters.colorCycle > 0) {
      const amount = (frameCount * filters.colorCycle * 0.05); 
      const c = Math.cos(amount);
      const s = Math.sin(amount);
      
      for (let i = 0; i < len; i += 4) {
          const bri = getBrightness(data[i], data[i+1], data[i+2]);
          if (bri > 0.1) {
              const r = data[i];
              const g = data[i+1];
              const b = data[i+2];
              
              data[i] = (r * c) + (g * s); 
              data[i+1] = (g * c) - (r * s); 
              data[i+2] = b + (Math.sin(amount * 2) * 50);
          }
      }
  }
  
  // 3. RGB Shift (Spatial)
  if (filters.rgbShift > 0) {
      const shift = Math.floor(filters.rgbShift);
      const tempCopy = new Uint8ClampedArray(data);
      for (let i = 0; i < len; i += 4) {
          const rIdx = i - (shift * 4);
          const rWrap = rIdx < 0 ? len + rIdx : rIdx;
          if (rIdx >= 0 && rIdx < len) data[i] = tempCopy[rIdx]; 
          else data[i] = tempCopy[rWrap]; 
          
          const bIdx = i + (shift * 4);
          const bWrap = bIdx >= len ? bIdx - len : bIdx;
          if (bIdx >= 0 && bIdx < len) data[i + 2] = tempCopy[bIdx + 2];
          else data[i + 2] = tempCopy[bWrap];
      }
  }

  // 4. Noise
  if (filters.noise > 0) {
      const amount = filters.noise * 255;
      for (let i = 0; i < len; i += 4) {
          const n = (Math.random() - 0.5) * amount;
          data[i] = Math.min(255, Math.max(0, data[i] + n));
          data[i+1] = Math.min(255, Math.max(0, data[i+1] + n));
          data[i+2] = Math.min(255, Math.max(0, data[i+2] + n));
      }
  }
  
  // 5. Datamosh (Pixel-level probability)
  if (filters.datamosh > 0) {
      const blockSize = 32;
      const threshold = 1 - filters.datamosh; 
      if (Math.random() > threshold) {
          const sourceX = Math.floor(Math.random() * (width - blockSize));
          const sourceY = Math.floor(Math.random() * (height - blockSize));
          const destX = Math.floor(Math.random() * (width - blockSize));
          const destY = Math.floor(Math.random() * (height - blockSize));

          for (let y = 0; y < blockSize; y++) {
              for (let x = 0; x < blockSize; x++) {
                  const sIdx = ((sourceY + y) * width + (sourceX + x)) * 4;
                  const dIdx = ((destY + y) * width + (destX + x)) * 4;
                  data[dIdx] = data[sIdx];
                  data[dIdx+1] = data[sIdx+1];
                  data[dIdx+2] = data[sIdx+2];
              }
          }
      }
  }

  // Temporal RGB Delay (Pixel-Level fallback if needed, but slow)
  // We handle RGB Delay via composite ops in applyTemporalEffects for speed.
  // So we skip it here.

  ctx.putImageData(imageData, 0, 0);
};
