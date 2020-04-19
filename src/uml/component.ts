import { reverse, reverseHead } from './helpers';

/** Combined direction is ordered clockwise. */
export enum CombinedDirection {
    Right,
    Down,
    Left,
    Up
}

export enum ArrowDirection {
    Left,
    Right
}

export function opposite(direction: ArrowDirection): ArrowDirection {
    return direction === ArrowDirection.Right ? ArrowDirection.Left : ArrowDirection.Right;
}

export enum Layout {
    Horizontal,
    Vertical
}

function layoutOf(combined: CombinedDirection): Layout {
    return (combined === CombinedDirection.Up || combined === CombinedDirection.Down) ? Layout.Vertical : Layout.Horizontal;
}

function directionOf(combined: CombinedDirection): ArrowDirection {
    return (combined === CombinedDirection.Up || combined === CombinedDirection.Left) ? ArrowDirection.Left : ArrowDirection.Right;
}

export class Arrow {
    static regexTag: RegExp = /[lrud\[\]]+/; // any [...] or l(eft), r(ight), u(p) or d(own) - o would not work (a-z)
    private constructor(public left: string,
        public line: string,
        public sizeVert: number,
        public tag: string,
        public right: string,
        public direction: ArrowDirection,
        public layout: Layout) { }

    static ArrowLines = ["-", ".", "=", "~"];

    static fromString(arrow: string): Arrow | undefined {
        let line = this.ArrowLines.find(s => arrow.indexOf(s) >= 0);
        if (!line) {
            // arrow line was not found
            return;
        }
        let arr = arrow.split(line);
        var tag = "";
        let tag_idx = arr.findIndex(s => s.length > 0 && s.match(this.regexTag));
        if (tag_idx !== -1) {
            [tag, arr[tag_idx]] = [arr[tag_idx], tag];
        }
        let left = arr[0];
        let direction = left.indexOf("<") >= 0
            // right direction is default - also for undirected arrows
            ? ArrowDirection.Left : ArrowDirection.Right;
        let layout = arr.length <= 2
            ? Layout.Horizontal : Layout.Vertical;

        // in case of horizontal arrow 1 is used - otherwise 2 or higher
        let arrowSizeVert = Math.max(2, arr.length - 1);
        return new this(left, line, arrowSizeVert, tag, arr[arr.length - 1], direction, layout);
    }

    toString(): string {
        var mid = this.line + this.tag;
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
        return new Arrow(this._revHead(this.right), this.line, this.sizeVert, this.tag, this._revHead(this.left),
            opposite(this.direction), this.layout);
    }

    combinedDirection(): CombinedDirection {
        if (this.layout === Layout.Horizontal) {
            return this.direction === ArrowDirection.Left ? CombinedDirection.Left : CombinedDirection.Right;
        } else {
            return this.direction === ArrowDirection.Left ? CombinedDirection.Up : CombinedDirection.Down;
        }
    }
}


export class Line {
    /** Regex to find an arrow in the current line. */
    static regex: RegExp = /(\s*)(\S+)(?:\s+("[^"]+"))?\s*(\S*[-~=.]\S*)\s*(?:("[^"]+")\s+)?(\S+)(.*)/;
    // example:                    A "1"                  ->          "2"          B  : foo
    private attached?: Array<string>;

    constructor(public components: Array<string>,
        public arrow: Arrow,
        public multiplicities: Array<string>,
        public sides: Array<string>) {
    }

    static fromString(line: string): Line | undefined {
        let m = line.match(this.regex);
        if (!m) {
            return;
        }
        let a = 4; // arrow-index
        let mirror = (idx: number): Array<string> => {
            let left = m![a - idx];
            let right = m![a + idx];
            return [left ? left : "", right ? right : ""];
        };
        let result = new this(mirror(2), Arrow.fromString(m[a])!, mirror(1), mirror(3));
        if (result.arrow.tag.length > 0) {
            // check explicit direction set in arrow - e.g. -up->
            let idx = "rdlu".indexOf(result.arrow.tag[0]);
            if (idx !== -1) {
                result.arrow.tag = "";
                result.setCombinedDirection(idx);
            }
        }
        return result;
    }

    attach(line: string) {
        if (!this.attached) {
            this.attached = new Array<string>();
        }
        this.attached.push(line);
    }
    toString(): string {
        var content = this.sides[0] + [this.components[0], this.multiplicities[0], this.arrow.toString(),
        this.multiplicities[1], this.components[1]].
            filter((s: string) => s.length > 0).join(" ") + this.sides[1];

        if (this.attached) {
            content += "\n" + this.attached.join("\n");
        }
        return content;
    }

    reverse(): Line {
        let swap = (what: Array<string>) => { return [what[1], what[0]]; };
        return new Line(
            swap(this.components),
            this.arrow.reverse(),
            swap(this.multiplicities),
            // the label section (on the right side) might contain an arrow as well
            // this has to be turned around as well!
            [this.sides[0], reverseHead(this.sides[1])]);
    }

    combinedDirection(): CombinedDirection {
        return this.arrow.combinedDirection();
    }
    setCombinedDirection(dir: CombinedDirection) {
        let oldDir = this.arrow.direction;

        if (oldDir !== directionOf(dir)) {
            Object.assign(this, this.reverse());
        }
        this.arrow.layout = layoutOf(dir);
    }
}

export type Content = Line | string;

function toString(content: Content): string;
function toString(content: Array<Content>, tab?: string): string;

function toString(content: Content | Array<Content>): string {
    if (content instanceof Array) {
        return content
            .map((s: Content) => { return toString(s); })
            .join("\n");
    }
    return content instanceof Line ? content.toString() : content;
}


export class Component {

    constructor(public content: Array<Content>,
        public type?: string,
        public name?: string,
        public stereotype?: string,
        public color?: string,
        private printName?: string
    ) {
    }

    static regexTitle: RegExp = /\s*(\S+)\s+([^{\s]*)\s*(<<\S+>>)?\s*(#\S+)?\s*({?)\s*/;

    static fromString(s: string): Component {
        // empty lines are being removed
        var arr = s.split("\n").filter((line: string) => { return line.length > 0; });
        if (arr.length === 0) {
            return new this(new Array<string>());
        }
        var type: string | undefined;
        var name: string | undefined;
        var printName: string | undefined;
        var stereotype: string | undefined;
        var color: string | undefined;

        let m = arr[0].match(this.regexTitle);
        // for a package the curly brace must be either in the current or in the next line
        if (m && arr.length > 1 && (m[5] || arr[1].indexOf("{") !== -1)) {
            let offset = m[5] === "{" ? 1 : 2;
            arr = arr.slice(offset, arr.length - 1);
            type = m[1];
            printName = m[2];
            if (printName) {
                // remove quotes
                name = (printName[0] === '"') ? printName.substring(1, printName.length - 1) : printName;
            }
            stereotype = m[3];
            color = m[4];
        }
        var prevLine: Line | undefined;
        let content = new Array<Content>();
        arr.forEach((s: string) => {
            let line = Line.fromString(s);
            if (line instanceof Line) {
                prevLine = line;
                content.push(line);
            } else {
                if (prevLine) {
                    prevLine!.attach(s);
                } else {
                    content.push(s);
                }
            }
        });

        return new this(content, type, name, color, stereotype, printName);
    }

    toString(): string {
        if (this.type) {
            var header = this.type;
            [this.printName, this.stereotype, this.color].forEach(
                (s: string | undefined) => { if (s) { header += " " + s; } });
            return header + " {\n" + toString(this.content) + "\n}\n";
        }
        return toString(this.content);
    }

}
