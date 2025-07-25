export class TiltDetector extends EventTarget {
  /**
   * @param {object} options
   * @param {number} [options.threshold=50] Angle offset from 90° to detect up/down
   * @param {number} [options.frequency=60] Sensor update frequency (Hz)
   */
  constructor({ threshold = 50, frequency = 60 } = {}) {
    super();
    this.threshold = threshold;
    this.frequency = frequency;
    this.sensor = null;
    this._tiltState = "neutral";
  }

  async start() {
    if (!("AbsoluteOrientationSensor" in window)) {
      throw new Error("AbsoluteOrientationSensor not supported");
    }
    // request permission if needed
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const granted = await DeviceOrientationEvent.requestPermission();
      if (granted !== "granted") {
        throw new Error("Permission to use sensor denied");
      }
    }

    this.sensor = new AbsoluteOrientationSensor({ frequency: this.frequency });
    this.sensor.addEventListener("reading", () => this._onReading());
    this.sensor.addEventListener("error", (e) => {
      this.dispatchEvent(new CustomEvent("error", { detail: e.error }));
    });
    this.sensor.start();
  }

  stop() {
    if (this.sensor) {
      this.sensor.stop();
      this.sensor = null;
      this._tiltState = "neutral";
    }
  }

  _onReading() {
    const [x, y, ,] = this.sensor.quaternion;

    // world‑Z of device’s +Z axis
    const zCompRaw = 1 - 2 * (x * x + y * y);
    const zComp = Math.min(1, Math.max(-1, zCompRaw));
    const angleDeg = (Math.acos(zComp) * 180) / Math.PI;

    let newState = "neutral";
    if (angleDeg > 90 + this.threshold) newState = "down";
    else if (angleDeg < 90 - this.threshold) newState = "up";

    if (newState !== this._tiltState) {
      this._tiltState = newState;
      this.dispatchEvent(
        new CustomEvent(
          {
            up: "tiltup",
            down: "tiltdown",
            neutral: "neutral",
          }[newState],
          { detail: { angle: angleDeg } }
        )
      );
    }
  }
}
