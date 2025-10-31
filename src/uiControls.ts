import { RingParameters } from "./types";

type ParametersListener = (parameters: RingParameters) => void;

export class UIControls {
  private readonly container: HTMLElement;
  private readonly inputs: Record<keyof RingParameters, HTMLInputElement>;
  private readonly outputs: Record<keyof RingParameters, HTMLOutputElement>;
  private readonly listeners = new Set<ParametersListener>();

  constructor(container: HTMLElement) {
    this.container = container;
    const { inputs, outputs } = this.createInputs();
    this.inputs = inputs;
    this.outputs = outputs;
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
      taper: Number(this.inputs.taper.value)
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
      taper: `${parameters.taper.toFixed(2)}`
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
  } {
    this.container.innerHTML = `
      <h2>Ring Array</h2>
      <label data-control="radialSegments">
        <span>Profiles</span>
        <input type="range" min="12" max="256" step="1" value="96" />
        <output></output>
      </label>
      <label data-control="twistDegrees">
        <span>Twist</span>
        <input type="range" min="-720" max="720" step="1" value="0" />
        <output></output>
      </label>
      <label data-control="profileScale">
        <span>Scale</span>
        <input type="range" min="0.25" max="1.5" step="0.01" value="0.6" />
        <output></output>
      </label>
      <label data-control="taper">
        <span>Taper</span>
        <input type="range" min="-1" max="1" step="0.01" value="0" />
        <output></output>
      </label>
    `;

    const entries = Array.from(
      this.container.querySelectorAll<HTMLLabelElement>("label[data-control]")
    ).map((label) => {
      const key = label.dataset.control as keyof RingParameters;
      const input = label.querySelector("input");
      const output = label.querySelector("output");

      if (!input || !output) {
        throw new Error(`Missing input/output for ${key}`);
      }

      input.dataset.value = input.value;
      output.textContent = input.value;

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

    return { inputs, outputs };
  }
}
