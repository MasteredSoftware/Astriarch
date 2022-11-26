import { GalaxySizeOption, GameOptions } from "../model/model";
import { HexagonData, PointData } from "../shapes/shapes";

const HexProperties = { HEIGHT: 40.0, WIDTH: 71.0, SIDE: 29.0, X: 21 };
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Grid is a proper instantiated class since it has deterministic generation
 *  therefore it doesn't have to be transfered between the database, client and server and can be generated as needed
 */
export class Grid {
  quadrants: GridRect[];
  hexes: GridHex[];

  constructor(width: number, height: number, options: GameOptions) {
    this.quadrants = [];
    this.hexes = [];

    let h: GridHex, x: number, y: number, quadWidth: number, quadHeight: number;
    x = 0;
    y = 0;
    quadWidth = width / 2;
    quadHeight = height / 2;
    if (options.systemsToGenerate == 2 || options.systemsToGenerate == 4) {
      //[0 , 0]
      this.quadrants.push(new GridRect(x, y, quadWidth, quadHeight));
      //[0 , 1]
      x = quadWidth;
      this.quadrants.push(new GridRect(x, y, quadWidth, quadHeight));
      //[1 , 1]
      y = quadHeight;
      this.quadrants.push(new GridRect(x, y, quadWidth, quadHeight));
      //[1 , 0]
      x = 0;
      this.quadrants.push(new GridRect(x, y, quadWidth, quadHeight));
    } else {
      //we're generating 3 systems in a triangle arrangement
      //[0 , 0]
      this.quadrants.push(new GridRect(x, y, quadWidth, quadHeight));
      //[0 , 1]
      x = quadWidth;
      this.quadrants.push(new GridRect(x, y, quadWidth, quadHeight));
      //[middle]
      x = quadWidth / 2;
      y = quadHeight;
      this.quadrants.push(new GridRect(x, y, quadWidth, quadHeight));
    }

    //build sub-quadrants for each quadrant
    for (let q = 0; q < this.quadrants.length; q++) {
      let r = this.quadrants[q];

      let subWidth = r.width / 2.0;
      let subHeight = r.height / 2.0;
      //insert for the corner sub-quadrants
      //this will prefer this sub-quadrant for the home planet

      let r0Sub = new GridRect(r.x, r.y, subWidth, subHeight);
      r.children.push(r0Sub);

      let r1Sub = new GridRect(r.x + subWidth, r.y, subWidth, subHeight);
      if (q == 1) r.children.splice(0, 0, r1Sub);
      else r.children.push(r1Sub);

      let r2Sub = new GridRect(r.x + subWidth, r.y + subHeight, subWidth, subHeight);
      if (q == 2) r.children.splice(0, 0, r2Sub);
      else r.children.push(r2Sub);

      let r3Sub = new GridRect(r.x, r.y + subHeight, subWidth, subHeight);
      if (q == 3) r.children.splice(0, 0, r3Sub);
      else r.children.push(r3Sub);
    }

    //setup a dictionary for use later for assigning the Y CoOrd
    let hexagonsByXCoOrd: { [T in number]: GridHex[] } = {};

    let galaxySizeMultiplier = Grid.galaxySizeOptionToHexSizeMultiplier(width, options.galaxySize);

    let hexWidth = HexProperties.WIDTH * galaxySizeMultiplier;
    let hexHeight = HexProperties.HEIGHT * galaxySizeMultiplier;
    let hexSide = HexProperties.SIDE * galaxySizeMultiplier;

    let row = 0;
    for (y = 0.0; y + hexHeight <= height; y += hexHeight / 2) {
      let col = 0;
      let colId = 0;

      let offset = 0.0;
      if (row % 2 == 1) {
        offset = (hexWidth - hexSide) / 2 + hexSide;
        colId = 1;
      }

      for (x = offset; x + hexWidth <= width; x += hexWidth + hexSide) {
        let hexData = { id: LETTERS[row] + (colId + 1), x, y, width: hexWidth, height: hexHeight, side: hexSide };
        h = new GridHex(hexData);
        h.pathCoOrdX = colId; //the column is the x coordinate of the hex, for the y coordinate we need to get more fancy
        this.hexes.push(h);

        if (!hexagonsByXCoOrd[colId]) hexagonsByXCoOrd[colId] = [];
        hexagonsByXCoOrd[colId].push(h);

        col++;
        colId += 2;
      }
      row++;
    }

    //finally go through our list of hexagons by their x co-ordinate to assign the y co-ordinate
    const keys = Object.keys(hexagonsByXCoOrd).map(Number);
    for (x of keys) {
      const hexagonsByX = hexagonsByXCoOrd[x];
      let yCoOrd = Math.floor(x / 2) + (x % 2);
      for (h of hexagonsByX) {
        h.pathCoOrdY = yCoOrd++;
      }
    }
  }

  public static galaxySizeOptionToHexSizeMultiplier(width: number, galaxySize: GalaxySizeOption) {
    if (galaxySize === GalaxySizeOption.LARGE) {
      return 1;
    }
    let hexesInRow = galaxySize == GalaxySizeOption.MEDIUM ? 5 : galaxySize == GalaxySizeOption.SMALL ? 4 : 3;

    //calculate hex multiplier
    let multiplier = hexesInRow * HexProperties.WIDTH + hexesInRow * HexProperties.SIDE + HexProperties.X;
    return width / multiplier;
  }

  public static getHexDistance(h1: GridHex, h2: GridHex) {
    //a good explanation of this calc can be found here:
    //http://playtechs.blogspot.com/2007/04/hex-grids.html
    let deltaX = h1.pathCoOrdX! - h2.pathCoOrdX!;
    let deltaY = h1.pathCoOrdY! - h2.pathCoOrdY!;
    return (Math.abs(deltaX) + Math.abs(deltaY) + Math.abs(deltaX - deltaY)) / 2;
  }
}

export class GridRect {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  children: GridRect[];
  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.left = x;
    this.right = x + width;
    this.top = y;
    this.bottom = y + height;
    this.children = [];
  }

  public contains(point: PointData) {
    return this.left < point.x && this.right > point.y && this.bottom > point.y && this.top < point.y;
  }
}

export class GridHex {
  data: HexagonData;
  points: PointData[];

  topLeftPoint: PointData;
  topRightPoint: PointData;
  bottomLeftPoint: PointData;
  bottomRightPoint: PointData;
  midPoint: PointData;

  pathCoOrdX: number | null = null; //x co-ordinate for distance finding
  pathCoOrdY: number | null = null; //y co-ordinate for distance finding

  constructor(data: HexagonData) {
    this.data = data;
    this.points = [];
    const { x, y, width, height, side } = data;
    let x1 = (width - side) / 2;
    let y1 = height / 2;

    this.points.push({ x: x1 + x, y });
    this.points.push({ x: x1 + side + x, y });
    this.points.push({ x: width + x, y: y1 + y });
    this.points.push({ x: x1 + side + x, y: height + y });
    this.points.push({ x: x1 + x, y: height + y });
    this.points.push({ x, y: y1 + y });

    this.topLeftPoint = { x, y };
    this.topRightPoint = { x: x + width, y };
    this.bottomLeftPoint = { x, y: y + height };
    this.bottomRightPoint = { x: x + width, y: y + height };
    this.midPoint = { x: x + width / 2, y: y + height / 2 };
  }

  public isInHexBounds(p: PointData): boolean {
    return (
      this.topLeftPoint.x < p.x &&
      this.topLeftPoint.y < p.y &&
      p.x < this.bottomRightPoint.x &&
      p.y < this.bottomRightPoint.y
    );
  }

  //grabbed from:
  //http://www.developingfor.net/c-20/testing-to-see-if-a-point-is-within-a-polygon.html
  //and
  //http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html#The%20C%20Code
  public contains(p: PointData): boolean {
    let isIn = false;
    if (this.isInHexBounds(p)) {
      //turn our absolute point into a relative point for comparing with the polygon's points
      //let pRel = new Astriarch.Point(p.x - this.x, p.Y - this.y);
      let i,
        j = 0;
      for (i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
        let iP = this.points[i];
        let jP = this.points[j];
        if (
          ((iP.y <= p.y && p.y < jP.y) || (jP.y <= p.y && p.y < iP.y)) &&
          //((iP.y > p.y) != (jP.y > p.y))
          p.x < ((jP.x - iP.x) * (p.y - iP.y)) / (jP.y - iP.y) + iP.x
        ) {
          isIn = !isIn;
        }
      }
    }
    return isIn;
  }
}
