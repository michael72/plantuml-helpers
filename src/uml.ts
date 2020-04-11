import {reverse, reverseHead, DefaultMap} from './helpers';

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
        let rev = (arrow: string): string => { return reverse(reverseHead(arrow)); };
        return new Arrow(rev(this.right), this.line, rev(this.left),
            opposite(this.direction), this.layout);
    }
}

export class Line {
    components: Array<string>;
    arrow: Arrow;
    multiplicities: Array<string>;
    sides: Array<string>;
    /// Regex to find an arrow in the current line.
    static regex: RegExp = /(\s*)(\S+)(?:\s+("[^"]+"))?\s*(\S*[-~=.]\S*)\s*(?:("[^"]+")\s+)?(\S+)(.*)/;
    // example:                    A "1"                  ->          "2"          B  : foo

    constructor(components: Array<string>, arrow: Arrow, multiplicities: Array<string>, sides: Array<string>) {
        this.components = components;
        this.arrow = arrow;
        this.multiplicities = multiplicities;
        this.sides = sides;
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

    deps(): Array<string> {
        return this.arrow.direction === Direction.Right ? this.components : this.components.reverse();
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
    content: Array<Content>;
    type?: string;
    name?: string;

    constructor(content: Array<Content>, type?: string, name?: string) {
        this.type = type;
        this.name = name;
        this.content = content;
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

    sort(): Component {
        // try to bring the components in order
        let deps = new DefaultMap<string, Array<string>>(() => new Array());
        let froms = new Array<string>();
        this.content.forEach((line: Content) => {
            if (line instanceof Line) {
                let [from, to] = line.deps();
                deps.getDef(from).push(to);
                froms.push(from);
            }
        });
        let pointedCounts = new DefaultMap<string, number>(() => 0);
        for (let k of deps.keys()) {
            pointedCounts.set(k, 0);
            if (froms.indexOf(k) === -1) {
                froms.push(k);
            }
        }
        for (let v of deps.values()) {
            for (let d of v) {
                pointedCounts.set(d, pointedCounts.getDef(d) + 1);
            }
        }
        let nodes = Array.from(deps.keys()).
            sort((s1: string, s2: string) => {
                let result = pointedCounts.get(s1)! - pointedCounts.get(s2)!;
                return result !== 0 ? result : froms.indexOf(s1) - froms.indexOf(s2);
            });

        let sorted = this.content.filter((c: Content) => {
            return !(c instanceof Line);
        });
        for (let node of nodes) {
            this.content.forEach((c: Content) => {
                if (c instanceof Line && c.deps()[0] === node) {
                    sorted.push(c);
                }
            });
        }

        return new Component(sorted, this.type, this.name);
    }
}

/*
type Deps = Map<string, Array<string>>;
type Cycles =  Array<Array<string>>;
class CompDeps {
    component: Component;
    deps: Deps;
    cycles: Cycles;

    constructor(component: Component, deps: Deps, cycles: Cycles)  {
        this.component = component;
        this.deps = deps;
        this.cycles = cycles;
    }

    static parse(component: Component) : CompDeps {
        var deps = new Map<string, Array<string>>();
        var cycles = new Array<Array<string>>();

        let addDep = (newDep: Array<string>) => {
            var dep = deps.get(newDep[0]);
            if (dep === undefined) {
                dep = [];
                deps.set(newDep[0], dep);
            }
            dep.push(newDep[1]);
        };

        component.content.forEach((line: Content) => {
            if (line instanceof Line) {
                addDep(line.deps());
            }
        });

        return new this(component, deps, cycles);
    }
}
*/