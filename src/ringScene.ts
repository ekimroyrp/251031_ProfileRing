import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  Quaternion,
  Vector2,
  Vector3,
  WebGLRenderer
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RingParameters } from "./types";

const TAU = Math.PI * 2;
interface Size {
  width: number;
  height: number;
}

export class RingScene {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly ringMaterial: MeshPhysicalMaterial;
  private readonly scratchTextures: ScratchTextures;

  private ringMesh: Mesh<BufferGeometry, MeshPhysicalMaterial> | null = null;
  private animationId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.renderer = new WebGLRenderer({ antialias: true, canvas: this.canvas });
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.physicallyCorrectLights = true;
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(45, 1, 0.1, 100);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.scratchTextures = createScratchTextures();
    this.ringMaterial = createGoldMaterial(this.renderer, this.scratchTextures);

    this.setupScene();
    this.container.appendChild(this.canvas);
    this.onResize();
    window.addEventListener("resize", () => this.onResize());
    this.start();
  }

  public updateProfile(points: Vector2[], parameters: RingParameters): void {
    if (!points.length) {
      return;
    }

    const geometry = buildRingGeometry(points, parameters);

    if (this.ringMesh) {
      this.ringMesh.geometry.dispose();
      this.ringMesh.geometry = geometry;
      return;
    }

    this.ringMesh = new Mesh(geometry, this.ringMaterial);
    this.scene.add(this.ringMesh);
  }

  private setupScene(): void {
    this.scene.background = new Color("#060810");
    this.applyEnvironment();

    this.camera.position.set(4, 2.5, 4);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    const ambient = new AmbientLight("#ffffff", 0.4);
    const keyLight = new DirectionalLight("#f8fafc", 1.2);
    keyLight.position.set(4, 6, 3);

    this.scene.add(ambient, keyLight);
  }

  private applyEnvironment(): void {
    const pmrem = new PMREMGenerator(this.renderer);
    const environmentRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = environmentRT.texture;
    pmrem.dispose();
  }

  private start(): void {
    const render = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.animationId = requestAnimationFrame(render);
    };

    render();
  }

  private onResize(): void {
    const { width, height } = this.measure();
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private measure(): Size {
    const rect = this.container.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }
}

function buildRingGeometry(points: Vector2[], parameters: RingParameters): BufferGeometry {
  const closed = parameters.arcDegrees >= 359.9;
  const arcDegrees = Math.min(parameters.arcDegrees, 360);
  const arcFraction = closed ? 1 : arcDegrees / 360;
  const baseSegments = Math.max(2, Math.floor(parameters.radialSegments * arcFraction));
  const radialSegments = Math.max(closed ? 3 : 2, baseSegments);
  const arcRadians = closed ? TAU : (arcDegrees * Math.PI) / 180;
  const profile = ensureClosedProfile(ensureCounterClockwise(sampleProfile(points)));
  const profileSegments = profile.length;
  const twistRadians = (parameters.twistDegrees * Math.PI) / 180;
  const tiltAmplitude = (parameters.tiltVariance * Math.PI) / 180;
  const scaleVariance = parameters.scaleVariance;
  const scaleFrequency = Math.max(0, parameters.scaleFrequency);
  const tiltFrequency = Math.max(0, parameters.tiltFrequency);

  const vertexCount = radialSegments * profileSegments;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  const baseRadial = new Vector3();
  const binormal = new Vector3(0, 1, 0);
  const radialTilted = new Vector3();
  const binormalTilted = new Vector3();
  const tangent = new Vector3();
  const center = new Vector3();
  const offset = new Vector3();
  const twisted = new Vector2();
  const tiltQuaternion = new Quaternion();
  const baseScaleClamp = Math.max(0.05, parameters.profileScale);

  for (let segment = 0; segment < radialSegments; segment += 1) {
    const segmentT = closed ? segment / radialSegments : segment / (radialSegments - 1);
    const angle = closed ? segmentT * TAU : segmentT * arcRadians;
    const ramp = symmetricRamp(segmentT);
    const twist = twistRadians * ramp;
    const cosTwist = Math.cos(twist);
    const sinTwist = Math.sin(twist);
    const scaleFactor = Math.max(0.2, 1 + parameters.taper * ramp);
    const scaleWave =
      1 + scaleVariance * Math.sin(segmentT * scaleFrequency * TAU);
    const localScale = baseScaleClamp * scaleFactor * Math.max(0.25, scaleWave);

    baseRadial.set(Math.cos(angle), 0, Math.sin(angle));
    center.copy(baseRadial).multiplyScalar(parameters.ringRadius);
    tangent.set(-Math.sin(angle), 0, Math.cos(angle));

    const tiltAngle =
      tiltAmplitude * Math.sin(segmentT * tiltFrequency * TAU);
    if (Math.abs(tiltAngle) > 1e-4) {
      tiltQuaternion.setFromAxisAngle(tangent, tiltAngle);
      radialTilted.copy(baseRadial).applyQuaternion(tiltQuaternion);
      binormalTilted.copy(binormal).applyQuaternion(tiltQuaternion);
    } else {
      radialTilted.copy(baseRadial);
      binormalTilted.copy(binormal);
    }

    for (let i = 0; i < profileSegments; i += 1) {
      const point = profile[i];
      twisted.set(
        point.x * cosTwist - point.y * sinTwist,
        point.x * sinTwist + point.y * cosTwist
      );

      offset
        .copy(radialTilted)
        .multiplyScalar(twisted.x * localScale * parameters.thickness)
        .addScaledVector(binormalTilted, twisted.y * localScale);

      const vertexIndex = segment * profileSegments + i;
      const vertexOffset = vertexIndex * 3;
      positions[vertexOffset] = center.x + offset.x;
      positions[vertexOffset + 1] = center.y + offset.y;
      positions[vertexOffset + 2] = center.z + offset.z;

      const uvOffset = vertexIndex * 2;
      uvs[uvOffset] = i / (profileSegments - 1);
      uvs[uvOffset + 1] = segmentT;
    }
  }

  for (let segment = 0; segment < radialSegments; segment += 1) {
    const isLast = segment === radialSegments - 1;
    const nextSegment = closed ? (segment + 1) % radialSegments : segment + 1;
    if (!closed && isLast) {
      continue;
    }
    for (let i = 0; i < profileSegments - 1; i += 1) {
      const nextIndex = i + 1;
      const a = segment * profileSegments + i;
      const b = nextSegment * profileSegments + i;
      const c = nextSegment * profileSegments + nextIndex;
      const d = segment * profileSegments + nextIndex;

      indices.push(a, d, b, b, d, c);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function sampleProfile(points: Vector2[]): Vector2[] {
  if (points.length < 3) {
    return points.map((point) => point.clone());
  }

  const curvePoints = points.map((point) => new Vector3(point.x, point.y, 0));
  const curve = new CatmullRomCurve3(curvePoints, true, "catmullrom", 0.5);
  const segments = Math.max(curvePoints.length * 12, 96);
  const sampled = curve.getPoints(segments).map((vertex) => new Vector2(vertex.x, vertex.y));

  if (
    sampled.length > 1 &&
    sampled[0].distanceToSquared(sampled[sampled.length - 1]) < Number.EPSILON
  ) {
    sampled.pop();
  }

  return sampled;
}

function ensureClosedProfile(points: Vector2[]): Vector2[] {
  const result = points.map((point) => point.clone());
  const first = result[0];
  const last = result[result.length - 1];

  if (!first.equals(last)) {
    result.push(first.clone());
  }

  return result;
}

function ensureCounterClockwise(points: Vector2[]): Vector2[] {
  if (points.length < 3) {
    return points;
  }

  const area = signedArea(points);
  if (area >= 0) {
    return points;
  }

  const reversed = points.slice().reverse();
  return reversed;
}

function signedArea(points: Vector2[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function symmetricRamp(value: number): number {
  const normalized = value - Math.floor(value);
  if (normalized <= 0.5) {
    const t = normalized / 0.5;
    return smoothstep01(t);
  }

  const t = (normalized - 0.5) / 0.5;
  return smoothstep01(1 - t);
}

function smoothstep01(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

interface ScratchTextures {
  normalMap: CanvasTexture;
  roughnessMap: CanvasTexture;
}

function createGoldMaterial(renderer: WebGLRenderer, textures: ScratchTextures): MeshPhysicalMaterial {
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  textures.normalMap.wrapS = textures.normalMap.wrapT = RepeatWrapping;
  textures.roughnessMap.wrapS = textures.roughnessMap.wrapT = RepeatWrapping;
  textures.normalMap.repeat.set(2.5, 2.5);
  textures.roughnessMap.repeat.set(2.5, 2.5);
  textures.normalMap.anisotropy = anisotropy;
  textures.roughnessMap.anisotropy = anisotropy;

  return new MeshPhysicalMaterial({
    color: new Color("#d4af6a"),
    metalness: 1,
    roughness: 0.24,
    roughnessMap: textures.roughnessMap,
    normalMap: textures.normalMap,
    normalScale: new Vector2(0.2, 0.2),
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.7,
    sheen: 0.08,
    sheenColor: new Color("#f6dc9c")
  });
}

function createScratchTextures(size = 256): ScratchTextures {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Failed to create roughness canvas context.");
  }

  ctx.fillStyle = "rgb(138, 126, 108)";
  ctx.fillRect(0, 0, size, size);

  const lineCount = Math.floor(size * 1.4);
  for (let i = 0; i < lineCount; i += 1) {
    const y = Math.random() * size;
    const length = size * (0.3 + Math.random() * 0.35);
    const angle = (Math.random() - 0.5) * 0.25;
    const lineWidth = 0.05 + Math.random() * 0.35;
    const brightness = 180 + Math.random() * 45;
    const alpha = 0.05 + Math.random() * 0.15;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.random() * size, y);
    ctx.rotate(angle);
    ctx.strokeStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(-length * 0.5, 0);
    ctx.lineTo(length * 0.5, 0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "rgba(40, 37, 33, 1)";
  const speckCount = Math.floor(size * 0.3);
  for (let i = 0; i < speckCount; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const width = size * (0.05 + Math.random() * 0.04);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.6);
    ctx.fillRect(-width * 0.5, -0.6, width, 1.2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  const roughnessTexture = new CanvasTexture(canvas);
  roughnessTexture.needsUpdate = true;

  const imageData = ctx.getImageData(0, 0, size, size);
  const heightData = new Float32Array(size * size);
  for (let i = 0; i < size * size; i += 1) {
    const offset = i * 4;
    const r = imageData.data[offset];
    const g = imageData.data[offset + 1];
    const b = imageData.data[offset + 2];
    heightData[i] = (r + g + b) / (3 * 255);
  }

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = size;
  normalCanvas.height = size;
  const normalCtx = normalCanvas.getContext("2d");
  if (!normalCtx) {
    throw new Error("Failed to create normal canvas context.");
  }

  const normalImage = normalCtx.createImageData(size, size);
  const normalData = normalImage.data;
  const strength = 4.5;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const left = heightData[y * size + ((x - 1 + size) % size)];
      const right = heightData[y * size + ((x + 1) % size)];
      const up = heightData[((y - 1 + size) % size) * size + x];
      const down = heightData[((y + 1) % size) * size + x];

      const dx = (right - left) * strength;
      const dy = (down - up) * strength;
      const dz = 1;

      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx = dx * invLen;
      const ny = dy * invLen;
      const nz = dz * invLen;

      const index = (y * size + x) * 4;
      normalData[index] = (nx * 0.5 + 0.5) * 255;
      normalData[index + 1] = (ny * 0.5 + 0.5) * 255;
      normalData[index + 2] = (nz * 0.5 + 0.5) * 255;
      normalData[index + 3] = 255;
    }
  }

  normalCtx.putImageData(normalImage, 0, 0);
  const normalTexture = new CanvasTexture(normalCanvas);
  normalTexture.needsUpdate = true;

  return { normalMap: normalTexture, roughnessMap: roughnessTexture };
}
