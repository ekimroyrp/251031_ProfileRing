import {
  AmbientLight,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RingParameters } from "./types";

const TAU = Math.PI * 2;
const DEFAULT_RING_RADIUS = 1.5;

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
  private readonly ringMaterial: MeshStandardMaterial;

  private ringMesh: Mesh<BufferGeometry, MeshStandardMaterial> | null = null;
  private animationId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.renderer = new WebGLRenderer({ antialias: true, canvas: this.canvas });
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(45, 1, 0.1, 100);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.ringMaterial = new MeshStandardMaterial({
      color: new Color("#38bdf8"),
      roughness: 0.35,
      metalness: 0.7
    });

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
    this.scene.background = new Color("#0b1120");

    this.camera.position.set(4, 2.5, 4);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    const ambient = new AmbientLight("#ffffff", 0.4);
    const keyLight = new DirectionalLight("#f8fafc", 1.2);
    keyLight.position.set(4, 6, 3);

    this.scene.add(ambient, keyLight);
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
  const radialSegments = Math.max(8, Math.floor(parameters.radialSegments));
  const profile = ensureClosedProfile(sampleProfile(points));
  const profileSegments = profile.length;
  const twistRadians = (parameters.twistDegrees * Math.PI) / 180;

  const vertexCount = radialSegments * profileSegments;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  const radial = new Vector3();
  const binormal = new Vector3(0, 1, 0);
  const center = new Vector3();
  const offset = new Vector3();
  const twisted = new Vector2();

  for (let segment = 0; segment < radialSegments; segment += 1) {
    const v = segment / radialSegments;
    const angle = v * TAU;
    const twist = twistRadians * v;
    const cosTwist = Math.cos(twist);
    const sinTwist = Math.sin(twist);
    const localScale = parameters.profileScale * (1 + parameters.taper * (v - 0.5));

    radial.set(Math.cos(angle), 0, Math.sin(angle));
    center.copy(radial).multiplyScalar(DEFAULT_RING_RADIUS);

    for (let i = 0; i < profileSegments; i += 1) {
      const point = profile[i];
      twisted.set(
        point.x * cosTwist - point.y * sinTwist,
        point.x * sinTwist + point.y * cosTwist
      );

      offset
        .copy(radial)
        .multiplyScalar(twisted.x * localScale)
        .addScaledVector(binormal, twisted.y * localScale);

      const vertexIndex = segment * profileSegments + i;
      const vertexOffset = vertexIndex * 3;
      positions[vertexOffset] = center.x + offset.x;
      positions[vertexOffset + 1] = center.y + offset.y;
      positions[vertexOffset + 2] = center.z + offset.z;

      const uvOffset = vertexIndex * 2;
      uvs[uvOffset] = i / (profileSegments - 1);
      uvs[uvOffset + 1] = v;
    }
  }

  for (let segment = 0; segment < radialSegments; segment += 1) {
    const nextSegment = (segment + 1) % radialSegments;
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
