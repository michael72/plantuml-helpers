import { reverseHead } from "../helpers";
import { Arrow, Layout, ArrowDirection } from "./arrow";
import { Attachable } from "./attachable";
import { Component } from "./component";

/** Combined direction is ordered clockwise. */
export enum CombinedDirection {
  Right,
  Down,
  Left,
  Up,
}

export class Line extends Attachable {
  /** Regex to find an arrow in the current line. */
  static REGEX =
    /^(\s*)((?:"[^"]+")|[^-~="><\\/\s]*)(?:\s+("[^"]+"))?\s*(\S*[^A-Za-np-z_\s]+)\s*(?:("[^"]+")\s+)?((?:"[^"]+")|[^-~="><\\/\s]*)(\s*[-+]*\s*(?::.*)?)$/;
  // example:                 A                  "1"           ->                          "2"          B  : foo

  /** corresponds to enum order in CombinedDirection - first letter only */
  static DIRECTIONS = "rdlu";

  constructor(
    public components: Array<string>,
    public arrow: Arrow,
    public multiplicities: Array<string>,
    public sides: Array<string>
  ) {
    super();
    if ((this.components[0]?.length ?? 0) == 0) {
      this.components[0] = "[";
    }
    if ((this.components[1]?.length ?? 0) == 0) {
      this.components[1] = "]";
    }
  }

  static fromString(line: string): Line | undefined {
    if (line.startsWith("'") || line.trim() == "...") {
      return;
    }
    const m = this.REGEX.exec(line);
    if (!m) {
      return;
    }
    const a = 4; // arrow-index
    // The regex requires the arrow group to match, so m[a] is guaranteed to exist
    /* v8 ignore next */
    const arrowStr = m[a] ?? "->";
    const arrow = Arrow.fromString(arrowStr);
    if (!arrow) {
      return;
    }
    const mirror = (idx: number): Array<string> => {
      const left = m[a - idx] ?? "";
      const right = m[a + idx] ?? "";
      return [left, right];
    };
    const result = new this(mirror(2), arrow, mirror(1), mirror(3));
    if (result.arrow.tag.length > 0) {
      // check explicit direction set in arrow - e.g. -up->
      const firstChar = result.arrow.tag[0];
      if (firstChar != null && firstChar.length > 0) {
        const idx = this.DIRECTIONS.indexOf(firstChar);
        if (idx !== -1) {
          result.arrow.tag = "";
          result.setCombinedDirection(idx);
        }
      }
    }
    return result;
  }

  rotateRight(): void {
    switch (this.combinedDirection()) {
      case CombinedDirection.Right:
        this.setCombinedDirection(CombinedDirection.Down);
        break;
      case CombinedDirection.Down:
        this.setCombinedDirection(CombinedDirection.Left);
        break;
      case CombinedDirection.Left:
        this.setCombinedDirection(CombinedDirection.Up);
        break;
      case CombinedDirection.Up:
        this.setCombinedDirection(CombinedDirection.Right);
        break;
    }
  }

  rotateLeft(): void {
    switch (this.combinedDirection()) {
      case CombinedDirection.Right:
        this.setCombinedDirection(CombinedDirection.Up);
        break;
      case CombinedDirection.Down:
        this.setCombinedDirection(CombinedDirection.Right);
        break;
      case CombinedDirection.Left:
        this.setCombinedDirection(CombinedDirection.Down);
        break;
      case CombinedDirection.Up:
        this.setCombinedDirection(CombinedDirection.Left);
        break;
    }
  }

  layout(): Layout {
    return this.arrow.layout;
  }

  combinedDirection(): CombinedDirection {
    if (this.arrow.layout === Layout.Horizontal) {
      return this.arrow.direction === ArrowDirection.Left
        ? CombinedDirection.Left
        : CombinedDirection.Right;
    } else {
      return this.arrow.direction === ArrowDirection.Left
        ? CombinedDirection.Up
        : CombinedDirection.Down;
    }
  }

  componentNames(): string[] {
    // remove outer brackets
    return this.components
      .map((c) => (c?.[0] == "[" ? c.substring(1, c.length - 1) : c))
      .filter((c): c is string => c != null && (c.length > 1 || (c !== "[" && c !== "]" && c !== "")));
  }

  has(name: string): boolean {
    return this.components.includes(name);
  }

  reverse(): Line {
    // Constructor ensures components[0] and components[1] exist
    /* v8 ignore next 2 */
    const comp0 = this.components[1] ?? "";
    const comp1 = this.components[0] ?? "";
    const side1 = this.sides[1];
    return new Line(
      [comp0, comp1],
      this.arrow.reverse(),
      /* v8 ignore next */
      [this.multiplicities[1] ?? "", this.multiplicities[0] ?? ""],
      // the label section (on the right side) might contain an arrow as well
      // this has to be turned around as well!
      /* v8 ignore next */
      [this.sides[0] ?? "", side1 != null && side1.length > 0 ? reverseHead(side1) : ""]
    );
  }

  setCombinedDirection(dir: CombinedDirection): void {
    const oldDir = this.arrow.direction;
    const direction =
      dir === CombinedDirection.Up || dir === CombinedDirection.Left
        ? ArrowDirection.Left
        : ArrowDirection.Right;

    if (oldDir !== direction) {
      Object.assign(this, this.reverse());
    }
    this.arrow.layout =
      dir === CombinedDirection.Up || dir === CombinedDirection.Down
        ? Layout.Vertical
        : Layout.Horizontal;
  }

  setDefaultDirection(rebuild: boolean): void {
    if (rebuild) {
      this.setCombinedDirection(
        this.arrow.isInheritance()
          ? CombinedDirection.Up
          : CombinedDirection.Right
      );
    } else {
      const defaultDir = this._defaultDirection();
      if (defaultDir != undefined) {
        this.setCombinedDirection(defaultDir);
      }
    }
  }

  override toString(): string {
    /* v8 ignore next 2 */
    const side0 = this.sides[0] ?? "";
    const side1 = this.sides[1] ?? "";
    const content =
      side0 +
      [
        this.components[0],
        this.multiplicities[0],
        this.arrow.toString(),
        this.multiplicities[1],
        this.components[1],
      ]
        .filter(
          (s: string | undefined): s is string =>
            s != undefined && (s.length > 1 || (s.length == 1 && s !== "[" && s !== "]"))
        )
        .join(" ") +
      side1;

    return content + this.attachedToString();
  }

  includes(c: Component): boolean {
    for (const name of this.componentNames()) {
      if (c.containsName(name)) {
        return true;
      }
    }
    return false;
  }

  private _defaultDirection(): CombinedDirection | undefined {
    if (this.arrow.isInheritance() && this.arrow.layout !== Layout.Vertical) {
      // inheritance should be up (alternatively down)
      return CombinedDirection.Up;
    }
    if (this.arrow.isComposition() && this.arrow.layout !== Layout.Horizontal) {
      // inheritance should be right (alternatively left)
      return CombinedDirection.Right;
    }
    return undefined;
  }
}