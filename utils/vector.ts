import { Point, Vector } from '../types';

export const add = (v1: Point, v2: Vector): Point => ({ x: v1.x + v2.x, y: v1.y + v2.y });
export const sub = (v1: Point, v2: Point): Vector => ({ x: v1.x - v2.x, y: v1.y - v2.y });
export const scale = (v: Vector, s: number): Vector => ({ x: v.x * s, y: v.y * s });
export const dot = (v1: Vector, v2: Vector): number => v1.x * v2.x + v1.y * v2.y;
export const cross = (v1: Vector, v2: Vector): number => v1.x * v2.y - v1.y * v2.x;
export const mag = (v: Vector): number => Math.sqrt(v.x * v.x + v.y * v.y);
export const normalize = (v: Vector): Vector => {
  const m = mag(v);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
};
export const rotate = (v: Vector, angle: number): Vector => ({
  x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
  y: v.x * Math.sin(angle) + v.y * Math.cos(angle),
});
export const distance = (p1: Point, p2: Point): number => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

// Intersection between Ray (origin + t*dir) and Segment (p1 -> p2)
export const intersectRaySegment = (
  rayOrigin: Point,
  rayDir: Vector,
  p1: Point,
  p2: Point
): { point: Point; t: number; normal: Vector } | null => {
  const v1 = rayOrigin;
  const v2 = add(rayOrigin, rayDir);
  const v3 = p1;
  const v4 = p2;

  const denom = (v1.x - v2.x) * (v3.y - v4.y) - (v1.y - v2.y) * (v3.x - v4.x);
  if (Math.abs(denom) < 1e-6) return null;

  const t = ((v1.x - v3.x) * (v3.y - v4.y) - (v1.y - v3.y) * (v3.x - v4.x)) / denom;
  const u = -((v1.x - v2.x) * (v1.y - v3.y) - (v1.y - v2.y) * (v1.x - v3.x)) / denom;

  if (t > 0.001 && u >= 0 && u <= 1) {
    // Intersection point
    const intersectPt = {
      x: v1.x + t * (v2.x - v1.x),
      y: v1.y + t * (v2.y - v1.y),
    };

    // Normal of the segment
    const segDir = sub(p2, p1);
    let normal = normalize({ x: -segDir.y, y: segDir.x });

    // Ensure normal points against the ray (incoming)
    if (dot(rayDir, normal) > 0) {
      normal = scale(normal, -1);
    }

    return { point: intersectPt, t, normal };
  }

  return null;
};
