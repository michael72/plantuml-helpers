import * as helpers from './helpers';

export enum Direction {
    None,
    Left,
    Right
}

export function opposite(direction: Direction): Direction {
    return direction === Direction.Right ? Direction.Left : (direction === Direction.Left ? Direction.Right : Direction.None);
}

export enum Layout {
    Horizontal,
    Vertical
}

export function rotate(layout: Layout): Layout {
    return layout === Layout.Horizontal ? Layout.Vertical : Layout.Horizontal;
}

export class Arrow {
    left: string;
    line: string;
    right: string;
    direction: Direction;
    layout: Layout;

    constructor(left: string, line: string,
        right: string,
        direction: Direction,
        layout: Layout
    ) {
        this.left = left;
        this.line = line;
        this.right = right;
        this.direction = direction;
        this.layout = layout;
    }

    static fromString(arrow: string): Arrow | undefined {
        let find = (search: Array<string>) => {
            return search.find(s => arrow.indexOf(s) !== -1);
        };
        let line = find(["-", ".", "=", "~"]);
        if (line === undefined) {
            // arrow line was not found
            return;
        }
        let [left, right] = this._leftRight(arrow.split(line));
        let head = find([">", "<", "\\", "/"]);
        let direction = head === ">"
            ? Direction.Right : (head === "<" ? Direction.Left : Direction.None);
        let layout = arrow.split(line).length === 2
            ? Layout.Horizontal : Layout.Vertical;

        return new this(left === line ? "" : left, line, right === line ? "" : right, direction, layout);
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
        let mid = this.layout === Layout.Horizontal ? this.line : this.line + this.line;
        return this.left + mid + this.right;
    }

    reverse(): Arrow {
        let reverse = (arrow: string): string => { return helpers.reverse(helpers.reverseHead(arrow));};
        return new Arrow(reverse(this.right), this.line, reverse(this.left),
            opposite(this.direction), this.layout);
    }
}

