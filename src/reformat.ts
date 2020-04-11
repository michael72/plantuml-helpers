import * as uml from './uml';

/*
const regex_inner_diagram: RegExp = /(.*)(\S+\s+"\S+"\s+{[^{}]+})(.*)/;

enum Component {
    None,
    Package,
    Node,
    Folder,
    Frame,
    Cloud,
    Database
}

class DiagramNode {
    component: Component;
    name?: string;
    content: Array<string>;

    constructor(lines: string) {
        this.component = Component.None;
        this.content = lines.split("\n");
    }
}

class Diagram {
    public node: DiagramNode;
    public children: Array<Diagram>;

    constructor(lines: string) {
        this.node = new DiagramNode(lines); // TODO
        this.children = new Array;
    }
}

class Structure {
    key: string;
    content: string;
    children: Array<Structure>;

    constructor(key: string, lines: string) {
        this.key = key;
        this.content = lines;
        this.children = [];
        //this.addChildren();
    }

    addChildren() {
        let m = this.content.match(regex_inner_diagram);
        if (m) {
            let left = m[1].trim();
            let sub = m[2];
            let right = m[3].trim();
        }
}
*/

const regex: RegExp = /(.*\S+)(\s*)/s;

export function autoFormatTxt(txt: string): string {
    let m = txt.match(regex);
    var ending = "";
    if (m) {
        txt = m[1];
        ending = m[2];
    }
    let parsed = uml.Component.fromString(txt);
    return parsed.sort().toString() + ending; // TODO
}


