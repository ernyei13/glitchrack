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
    // Launchpad Control XL usually sends on Channel 1 (176 for CC) or Channel 9
    // We filter for Control Change messages (176-191)
    if (status >= 176 && status <= 191) {
      // Normalize value to 0-1
      const normalized = value / 127;
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

// Launchpad Control XL Mapping
// Knobs Top: 13-20
// Knobs Mid: 29-36
// Knobs Bot: 49-56
// Faders: 77-84
export const CONTROL_XL_MAP = {
  KNOBS_TOP: [13, 14, 15, 16, 17, 18, 19, 20],
  KNOBS_MID: [29, 30, 31, 32, 33, 34, 35, 36],
  KNOBS_BOT: [49, 50, 51, 52, 53, 54, 55, 56],
  FADERS: [77, 78, 79, 80, 81, 82, 83, 84]
};

// Flattened list for linear mapping
export const ALL_CONTROLS = [
  ...CONTROL_XL_MAP.KNOBS_TOP,
  ...CONTROL_XL_MAP.KNOBS_MID,
  ...CONTROL_XL_MAP.KNOBS_BOT,
  ...CONTROL_XL_MAP.FADERS
];
