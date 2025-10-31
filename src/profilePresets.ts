import { Vector2 } from "three";

type PointTuple = [number, number];

export interface ProfilePreset {
  id: string;
  name: string;
  points: PointTuple[];
}

const TAU = Math.PI * 2;

function circle(segments: number, radius: number): PointTuple[] {
  return Array.from({ length: segments }, (_, index) => {
    const theta = (index / segments) * TAU;
    return [Math.cos(theta) * radius, Math.sin(theta) * radius] as PointTuple;
  });
}

function roundedSquare(radius: number, cornerRadius: number, stepsPerCorner: number): PointTuple[] {
  const points: PointTuple[] = [];
  const baseAngles = [Math.PI / 2, 0, -Math.PI / 2, -Math.PI]; // starting angles for each corner

  baseAngles.forEach((baseAngle, cornerIndex) => {
    for (let step = 0; step < stepsPerCorner; step += 1) {
      const t = step / (stepsPerCorner - 1);
      const angle = baseAngle + t * Math.PI / 2;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      const cornerOffsetX = Math.sign(x) * (radius - cornerRadius);
      const cornerOffsetY = Math.sign(y) * (radius - cornerRadius);
      points.push([cornerOffsetX + x * cornerRadius, cornerOffsetY + y * cornerRadius]);
    }
  });

  return points;
}

function diamond(radius: number): PointTuple[] {
  return [
    [0, radius],
    [radius, 0],
    [0, -radius],
    [-radius, 0]
  ];
}

function star(points: number, innerRadius: number, outerRadius: number): PointTuple[] {
  const result: PointTuple[] = [];
  const totalPoints = points * 2;
  for (let i = 0; i < totalPoints; i += 1) {
    const theta = (i / totalPoints) * TAU;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    result.push([Math.cos(theta) * radius, Math.sin(theta) * radius]);
  }
  return result;
}

export const PROFILE_PRESETS: ProfilePreset[] = [
  {
    id: "circle",
    name: "Circle",
    points: circle(12, 0.35)
  },
  {
    id: "rounded-square",
    name: "Rounded Square",
    points: roundedSquare(0.38, 0.12, 6)
  },
  {
    id: "diamond",
    name: "Diamond",
    points: diamond(0.35)
  },
  {
    id: "star",
    name: "Star",
    points: star(5, 0.18, 0.4)
  }
];

export const DEFAULT_PRESET_ID = PROFILE_PRESETS[0].id;

export function presetToVectors(points: PointTuple[]): Vector2[] {
  return points.map(([x, y]) => new Vector2(x, y));
}

export function getPresetVectors(id: string): Vector2[] {
  const preset = PROFILE_PRESETS.find((item) => item.id === id) ?? PROFILE_PRESETS[0];
  return presetToVectors(preset.points);
}
