import "./style.css";
import { ProfileEditor } from "./profileEditor";
import { RingScene } from "./ringScene";
import { UIControls } from "./uiControls";
import { RingParameters } from "./types";
import { DEFAULT_PRESET_ID, PROFILE_PRESETS, getPresetVectors } from "./profilePresets";

function bootstrap(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app container.");
  }

  root.innerHTML = `
    <div class="app-shell">
      <div class="hud">
        <h1>Profile Ring Designer</h1>
        <p>Drag profile nodes, adjust sliders, and orbit to preview the generated ring.</p>
      </div>
      <section class="viewport" data-role="viewport"></section>
      <section class="overlay">
        <div class="panel" data-role="controls"></div>
        <div class="profile-suite">
          <canvas class="profile-editor" width="220" height="220"></canvas>
          <div class="profile-actions">
            <div class="profile-buttons">
              <button type="button" data-action="add-point">Add Point</button>
              <button type="button" data-action="remove-point">Remove Point</button>
            </div>
            <label class="profile-preset">
              <span>Preset</span>
              <select data-role="preset"></select>
            </label>
          </div>
        </div>
      </section>
    </div>
  `;

  const viewport = root.querySelector<HTMLElement>('[data-role="viewport"]');
  const canvas = root.querySelector<HTMLCanvasElement>(".profile-editor");
  const controlsContainer = root.querySelector<HTMLElement>('[data-role="controls"]');
  const addButton = root.querySelector<HTMLButtonElement>('[data-action="add-point"]');
  const removeButton = root.querySelector<HTMLButtonElement>('[data-action="remove-point"]');
  const presetSelect = root.querySelector<HTMLSelectElement>('[data-role="preset"]');

  if (!viewport || !canvas || !controlsContainer || !addButton || !removeButton || !presetSelect) {
    throw new Error("Failed to initialize application layout.");
  }

  const profileEditor = new ProfileEditor(canvas);
  const uiControls = new UIControls(controlsContainer);
  const ringScene = new RingScene(viewport);

  let currentProfile = profileEditor.getPoints();
  let currentParameters: RingParameters = uiControls.value();

  const updateRing = () => ringScene.updateProfile(currentProfile, currentParameters);

  const refreshProfileActions = () => {
    removeButton.disabled = !profileEditor.canRemovePoint();
    addButton.disabled = !profileEditor.canAddPoint();
  };

  PROFILE_PRESETS.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    presetSelect.append(option);
  });

  presetSelect.value = DEFAULT_PRESET_ID;

  addButton.addEventListener("click", () => {
    profileEditor.addPoint();
  });

  removeButton.addEventListener("click", () => {
    profileEditor.removeSelectedPoint();
  });

  presetSelect.addEventListener("change", () => {
    const selected = presetSelect.value;
    profileEditor.applyPreset(getPresetVectors(selected));
  });

  profileEditor.onChange((points) => {
    currentProfile = points;
    refreshProfileActions();
    updateRing();
  });

  profileEditor.onSelectionChange(() => {
    refreshProfileActions();
  });

  uiControls.onChange((parameters) => {
    currentParameters = parameters;
    updateRing();
  });

  refreshProfileActions();
  updateRing();
}

bootstrap();
