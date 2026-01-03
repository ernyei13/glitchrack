export class MidiService {
  private access: MIDIAccess | null = null;
  private listeners: ((control: number, value: number, channel: number) => void)[] = [];

  constructor() {
    this.init();
  }

  async init() {
    try {
      if (navigator.requestMIDIAccess) {
        this.access = await navigator.requestMIDIAccess();
        this.access.inputs.forEach((input) => {
          input.onmidimessage = this.handleMessage.bind(this);
        });
        console.log("MIDI Access Granted");
      }
    } catch (e) {
      console.warn("MIDI Access Failed", e);
    }
  }

  private handleMessage(event: MIDIMessageEvent) {
    const [status, control, value] = event.data;
    // Launchpad Control XL usually sends on Channel 1 (176 for CC) or Channel 9 (144 for Note)
    // We filter for Control Change messages (176-191) and Note Ons (144-159)
    // Some buttons send Note On, some send CC depending on factory map.
    
    // Normalize value to 0-1
    const normalized = value / 127;
    
    // Handle CC
    if (status >= 176 && status <= 191) {
      this.notify(control, normalized, status & 0xf);
    }
    // Handle Note On (for buttons mapped as notes)
    else if (status >= 144 && status <= 159) {
      this.notify(control, normalized, status & 0xf);
    }
  }

  public onMessage(callback: (control: number, value: number, channel: number) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notify(control: number, value: number, channel: number) {
    this.listeners.forEach(cb => cb(control, value, channel));
  }
}

// Launchpad Control XL Mapping (Factory Template 1)
// Knobs Top: 13-20
// Knobs Mid: 29-36
// Knobs Bot: 49-56
// Faders: 77-84
// Track Focus Buttons (Bottom Row): 41-48
// Track Control Buttons (Under Knobs): 73-76 (often varying)
export const CONTROL_XL_MAP = {
  KNOBS_TOP: [13, 14, 15, 16, 17, 18, 19, 20],
  KNOBS_MID: [29, 30, 31, 32, 33, 34, 35, 36],
  KNOBS_BOT: [49, 50, 51, 52, 53, 54, 55, 56],
  FADERS: [77, 78, 79, 80, 81, 82, 83, 84],
  BUTTONS_TRACK: [41, 42, 43, 44, 45, 46, 47, 48]
};

// Flattened list for linear mapping logic
export const ALL_CONTROLS = [
  ...CONTROL_XL_MAP.KNOBS_TOP,
  ...CONTROL_XL_MAP.KNOBS_MID,
  ...CONTROL_XL_MAP.KNOBS_BOT,
  ...CONTROL_XL_MAP.FADERS,
  ...CONTROL_XL_MAP.BUTTONS_TRACK
];