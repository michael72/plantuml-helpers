import { Line } from './line';

export class Definition {
    static regexDef = /^\s*(\(\)|interface)\s+((?:"[^"]+")|[^"\s]+)(?:\s+as\s+(\S+))?\s*$/;
    static regexComp = /^\s*(component\s+)?((?:\[[^\]]+\])|[^[\]\s]+)(?:\s+as\s+(\S+))?\s*$/;

    constructor(public type: string, public name: string, public alias?: string) {
    }
    static fromString(line: string): Definition | undefined {
        let m = line.match(Definition.regexDef);
        const shorten = (s: string, by: string): string => {
            if (s[0] === by) {
                return s.substring(1, s.length - 1);
            }
            return s;
        };
        if (m) {
            return new this("interface", shorten(m[2], '"'), m[3]);
        }
        else {
            m = line.match(Definition.regexComp);
            if (m && (m[1] || m[2][0] === '[')) {
                return new this("component", shorten(m[2], "["), m[3]);
            }
        }
        return;
    }

    toString(): string {
        const comp = `${this.type} ${this.name}`;
        return this.alias ? comp + " as " + this.alias : comp;
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
        public type?: string,
        public name?: string,
        public stereotype?: string,
        public color?: string,
        private printName?: string,
        public children?: Array<Component>
    ) {
    }

    static regexTitle = /\s*(package|namespace|node|folder|frame|cloud|database)\s+([^{\s]*)\s*(<<\S+>>)?\s*(#\S+)?\s*({?)\s*/;

    static fromString(s: string | Array<string>): Component {
        // empty lines are being removed
        let arr = (typeof s === 'string' ? s.split("\n") : s)
            .filter((line: string) => { return line.length > 0; });
        if (arr.length === 0) {
            return new this(new Array<string>());
        }
        let type: string | undefined;
        let name: string | undefined;
        let printName: string | undefined;
        let stereotype: string | undefined;
        let color: string | undefined;

        const m = arr[0].match(this.regexTitle);
        // for a package the curly brace must be either in the current or in the next line
        if (m && arr.length > 1 && (m[5] || arr[1].indexOf("{") !== -1)) {
            const offset = m[5] === "{" ? 1 : 2;
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
        let prevLine: Line | undefined;
        const content = new Array<Content>();
        const children = new Array<Component>();
        for (let i = 0; i < arr.length; ++i) {
            const s = arr[i];
            const line = Line.fromString(s);
            if (line) {
                prevLine = line;
                content.push(line);
            } else {
                const def = Definition.fromString(s);
                if (def) {
                  content.push(def);  
                } else if (s.match(this.regexTitle)) {
                    // parse child element until closing bracket
                    let brackets = 1;
                    for (let j = i + 1; j < arr.length; ++j) {
                        if (arr[j].trim() === "}") {
                            --brackets;
                            if (brackets === 0) {
                                children.push(this.fromString(arr.slice(i, j + 1)));
                                i = j;
                                break;
                            }
                        }
                        else if (arr[j].match(this.regexTitle)) {
                            ++brackets;
                        }
                    }
                }
                else if (prevLine) {
                    prevLine.attach(s);
                } else {
                    content.push(s);
                }
            }

        }

        return new this(content, type, name, color, stereotype, printName,
            children.length > 0 ? children : undefined);
    }

    static DEFAULT_TAB = "  ";

    toString(tab?: string): string {
        if (this.type) {
            let t = tab === undefined ? "" : tab;
            let header = this.type;
            [this.printName, this.stereotype, this.color].forEach(
                (s: string | undefined) => { if (s) { header += " " + s; } });
            let result = t + header.trimLeft() + " {\n";
            t += Component.DEFAULT_TAB;
            const idx = this.content.findIndex((c: Content) => { return c instanceof Line; });
            if (idx > 0 || idx === -1) {
                result += t + this.content.slice(0, idx === -1 ? this.content.length : idx).map((s: Content) => { return toString(s).trimLeft(); }).join("\n" + t);
            }
            result = result.trimRight();
            if (this.children) {
                this.children.forEach((child: Component) => {
                    result += "\n" + child.toString(t).trimRight();
                });
            }
            if (idx !== -1) {
                if (result.length > 0) {
                    result += "\n";
                }
                result += t + this.content.slice(idx).map((s: Content) => { return s.toString().trimLeft(); }).join("\n" + t);
            }

            t = t.substring(Component.DEFAULT_TAB.length);
            result = result.trimRight() + "\n" + t + "}\n";
            return result;
        }
        return toString(this.content);
    }

}
