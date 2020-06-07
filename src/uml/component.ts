import { Line } from './line';

export class Definition {
    static regexDef = /^\s*(\(\)|interface)\s+((?:"[^"]+")|[^"\s]+)(?:\s+as\s+(\S+))?\s*$/;
    static regexComp = /^\s*(component\s+)?((?:\[[^\]]+\])|[^[\]\s]+)(?:\s+as\s+(\S+))?\s*$/;
    static regexClass = /^\s*(class|enum)\s+([^[\]\s]+)(?:\s+as\s+(\S+))?\s*$/;

    constructor(public type: string, public name: string, public alias?: string) {
    }
    static fromString(line: string): Definition | undefined {
        const shorten = (s: string, by: string): string => {
            if (s[0] === by) {
                return s.substring(1, s.length - 1);
            }
            return s;
        };
        let m = line.match(Definition.regexDef);
        // check interface definition
        if (m) {
            return new this("interface", shorten(m[2], '"'), m[3]);
        }
        else {
            // check for component
            m = line.match(Definition.regexComp);
            if (m && (m[1] || m[2][0] === '[')) {
                return new this("component", shorten(m[2], "["), m[3]);
            }
            else {
                m = line.match(Definition.regexClass);
                if (m) {
                    return new this(m[1], shorten(m[2], '"'), m[3]);
                }
            }
        }
        return;
    }

    toString(): string {
        const comp = `${this.type} ${this.name}`;
        return this.alias ? comp + " as " + this.alias : comp;
    }
    isComponent(): boolean {
        return this.type === "component";
    }
}

export type Content = Line | Definition | string;

function toString(content: Content): string;
function toString(content: Array<Content>, tab?: string): string;

function toString(content: Content | Array<Content>): string {
    if (content instanceof Array) {
        return content
            .map((s: Content) => { return toString(s); })
            .join("\n");
    }
    return (content instanceof Line || content instanceof Definition) ? content.toString() : content;
}

export class Component {
    constructor(public content: Array<Content>,
        public children?: Array<Component>,
        public type?: string,
        public name?: string,
        public suffix?: string, // content between name and opening brace: could be color, stereotype and/or link etc.
        private printName?: string
    ) {
    }

    static regexTitle = /\s*(package|namespace|node|folder|frame|cloud|database|class|component|interface|enum|annotation)\s+([^{\s]*)\s*([^{]*)?{.*/;

    static fromString(s: string | Array<string>): Component {
        let arr = typeof s === 'string' ? s.split("\n") : s;
        // pre-filter: remove single open braces { and put them at the end of the previous line
        for (let i = 0; i < arr.length; ++i) {
            if (i > 0 && arr[i].trim().startsWith('{')) {
                arr[i - 1] += ' ' + arr[i];
                arr[i] = '';
            }
            arr[i] = arr[i].trimRight();
        }
        // post-filter: remove empty lines
        arr = arr.filter((line: string) => { return line.length > 0; });

        // multiple components in sequence
        const parent = new Component(new Array<Content>());
        const children = new Array<Component>();
        for (let i = 0; i < arr.length; ++i) {
            const [comp, new_i] = this._fromString(arr, i);
            i = new_i;
            children.push(comp);
        }
        if (children.length == 1) {
            return children[0];
        }
        parent.children = children;
        return parent;
    }

    private static _fromString(arr: Array<string>, start: number): [Component, number] {
        // empty lines are being removed
        let type: string | undefined;
        let name: string | undefined;
        let printName: string | undefined;
        let suffix: string | undefined;

        let i = start;
        const m = arr[i].match(this.regexTitle);

        if (m && arr.length > 1) {
            ++i;
            type = m[1];
            printName = m[2];
            if (printName) {
                // remove quotes
                name = (printName[0] === '"') ? printName.substring(1, printName.length - 1) : printName;
            }
            if (m[3]) {
                suffix = m[3].trimRight();
            }
        }

        let prevLine: Line | undefined;
        const content = new Array<Content>();
        const children = new Array<Component>();

        for (; i < arr.length; ++i) {
            const s = arr[i];
            const def = Definition.fromString(s);
            if (def) {
                content.push(def);
            } else if (s.match(this.regexTitle)) {
                // parse child element until closing bracket
                const [child, next] = this._fromString(arr, i);
                children.push(child);
                i = next;
            }
            else {
                const line = Line.fromString(s);
                if (line) {
                    prevLine = line;
                    content.push(line);
                }
                else if (s.trim() == "}") {
                    break;
                }
                else if (prevLine) {
                    prevLine.attach(s);
                } else {
                    content.push(s);
                }
            }
        }

        return [new this(content, children.length > 0 ? children : undefined, type, name, suffix, printName), i];
    }

    static DEFAULT_TAB = "  ";

    private _toStringTab(tab: string): string {
        if (this.type) {
            let t = tab;
            let header = this.type;
            for (const s of [this.printName, this.suffix]) {
                if (s) { header += " " + s; }
            }
            let result = t + header.trimLeft() + " {\n";
            t += Component.DEFAULT_TAB;
            const idx = this.content.findIndex((c: Content) => { return c instanceof Line; });
            if (idx !== 0) {
                result += t + this.content.slice(0, idx === -1 ? this.content.length : idx).map((s: Content) => { return toString(s).trimLeft(); }).join("\n" + t);
            }
            result = result.trimRight();
            if (this.children) {
                for (const child of this.children) {
                    result += "\n" + child._toStringTab(t).trimRight();
                }
            }
            if (idx !== -1) {
                result += "\n" + t + this.content.slice(idx).map((s: Content) => { return s.toString().trimLeft(); }).join("\n" + t);
            }

            t = t.substring(Component.DEFAULT_TAB.length);
            result = result.trimRight() + "\n" + t + "}\n";
            return result;
        }

        let result = "";
        if (this.children) {
            for (const child of this.children) {
                if (result.length > 0) {
                    result += "\n";
                }
                result += child._toStringTab(tab).trimRight();
            }
            if (this.content.length > 0) {
                result += "\n";
            }
        }
        result += toString(this.content);
        return result;
    }

    toString(): string {
        return this._toStringTab("");
    }

}
