import { ColorRgbaData } from "../model/player";

export class Utils {
  public static nextRandom(lowInclusive: number, highExclusive?: number) {
    if (highExclusive === null || typeof highExclusive == "undefined") {
      highExclusive = lowInclusive;
      lowInclusive = 0;
    }

    if (lowInclusive < 0) {
      highExclusive += Math.abs(lowInclusive);
    } else {
      highExclusive -= lowInclusive;
    }

    var val = Math.floor(Math.random() * highExclusive) + lowInclusive;
    return val;
  }

  public static nextRandomFloat(lowInclusive: number, highExclusive: number) {
    return Math.random() * (highExclusive - lowInclusive) + lowInclusive;
  }

  public static decimalToFixed(number: number, maxDecimalPlaces: number) {
    return number
      ? Math.round(number) != number
        ? number.toFixed(maxDecimalPlaces).replace(/0+$/, "")
        : number
      : number;
  }

  public static ColorRgba(r: number, g: number, b: number, a: number): ColorRgbaData {
    return { r, g, b, a };
  }

  public static compareNumbers(a: number, b: number) {
    if (b < a) return 1;
    else if (b > a) return -1;
    else return 0;
  }
}
