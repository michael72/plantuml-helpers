import { Line } from './line';

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

    static regexTitle = /\s*(\S+)\s+([^{\s]*)\s*(<<\S+>>)?\s*(#\S+)?\s*({?)\s*/;

    static fromString(s: string): Component {
        // empty lines are being removed
        let arr = s.split("\n").filter((line: string) => { return line.length > 0; });
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
        arr.forEach((s: string) => {
            const line = Line.fromString(s);
            if (line instanceof Line) {
                prevLine = line;
                content.push(line);
            } else {
                if (prevLine) {
                    prevLine.attach(s);
                } else {
                    content.push(s);
                }
            }
        });

        return new this(content, type, name, color, stereotype, printName);
    }

    toString(): string {
        if (this.type) {
            let header = this.type;
            [this.printName, this.stereotype, this.color].forEach(
                (s: string | undefined) => { if (s) { header += " " + s; } });
            return header + " {\n" + toString(this.content) + "\n}\n";
        }
        return toString(this.content);
    }

}
