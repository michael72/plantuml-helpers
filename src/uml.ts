import { reverse, reverseHead } from './helpers';


export enum CombinedDirection {
    None,
    Left,
    Right,
    Up,
    Down
}

export enum ArrowDirection {
    None,
    Left,
    Right
}

export function opposite(direction: ArrowDirection): ArrowDirection {
    return direction === ArrowDirection.Right ? ArrowDirection.Left : (direction === ArrowDirection.Left ? ArrowDirection.Right : ArrowDirection.None);
}

export enum Layout {
    Horizontal,
    Vertical
}

export function rotate(layout: Layout): Layout {
    return layout === Layout.Horizontal ? Layout.Vertical : Layout.Horizontal;
}

function layoutOf(combined: CombinedDirection): Layout {
    return (combined === CombinedDirection.Up || combined === CombinedDirection.Down) ? Layout.Vertical : Layout.Horizontal;
}

function directionOf(combined: CombinedDirection): ArrowDirection {
    return (combined === CombinedDirection.Up || combined === CombinedDirection.Left) ? ArrowDirection.Left : ArrowDirection.Right;
}

export class Arrow {

    private constructor(public left: string,
        public line: string,
        public length: number,
        public tag: string, 
        public right: string,
        public direction: ArrowDirection,
        public layout: Layout) { }

    static fromString(arrow: string): Arrow | undefined {
        let idxTag = arrow.indexOf("[");
        var tag = "";
        if (idxTag !== -1) {
            let idxTagEnd = arrow.lastIndexOf("]") + 1;
            tag = arrow.substring(idxTag, idxTagEnd); 
            arrow = arrow.substring(0, idxTag) + arrow.substring(idxTagEnd);
        }
        let find = (search: Array<string>) => {
            return search.find(s => arrow.indexOf(s) !== -1);
        };
        let line = find(["-", ".", "=", "~"]);
        if (line === undefined) {
            // arrow line was not found
            return;
        }
        let arr = arrow.split(line);
        let [left, right] = this._leftRight(arr);
        let head = find([">", "<", "\\", "/"]);
        let direction = head === ">"
            ? ArrowDirection.Right : (head === "<" ? ArrowDirection.Left : ArrowDirection.None);
        let layout = arr.length === 2
            ? Layout.Horizontal : Layout.Vertical;


        return new this(left === line ? "" : left, line, Math.max(2, arr.length - 1), tag, right === line ? "" : right, direction, layout);
    }

    static _leftRight(arr: Array<string>): [string, string] {
        var left = "";
        var right = "";
        if (arr.length > 0) {
            left = arr[0];
            if (arr.length === 1) {
                // arrow has either no tail or head part
                if (left[0] === arr[0][0]) {
                    // arrow starts with line
                    left = "";
                    right = arr[0];
                }
            }
            else {
                right = arr[arr.length - 1];
            }
        }
        return [left, right];
    }

    toString(): string {
        var mid = this.line + this.tag; 
        if (this.layout === Layout.Vertical) { 
            mid += this.line.repeat(this.length - 1);
        }
        return this.left + mid + this.right;
    }

    private _revHead(arrow: string): string {
        return reverse(reverseHead(arrow));
    }

    reverse(): Arrow {
        return new Arrow(this._revHead(this.right), this.line, this.length, this.tag, this._revHead(this.left),
            opposite(this.direction), this.layout);
    }

    rotate(): Arrow {
        return new Arrow(this.left, this.line, this.layout === Layout.Horizontal ? 2 : this.length, this.tag, this.right,
            this.direction, rotate(this.layout));
    }

    head(): string {
        return this.direction === ArrowDirection.Right ? this.right : this.left;
    }

    combinedDirection(): CombinedDirection {
        if (this.layout === Layout.Horizontal) {
            return this.direction === ArrowDirection.Left ? CombinedDirection.Left :
                (this.direction === ArrowDirection.Right ? CombinedDirection.Right : CombinedDirection.None);
        } else {
            return this.direction === ArrowDirection.Left ? CombinedDirection.Up :
                (this.direction === ArrowDirection.Right ? CombinedDirection.Down : CombinedDirection.None);
        }
    }
    setCombinedDirection(dir: CombinedDirection) {
        let current = this.combinedDirection();
        if (current !== dir) {
            if (layoutOf(dir) !== this.layout) {
                this.layout = rotate(this.layout);
            }
            if (directionOf(dir) !== this.direction) {
                [this.left, this.right] = [this._revHead(this.right), this._revHead(this.left)];
                this.direction = opposite(this.direction);
            }
        }
    }
}

export class Line {
    /// Regex to find an arrow in the current line.
    static regex: RegExp = /(\s*)(\S+)(?:\s+("[^"]+"))?\s*(\S*[-~=.]\S*)\s*(?:("[^"]+")\s+)?(\S+)(.*)/;
    // example:                    A "1"                  ->          "2"          B  : foo

    constructor(public components: Array<string>,
        public arrow: Arrow,
        public multiplicities: Array<string>,
        public sides: Array<string>) {
    }

    static fromString(line: String): Line | undefined {
        let m = line.match(this.regex);
        if (!m) {
            return;
        }
        let a = 4; // arrow-index
        let arrow = Arrow.fromString(m[a]);
        if (arrow === undefined) {
            return;
        }
        let mirror = (idx: number): Array<string> => {
            let left = m![a - idx];
            let right = m![a + idx];
            return [left ? left : "", right ? right : ""];
        };
        return new this(mirror(2), arrow, mirror(1), mirror(3));
    }

    toString(): string {
        return this.sides[0] + [this.components[0], this.multiplicities[0], this.arrow.toString(),
        this.multiplicities[1], this.components[1]].
            filter((s: string) => s.length > 0).join(" ") + this.sides[1];
    }

    reverse(): Line {
        let swap = (what: Array<string>) => { return [what[1], what[0]]; };
        return new Line(
            swap(this.components),
            this.arrow.reverse(),
            swap(this.multiplicities),
            this.sides);
    }

    combinedDirection(): CombinedDirection {
        return this.arrow.combinedDirection();
    }
    setCombinedDirection(dir: CombinedDirection) {
        let oldDir = this.arrow.direction;
        this.arrow.setCombinedDirection(dir);
        if (oldDir !== this.arrow.direction) {
            // swap sides
            this.components = this.components.reverse();
            this.multiplicities = this.multiplicities.reverse();
        }
    }
}

export type Content = Line | string;

function toString(content: Content): string;
function toString(content: Array<Content>, tab?: string): string;

function toString(content: Content | Array<Content>): string {
    if (content instanceof Array) {
        return content
            .map((s: Content) => { return toString(s).trim(); })
            .join("\n");
    }
    return content instanceof Line ? content.toString() : content;
}

export class Component {

    constructor(public content: Array<Content>,
        public type?: string,
        public name?: string) {
    }

    static regexTitle: RegExp = /(\s*)(\S+)\s+"(\S+)"\s*{?\s*/;

    static fromString(s: string): Component {
        var arr = s.split("\n");
        let m = arr[0].match(this.regexTitle);
        var type: string | undefined;
        var name: string | undefined;
        if (m) {
            arr = arr.slice(m[3] === "{" ? 1 : 2, arr.length - 1);
            type = m[1];
            name = m[2];
        }
        let content = arr.map((s: string): Content => {
            let line = Line.fromString(s);
            return line === undefined ? s : line;
        });
        return new this(content, type, name);
    }

    toString(): string {
        if (this.type !== undefined) {
            let header = `${this.type} "${this.name}" {\n`;
            let footer = "\n}";
            return header + toString(this.content) + footer;
        }
        return toString(this.content);
    }

}
