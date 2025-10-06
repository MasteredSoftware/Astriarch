export interface PointData {
  x: number;
  y: number;
}

export interface RectangleData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LineData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface HexagonData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  side: number;
}
