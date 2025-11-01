import { RingParameters } from "./types";

type ParametersListener = (parameters: RingParameters) => void;

export class UIControls {
  private readonly container: HTMLElement;
  private readonly inputs: Record<keyof RingParameters, HTMLInputElement>;
  private readonly outputs: Record<keyof RingParameters, HTMLOutputElement>;
  private readonly listeners = new Set<ParametersListener>();
  private readonly scrollViewport: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    const { inputs, outputs, viewport } = this.createInputs();
    this.inputs = inputs;
    this.outputs = outputs;
    this.scrollViewport = viewport;
    this.bindEvents();
    this.emit();
  }

  public onChange(listener: ParametersListener): () => void {
    this.listeners.add(listener);
    listener(this.value());
    return () => this.listeners.delete(listener);
  }

  public value(): RingParameters {
    return {
      radialSegments: Number(this.inputs.radialSegments.value),
      twistDegrees: Number(this.inputs.twistDegrees.value),
      profileScale: Number(this.inputs.profileScale.value),
      taper: Number(this.inputs.taper.value),
      ringRadius: Number(this.inputs.ringRadius.value),
      thickness: Number(this.inputs.thickness.value),
      arcDegrees: Number(this.inputs.arcDegrees.value),
      scaleVariance: Number(this.inputs.scaleVariance.value),
      scaleFrequency: Number(this.inputs.scaleFrequency.value),
      tiltVariance: Number(this.inputs.tiltVariance.value),
      tiltFrequency: Number(this.inputs.tiltFrequency.value)
    };
  }

  private bindEvents(): void {
    (Object.entries(this.inputs) as Array<[keyof RingParameters, HTMLInputElement]>).forEach(
      ([key, input]) => {
        input.addEventListener("input", () => {
          input.dataset.value = input.value;
          this.outputs[key].textContent = input.dataset.value ?? input.value;
          this.emit();
        });
      }
    );
  }

  private emit(): void {
    const parameters = this.value();
    this.listeners.forEach((listener) => listener(parameters));
    this.updateLabels(parameters);
  }

  private updateLabels(parameters: RingParameters): void {
    const labelMap: Record<keyof RingParameters, string> = {
      radialSegments: `${parameters.radialSegments}`,
      twistDegrees: `${parameters.twistDegrees.toFixed(0)}°`,
      profileScale: `${parameters.profileScale.toFixed(2)}×`,
      taper: `${parameters.taper.toFixed(2)}`,
      ringRadius: `${parameters.ringRadius.toFixed(2)}u`,
      thickness: `${parameters.thickness.toFixed(2)}×`,
      arcDegrees: `${parameters.arcDegrees.toFixed(0)}°`,
      scaleVariance: `${parameters.scaleVariance.toFixed(2)}×`,
      scaleFrequency: `${parameters.scaleFrequency.toFixed(1)}×`,
      tiltVariance: `${parameters.tiltVariance.toFixed(1)}°`,
      tiltFrequency: `${parameters.tiltFrequency.toFixed(1)}×`
    };

    (Object.keys(labelMap) as Array<keyof RingParameters>).forEach((key) => {
      const text = labelMap[key];
      this.inputs[key].dataset.value = text;
      this.outputs[key].textContent = text;
    });
  }

  private createInputs(): {
    inputs: Record<keyof RingParameters, HTMLInputElement>;
    outputs: Record<keyof RingParameters, HTMLOutputElement>;
    viewport: HTMLElement;
  } {
    this.container.innerHTML = `
      <h2>Ring Array</h2>
      <div class="controls-scroll">
        <div class="controls-scroll__viewport" tabindex="0">
          <label data-control="radialSegments">
            <span>Profiles</span>
            <input type="range" min="12" max="256" step="1" value="96" />
          </label>
          <label data-control="twistDegrees">
            <span>Twist</span>
            <input type="range" min="-720" max="720" step="1" value="0" />
          </label>
          <label data-control="profileScale">
            <span>Scale</span>
            <input type="range" min="0.25" max="1.5" step="0.01" value="0.6" />
          </label>
          <label data-control="taper">
            <span>Taper</span>
            <input type="range" min="-1" max="1" step="0.01" value="0" />
          </label>
          <label data-control="ringRadius">
            <span>Ring Radius</span>
            <input type="range" min="0.6" max="3" step="0.01" value="1.5" />
          </label>
          <label data-control="thickness">
            <span>Thickness</span>
            <input type="range" min="0.5" max="2" step="0.01" value="1" />
          </label>
          <label data-control="arcDegrees">
            <span>Arc Span</span>
            <input type="range" min="30" max="360" step="1" value="360" />
          </label>
          <label data-control="scaleVariance">
            <span>Scale Variance</span>
            <input type="range" min="0" max="0.6" step="0.01" value="0" />
          </label>
          <label data-control="scaleFrequency">
            <span>Scale Frequency</span>
            <input type="range" min="0" max="6" step="0.1" value="1.5" />
          </label>
          <label data-control="tiltVariance">
            <span>Tilt Variance</span>
            <input type="range" min="0" max="35" step="0.5" value="0" />
          </label>
          <label data-control="tiltFrequency">
            <span>Tilt Frequency</span>
            <input type="range" min="0" max="6" step="0.1" value="1.5" />
          </label>
        </div>
      </div>
    `;

    const entries = Array.from(
      this.container.querySelectorAll<HTMLLabelElement>(".controls-scroll__viewport label[data-control]")
    ).map((label) => {
      const key = label.dataset.control as keyof RingParameters;
      const input = label.querySelector("input");
      const span = label.querySelector("span");

      if (!input || !span) {
        throw new Error(`Missing input/span for ${key}`);
      }

      input.dataset.value = input.value;
      const output = document.createElement("output");
      output.textContent = input.value;
      span.append(output);

      return [key, input, output] as const;
    });

    const inputs = Object.fromEntries(entries.map(([key, input]) => [key, input])) as Record<
      keyof RingParameters,
      HTMLInputElement
    >;

    const outputs = Object.fromEntries(entries.map(([key, , output]) => [key, output])) as Record<
      keyof RingParameters,
      HTMLOutputElement
    >;

    const viewport = this.container.querySelector<HTMLElement>(".controls-scroll__viewport");
    if (!viewport) {
      throw new Error("Missing controls scroll viewport.");
    }

    return {
      inputs,
      outputs,
      viewport
    };
  }

  public refreshScrollMetrics(): void {
    const maxScroll = Math.max(0, this.scrollViewport.scrollHeight - this.scrollViewport.clientHeight);
    if (maxScroll === 0) {
      this.scrollViewport.scrollTop = 0;
      return;
    }
    this.scrollViewport.scrollTop = Math.min(this.scrollViewport.scrollTop, maxScroll);
  }
}
