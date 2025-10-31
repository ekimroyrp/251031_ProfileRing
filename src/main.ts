import "./style.css";
import { ProfileEditor } from "./profileEditor";
import { RingScene } from "./ringScene";
import { UIControls } from "./uiControls";
import { RingParameters } from "./types";

function bootstrap(): void {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app container.");
  }

  root.innerHTML = `
    <div class="app-shell">
      <section class="viewport" data-role="viewport"></section>
      <section class="overlay">
        <canvas class="profile-editor" width="220" height="220"></canvas>
        <div class="panel" data-role="controls"></div>
      </section>
    </div>
  `;

  const viewport = root.querySelector<HTMLElement>('[data-role="viewport"]');
  const canvas = root.querySelector<HTMLCanvasElement>(".profile-editor");
  const controlsContainer = root.querySelector<HTMLElement>('[data-role="controls"]');

  if (!viewport || !canvas || !controlsContainer) {
    throw new Error("Failed to initialize application layout.");
  }

  const profileEditor = new ProfileEditor(canvas);
  const uiControls = new UIControls(controlsContainer);
  const ringScene = new RingScene(viewport);

  let currentProfile = profileEditor.getPoints();
  let currentParameters: RingParameters = uiControls.value();

  const updateRing = () => ringScene.updateProfile(currentProfile, currentParameters);

  profileEditor.onChange((points) => {
    currentProfile = points;
    updateRing();
  });

  uiControls.onChange((parameters) => {
    currentParameters = parameters;
    updateRing();
  });

  updateRing();
}

bootstrap();
