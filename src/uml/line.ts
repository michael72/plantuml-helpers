import { reverseHead } from "../helpers";
import { Arrow, Layout, ArrowDirection } from "./arrow";

/** Combined direction is ordered clockwise. */
export enum CombinedDirection {
  Right,
  Down,
  Left,
  Up,
}

export class Line {
  /** Regex to find an arrow in the current line. */
  static REGEX = /^(\s*)((?:"[^"]+")|[^-~="><\\/\s]+)(?:\s+("[^"]+"))?\s*(\S*[^A-Za-np-z_\s]+)\s*(?:("[^"]+")\s+)?((?:"[^"]+")|[^-~="><\\/\s]+)(\s*(?::.*)?)$/;
  // example:                 A                  "1"           ->                          "2"          B  : foo

  /** corresponds to enum order in CombinedDirection - first letter only */
  static DIRECTIONS = "rdlu";

  private attached?: Array<string>;

  constructor(
    public components: Array<string>,
    public arrow: Arrow,
    public multiplicities: Array<string>,
    public sides: Array<string>
  ) {}

  static fromString(line: string): Line | undefined {
    const m = this.REGEX.exec(line);
    if (!m) {
      return;
    }
    const a = 4; // arrow-index
    const arrow = Arrow.fromString(m[a]);
    if (!arrow) {
      return;
    }
    const mirror = (idx: number): Array<string> => {
      const left = m[a - idx];
      const right = m[a + idx];
      return [left ? left : "", right ? right : ""];
    };
    const result = new this(mirror(2), arrow, mirror(1), mirror(3));
    if (result.arrow.tag.length > 0) {
      // check explicit direction set in arrow - e.g. -up->
      const idx = this.DIRECTIONS.indexOf(result.arrow.tag[0]);
      if (idx !== -1) {
        result.arrow.tag = "";
        result.setCombinedDirection(idx);
      }
    }
    return result;
  }

  attach(line: string): void {
    if (!this.attached) {
      this.attached = new Array<string>();
    }
    this.attached.push(line);
  }

  isNoteAttached(): boolean {
    return this.attached != undefined && this.attached.length > 0 && this.attached[this.attached.length-1].startsWith("note ");
  }

  moveAttached(): Array<string> {
    let result = new Array<string>();
    // move attached only if not a note (notes belong to the preceeding line)
    while (this.attached && !this.isNoteAttached()) {
      const last = this.attached.pop();
      if (last == undefined) {
        this.attached = undefined;
      }
      else {
        result = [last, ...result];
      }
    }
    return result;
  }

  rotateRight(): void {
    switch(this.combinedDirection()) {
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
    return this.components.map((c) =>
      c[0] == "[" ? c.substr(1, c.length - 2) : c
    );
  }

  has(name: string): boolean {
    return this.components.includes(name);
  }

  reverse(): Line {
    return new Line(
      [this.components[1], this.components[0]],
      this.arrow.reverse(),
      [this.multiplicities[1], this.multiplicities[0]],
      // the label section (on the right side) might contain an arrow as well
      // this has to be turned around as well!
      [this.sides[0], reverseHead(this.sides[1])]
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
      this.setCombinedDirection(this.arrow.isInheritance() ? CombinedDirection.Up : CombinedDirection.Right);
    }
    else {
      const defaultDir = this._defaultDirection();
      if (defaultDir != undefined) {
        this.setCombinedDirection(defaultDir);
      }
    }
  }

  toString(): string {
    let content =
      this.sides[0] +
      [
        this.components[0],
        this.multiplicities[0],
        this.arrow.toString(),
        this.multiplicities[1],
        this.components[1],
      ]
        .filter((s: string) => s.length > 0)
        .join(" ") +
      this.sides[1];

    if (this.attached) {
      content += "\n" + this.attached.join("\n");
    }
    return content;
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
