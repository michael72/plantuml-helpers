import { reverse, reverseHead } from "../helpers";

export enum ArrowDirection {
  Left,
  Right,
}

export enum Layout {
  Horizontal,
  Vertical,
}

export class Arrow {
  static REGEX_TAG = /(?:[lrud]\S*)|(?:\[\S+\])/; // any [...] or l(eft), r(ight), u(p) or d(own) - o would not work (a-z)
  private constructor(
    public left: string,
    public line: string,
    public sizeVert: number,
    public tag: string,
    public right: string,
    public direction: ArrowDirection,
    public layout: Layout
  ) {}

  static ARROW_LINES = ["-", ".", "=", "~"];

  private static _lineType(arrow: string): string | undefined {
    for (const a of this.ARROW_LINES) {
      if (arrow.indexOf(a) >= 0) {
        return a;
      }
    }
    return;
  }

  private static _tagIndex(arr: Array<string>): number {
    for (let i = 0; i < arr.length; ++i) {
      const s = arr[i];
      if (this.REGEX_TAG.exec(s)) {
        return i;
      }
    }
    return -1;
  }

  static fromString(arrow: string): Arrow | undefined {
    const line = this._lineType(arrow);
    if (line == null) {
      // arrow line was not found
      return;
    }
    const arr = arrow.split(line);
    let tag = "";
    const tagIdx = this._tagIndex(arr);
    if (tagIdx !== -1) {
      [tag, arr[tagIdx]] = [arr[tagIdx], tag];
    }
    const left = arr[0];
    const direction =
      left.indexOf("<") >= 0
        ? // right direction is default - also for undirected arrows
          ArrowDirection.Left
        : ArrowDirection.Right;
    const layout = arr.length <= 2 ? Layout.Horizontal : Layout.Vertical;

    // in case of horizontal arrow 1 is used - otherwise 2 or higher
    const arrowSizeVert = Math.max(2, arr.length - 1);
    return new this(
      left,
      line,
      arrowSizeVert,
      tag,
      arr[arr.length - 1],
      direction,
      layout
    );
  }

  toString(): string {
    let mid = this.line + this.tag;
    if (this.layout === Layout.Vertical) {
      // tag is place at the end or in the middle of the arrow
      mid += this.line.repeat(this.sizeVert - 1);
    }
    return this.left + mid + this.right;
  }

  private _revHead(arrow: string): string {
    return reverse(reverseHead(arrow));
  }

  reverse(): Arrow {
    return new Arrow(
      this._revHead(this.right),
      this.line,
      this.sizeVert,
      this.tag,
      this._revHead(this.left),
      this.direction === ArrowDirection.Right
        ? ArrowDirection.Left
        : ArrowDirection.Right,
      this.layout
    );
  }
}
