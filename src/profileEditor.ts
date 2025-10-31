import { Vector2 } from "three";
import { DEFAULT_PRESET_ID, getPresetVectors } from "./profilePresets";

type ChangeListener = (points: Vector2[]) => void;
type SelectionListener = (index: number | null, points: Vector2[]) => void;

interface PointerState {
  pointerId: number;
  pointIndex: number;
}

const DEFAULT_POINTS = getPresetVectors(DEFAULT_PRESET_ID);
const MIN_POINTS = 3;
const MAX_POINTS = 64;

export class ProfileEditor {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly points: Vector2[];
  private readonly listeners = new Set<ChangeListener>();
  private readonly selectionListeners = new Set<SelectionListener>();
  private pointerState: PointerState | null = null;
  private selectedIndex: number | null = 0;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to acquire 2D context for profile editor.");
    }

    this.canvas = canvas;
    this.ctx = context;
    this.points = DEFAULT_POINTS.map((point) => point.clone());

    this.configureCanvas();
    this.bindEvents();
    this.draw();
  }

  public onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.getPoints());
    return () => this.listeners.delete(listener);
  }

  public onSelectionChange(listener: SelectionListener): () => void {
    this.selectionListeners.add(listener);
    listener(this.selectedIndex, this.getPoints());
    return () => this.selectionListeners.delete(listener);
  }

  public getPoints(): Vector2[] {
    return this.points.map((point) => point.clone());
  }

  public addPoint(): void {
    if (!this.canAddPoint()) {
      return;
    }

    this.pointerState = null;
    const insertAfter = this.selectedIndex ?? 0;
    const nextIndex = (insertAfter + 1) % this.points.length;
    const newPoint = this.points[insertAfter].clone().lerp(this.points[nextIndex], 0.5);
    this.points.splice(nextIndex, 0, newPoint);
    this.selectedIndex = nextIndex;
    this.draw();
    this.emitSelection();
    this.emitChange();
  }

  public removeSelectedPoint(): void {
    if (!this.canRemovePoint()) {
      return;
    }

    this.pointerState = null;
    if (this.selectedIndex === null) {
      this.points.pop();
      this.selectedIndex = this.points.length - 1;
    } else {
      this.points.splice(this.selectedIndex, 1);
      this.selectedIndex = Math.min(this.selectedIndex, this.points.length - 1);
    }

    this.draw();
    this.emitSelection();
    this.emitChange();
  }

  public canAddPoint(): boolean {
    return this.points.length < MAX_POINTS;
  }

  public canRemovePoint(): boolean {
    return this.points.length > MIN_POINTS;
  }

  public applyPreset(preset: Vector2[]): void {
    if (!preset.length) {
      return;
    }

    this.pointerState = null;
    this.points.splice(0, this.points.length, ...preset.map((point) => point.clone()));
    this.selectedIndex = 0;
    this.draw();
    this.emitSelection();
    this.emitChange();
  }

  private configureCanvas(): void {
    const dpi = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.canvas.width = Math.round(width * dpi);
    this.canvas.height = Math.round(height * dpi);

    this.ctx.scale(dpi, dpi);
  }

  private bindEvents(): void {
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("resize", this.handleResize);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    const pointer = this.getPointerPosition(event);
    const index = this.findClosestPointIndex(pointer, 0.12);

    if (index === -1) {
      return;
    }

    this.canvas.setPointerCapture(event.pointerId);
    this.pointerState = { pointerId: event.pointerId, pointIndex: index };
    this.selectIndex(index);
    this.updatePoint(index, pointer);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.pointerState || this.pointerState.pointerId !== event.pointerId) {
      return;
    }

    const pointer = this.getPointerPosition(event);
    this.updatePoint(this.pointerState.pointIndex, pointer);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.pointerState || this.pointerState.pointerId !== event.pointerId) {
      return;
    }

    this.canvas.releasePointerCapture(event.pointerId);
    this.pointerState = null;
  };

  private handleResize = (): void => {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.configureCanvas();
    this.draw();
  };

  private updatePoint(index: number, position: Vector2): void {
    const clamped = position.clone().clampScalar(-0.95, 0.95);
    this.points[index].copy(clamped);
    this.draw();
    this.emitChange();
  }

  private emitChange(): void {
    const payload = this.getPoints();
    this.listeners.forEach((listener) => listener(payload));
  }

  private draw(): void {
    const { ctx, canvas } = this;
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const { centerX, centerY, scale } = this.canvasTransform();

    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, scale * 0.35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - scale, centerY);
    ctx.lineTo(centerX + scale, centerY);
    ctx.moveTo(centerX, centerY - scale);
    ctx.lineTo(centerX, centerY + scale);
    ctx.stroke();

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.points.forEach((point, index) => {
      const { x, y } = this.toCanvas(point);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    if (this.points.length) {
      const { x, y } = this.toCanvas(this.points[0]);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    this.points.forEach((point, index) => {
      const { x, y } = this.toCanvas(point);
      const isSelected = index === this.selectedIndex;
      ctx.fillStyle = isSelected ? "#e0f2fe" : "#f8fafc";
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#22d3ee" : "#0ea5e9";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();
    });

    ctx.restore();
  }

  private toCanvas(point: Vector2): { x: number; y: number } {
    const { centerX, centerY, scale } = this.canvasTransform();
    return {
      x: centerX + point.x * scale,
      y: centerY - point.y * scale
    };
  }

  private getPointerPosition(event: PointerEvent): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return new Vector2(x * 2 - 1, (1 - y) * 2 - 1);
  }

  private findClosestPointIndex(pointer: Vector2, maxDistance: number): number {
    let closestDistance = Number.POSITIVE_INFINITY;
    let closestIndex = -1;

    this.points.forEach((point, index) => {
      const distance = point.distanceTo(pointer);
      if (distance < maxDistance && distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  private canvasTransform(): { centerX: number; centerY: number; scale: number } {
    return {
      centerX: this.canvas.clientWidth / 2,
      centerY: this.canvas.clientHeight / 2,
      scale: this.canvas.clientWidth * 0.45
    };
  }

  private selectIndex(index: number): void {
    if (this.selectedIndex === index) {
      return;
    }

    this.selectedIndex = index;
    this.draw();
    this.emitSelection();
  }

  private emitSelection(): void {
    const payload = this.getPoints();
    this.selectionListeners.forEach((listener) => listener(this.selectedIndex, payload));
  }
}
