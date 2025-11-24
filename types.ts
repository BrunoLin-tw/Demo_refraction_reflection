export interface Point {
  x: number;
  y: number;
}

export interface Vector {
  x: number;
  y: number;
}

export interface Ray {
  origin: Point;
  direction: Vector;
  color: string;
  wavelength: number; // Used to calculate IOR offset
  intensity: number;
}

export interface PrismData {
  center: Point;
  rotation: number; // Radians
  sideLength: number;
  refractiveIndex: number;
}

export interface LightSourceData {
  position: Point;
  angle: number; // Radians
}
