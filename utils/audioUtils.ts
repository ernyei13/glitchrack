export const getAudioEnergy = (analyser: AnalyserNode, dataArray: Uint8Array) => {
  analyser.getByteFrequencyData(dataArray);
  
  const length = dataArray.length;
  // Simple 3-band split based on typical FFT bin distribution
  // Low end is usually compressed in the first few bins
  const bassEnd = Math.floor(length * 0.1); 
  const midEnd = Math.floor(length * 0.5);
  
  let bass = 0;
  let mid = 0;
  let treble = 0;
  
  for(let i=0; i < length; i++) {
      // Normalize 0-255 to 0.0-1.0
      const val = dataArray[i] / 255.0;
      if (i < bassEnd) {
          bass += val;
      } else if (i < midEnd) {
          mid += val;
      } else {
          treble += val;
      }
  }
  
  return {
      bass: bassEnd > 0 ? bass / bassEnd : 0,
      mid: midEnd > bassEnd ? mid / (midEnd - bassEnd) : 0,
      treble: length > midEnd ? treble / (length - midEnd) : 0
  };
};
