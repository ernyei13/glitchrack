import { GoogleGenAI, Type } from "@google/genai";
import { FilterState, INITIAL_FILTERS } from "../types";

const createClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in environment variables. AI features will be disabled.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateGlitchConfig = async (prompt: string): Promise<Partial<FilterState> | null> => {
  const ai = createClient();
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a configuration for a video glitch effect based on this description: "${prompt}".
      
      Return a JSON object with values tailored to the mood.
      - tileCount: 1 to 20
      - mirror: 0, 1, or 2
      - pixelSortX: 0 to 200 
      - pixelSortY: 0 to 200 
      - threshold: 0.0 to 1.0 
      - datamosh: 0 to 1.0 
      - rgbShift: 0 to 100 
      - noise: 0 to 1.0 
      - wobble: 0 to 10.0
      - melt: 0 to 10.0
      - ghost: 0 to 0.99
      - colorCycle: 0 to 20.0
      - jitter: 0 to 10.0 (Scanline displacement)
      - shatter: 0 to 1.0 (Block displacement)
      - feedbackZoom: -0.5 to 0.5 (Tunnel zoom)
      - slitScan: 0 to 1.0 (Time displacement)
      - rgbDelay: 0 to 1.0 (Temporal ghosting)
      - contrast: 50 to 500 
      - brightness: 50 to 500 
      - saturation: 0 to 500 
      - hue: 0 to 360 
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tileCount: { type: Type.NUMBER },
            mirror: { type: Type.NUMBER },
            pixelSortX: { type: Type.NUMBER },
            pixelSortY: { type: Type.NUMBER },
            threshold: { type: Type.NUMBER },
            datamosh: { type: Type.NUMBER },
            rgbShift: { type: Type.NUMBER },
            noise: { type: Type.NUMBER },
            wobble: { type: Type.NUMBER },
            melt: { type: Type.NUMBER },
            ghost: { type: Type.NUMBER },
            colorCycle: { type: Type.NUMBER },
            jitter: { type: Type.NUMBER },
            shatter: { type: Type.NUMBER },
            feedbackZoom: { type: Type.NUMBER },
            slitScan: { type: Type.NUMBER },
            rgbDelay: { type: Type.NUMBER },
            contrast: { type: Type.NUMBER },
            brightness: { type: Type.NUMBER },
            saturation: { type: Type.NUMBER },
            hue: { type: Type.NUMBER },
          },
          required: ["pixelSortX", "threshold", "contrast", "brightness"],
        },
      },
    });

    const text = response.text;
    if (!text) return null;
    
    const data = JSON.parse(text);
    return { ...INITIAL_FILTERS, ...data };
  } catch (error) {
    console.error("Failed to generate glitch config:", error);
    return null;
  }
};
