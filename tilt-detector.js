export class TiltDetector extends EventTarget {
  /**
   * @param {object} options
   * @param {number} [options.threshold=50] Angle offset from 90° to detect up/down
   * @param {number} [options.resetThreshold=threshold/2] Angle offset from 90° to reset back to neutral
   * @param {number} [options.frequency=60] Sensor update frequency (Hz)
   */
  constructor({ threshold = 50, resetThreshold = 25, frequency = 60 } = {}) {
    super();
    this.threshold = threshold;
    // If resetThreshold isn't provided, default to half of threshold
    this.resetThreshold =
      resetThreshold !== undefined ? resetThreshold : threshold / 2;
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
    const [x, y] = this.sensor.quaternion;

    // world‑Z of device’s +Z axis
    const zCompRaw = 1 - 2 * (x * x + y * y);
    const zComp = Math.min(1, Math.max(-1, zCompRaw));
    const angleDeg = (Math.acos(zComp) * 180) / Math.PI;

    // difference from 90°
    const diff = angleDeg - 90;
    let newState;

    switch (this._tiltState) {
      case "neutral":
        if (diff > this.threshold) newState = "down";
        else if (diff < -this.threshold) newState = "up";
        else newState = "neutral";
        break;

      case "up":
        // require coming closer to neutral by resetThreshold before resetting
        if (diff > -this.resetThreshold) newState = "neutral";
        else newState = "up";
        break;

      case "down":
        // require coming closer to neutral by resetThreshold before resetting
        if (diff < this.resetThreshold) newState = "neutral";
        else newState = "down";
        break;

      default:
        newState = "neutral";
    }

    if (newState !== this._tiltState) {
      this._tiltState = newState;
      const eventMap = {
        up: "tiltup",
        down: "tiltdown",
        neutral: "neutral",
      };
      this.dispatchEvent(
        new CustomEvent(eventMap[newState], { detail: { angle: angleDeg } })
      );
    }
  }
}
