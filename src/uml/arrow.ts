import { reverse, reverseHead } from '../helpers';


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

}

