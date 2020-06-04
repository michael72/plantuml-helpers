import { DefaultMap } from './helpers';
import { Layout } from './uml/arrow';
import { Component, Content, Definition } from './uml/component';
import { Line, CombinedDirection } from './uml/line';

export class Reformat {
    constructor(private component: Component) {
    }

    private _sortByDependencies(): Array<Content> {
        // try to bring the components in order
        const deps = new DefaultMap<string, Array<string>>(() => []);
        const froms = new Array<string>();
        this.component.content.forEach((line: Content) => {
            if (line instanceof Line) {
                const [from, to] = line.components;
                deps.getDef(from).push(to);
                if (froms.indexOf(from) === -1) {
                    froms.push(from);
                }
            }
        });

        const pointedCounts = new DefaultMap<string, number>(() => 0);
        for (const [k, v] of deps.entries()) {
            pointedCounts.set(k, 0);
            // add transitive dependencies
            let newDeps = v;
            while (newDeps.length !== 0) {
                const currentDeps = [...newDeps];
                newDeps = [];
                for (const c of currentDeps) {
                    const ds = deps.get(c);
                    if (ds) {
                        for (const d of ds) {
                            // only add elements that are not already contained
                            if (v.indexOf(d) === -1 && newDeps.indexOf(d) === -1) {
                                newDeps.push(d);
                            }
                        }
                    }
                }
                for (const n of newDeps) {
                    v.push(n);
                }
            }
        }
        for (const v of deps.values()) {
            for (const d of v) {
                pointedCounts.set(d, pointedCounts.getDef(d) + 1);
            }
        }

        return Array.from(deps.keys()).
            sort((s1: string, s2: string) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                let result = pointedCounts.get(s1)! - pointedCounts.get(s2)!;
                if (result === 0) {
                    // the more objects depend on the current key, the better
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    result = deps.get(s2)!.length - deps.get(s1)!.length;
                    if (result === 0) {
                        // preserve original order
                        result = froms.indexOf(s1) - froms.indexOf(s2);
                    }
                }
                return result;
            });
    }

    private _initialSort(): Array<Line> {
        const nodes = this._sortByDependencies();
        return this.component.content.filter((c: Content) => {
            return c instanceof Line;
        }).sort((c1: Content, c2: Content) => {
            const [a, b] = [c1 as Line, c2 as Line];
            let result = nodes.indexOf(a.components[0]) - nodes.indexOf(b.components[0]);
            if (result === 0) {
                result = a.combinedDirection() - b.combinedDirection();
                if (result === 0) {
                    result = nodes.indexOf(a.components[1]) - nodes.indexOf(b.components[1]);
                }
            }
            return result;
        }) as Array<Line>;

    }

    private _sort(): void {
        const orig = this._initialSort();
        // leave all content that is not explicitly an arrow connection
        // before the arrow lines that are being sorted
        const others = this.component.content.filter((c: Content) => {
            return !(c instanceof Line);
        });
        let sorted = new Array<Line>();
        let idx = 0;

        // now sort in the original sorted elements using already present 
        // elements: left side of arrow first, then right side.
        while (orig.length !== 0) {
            if (idx === sorted.length) {
                // take the first element of the original list
                sorted = sorted.concat(orig.splice(0, 1));
            }
            for (const c of sorted[idx].components) {
                for (let oidx = 0; oidx < orig.length; ++oidx) {
                    // sort in the elements that are already in the list
                    if (orig[oidx].components[0] === c || orig[oidx].components[1] === c) {
                        sorted = sorted.concat(orig.splice(oidx, 1));
                        --oidx;
                    }
                }
            }
            idx += 1;
        }
        this.component.content = others.concat(sorted);
    }

    /// collect the content of type `Line`, remove it from the actual content 
    // and return it
    private _extractLines(comp: Component): Array<Line> {
        let lines = new Array<Line>();
        const newContent = new Array<Content>();
        comp.content.forEach((c: Content) => {
            if (c instanceof Line) {
                // remove leading spaces
                c.sides[0] = c.sides[0].trimLeft();
                lines.push(c);
            } else {
                newContent.push(c);
            }
        });
        // recursive call
        if (comp.children) {
            comp.children.forEach((c: Component) => {
                lines = lines.concat(this._extractLines(c));
            });
        }
        if (lines.length > 0) {
            comp.content = newContent;
        }
        return lines;
    }

    private _componentNames(comp: Component, parentComponents?: Map<string, string>): Map<string, string> {
        let components = new Map<string, string>();
        const lineComponents = new Set<string>();
        const lineInterfaces = new Set<string>();
        comp.content.forEach((line: Content) => {
            if (line instanceof Line) {
                for (const c of line.components) {
                    if (c[0] === '[') {
                        const name = c.substr(1, c.length - 2);
                        if (!components.has(name)) {
                            lineComponents.add(name);
                        }
                    } else {
                        if (!components.has(c)) {
                            lineInterfaces.add(c);
                        }
                    }
                }
            }
            else if (line instanceof Definition) {
                if (line.isComponent()) {
                    lineComponents.delete(line.name);
                }
                else {
                    lineInterfaces.delete(line.name);
                }
                if (line.alias) {
                    const alias = line.isComponent() ? `[${line.alias}]` : line.alias;
                    components.set(line.name, alias);
                    components.set(line.alias, alias);
                }
                else {
                    const name = line.isComponent() ? `[${line.name}]` : line.name;
                    components.set(line.name, name);
                }
            }
        });
        if (comp.children !== undefined) {
            comp.children.forEach((c: Component) => {
                const childComponents = this._componentNames(c, components);
                for (const n of childComponents.keys()) {
                    lineComponents.delete(n);
                }
                components = new Map<string, string>([...components, ...childComponents]);
            });
        }
        if (comp.name !== undefined) {
            let hasComponents = lineComponents.size > 0;
            for (const v of components.values()) {
                if (v.startsWith('[')) {
                    hasComponents = true;
                    break;
                }
            }
            // hasComponents -> is component diagram, otherwise: class diagram
            const defaultItem = hasComponents ? "interface" : "class";

            for (const lc of lineInterfaces) {
                if (!components.has(lc) && (parentComponents === undefined || !parentComponents.has(lc))) {
                    const def = new Definition(defaultItem, lc);
                    comp.content = [def, ...comp.content];
                    components.set(lc, lc);                    
                }
            }
            for (const lc of lineComponents) {
                const def = new Definition("component", lc);
                comp.content = [def, ...comp.content];
                components.set(lc, `[${lc}]`);
            }
        }

        return components;
    }

    // add [] brackets to defined components - remove them otherwise 
    private _renameComponents(componentNames : Map<string,string>): void {
        this.component.content.forEach((line: Content) => {
            if (line instanceof Line) {
                for (let i = 0; i < line.components.length; ++i) {
                    let c = line.components[i];
                    if (c[0] == '[') {
                        c = c.substr(1, c.length - 2);
                    }
                    const name = componentNames.get(c);
                    if (name !== undefined) {
                        line.components[i] = name;
                    }
                }
            }
        });
    }


    private _extractComponents(lines: Array<Line>): void {
        this.component.content = this.component.content.concat(lines);
    }

    containsDefinition(): boolean {
        return this.component.content.find((c: Content) => { return c instanceof Definition; }) !== undefined;
    }

    restructure(): void {
        const componentNames = this._componentNames(this.component);
        if (this.component.children || this.containsDefinition()) {
            const lines = this._extractLines(this.component);
            this._extractComponents(lines);
        }
        this._renameComponents(componentNames);
    }

    autoFormat(): Component {
        this.restructure();
        this.component.content.forEach((c: Content) => {
            if (c instanceof Line) {
                if (c.arrow.right === "|>" || c.arrow.left === "<|") {
                    if (c.arrow.layout !== Layout.Vertical) {
                        // in case we already have a correct layout we don't temper with it
                        // (the user maybe knew what (s)he was doing...)
                        c.setCombinedDirection(CombinedDirection.Up);
                    }
                }
                else if (c.arrow.left === "o" || c.arrow.left === "*" || c.arrow.right === "o" || c.arrow.right === "*") {
                    if (c.arrow.layout !== Layout.Horizontal) {
                        // similar to above
                        c.setCombinedDirection(CombinedDirection.Right);
                    }
                }
            }
        });
        this._sort();
        this._sortPackages(this.component);
        return new Component(this.component.content, this.component.children, this.component.type, this.component.name);
    }

    private _contains(c: Component, name: string): boolean {
        for (const d of c.content) {
            /* istanbul ignore else */
            if (d instanceof Definition) {
                if (d.name === name || d.alias === name) {
                    return true;
                }
            }
        }
        if (c.children !== undefined) {
            for (const child of c.children) {
                return this._contains(child, name);
            }
        }
        return false;
    }

    private _sortPackages(component: Component) {
        if (component.children !== undefined) {
            const children = component.children;
            children.forEach((child: Component) => {
                this._sortPackages(child);
            });
            component.children = children.sort((c1: Component, c2: Component) => {
                // sort package definitions last that contain component definitions
                // which are used in lines first.
                for (const l of this.component.content) {
                    /* istanbul ignore else */
                    if (l instanceof Line) {
                        for (let c of l.components) {
                            if (c[0] == '[') {
                                c = c.substr(1, c.length - 2);
                            }
                            // reversed sort
                            if (this._contains(c1, c)) {
                                return 1;
                            }
                            if (this._contains(c2, c)) {
                                return -1;
                            }
                        }
                    }
                }
                // should not come here
                /* istanbul ignore next */
                throw new Error("component not found");
            });
        }
    }
}

const regex = /(.*\S+)(\s*)$/s;

export function autoFormatTxt(txt: string): string {
    const m = txt.match(regex);
    let ending = "";
    if (m) {
        txt = m[1];
        ending = m[2];
    }
    const component = Component.fromString(txt);
    const reformat = new Reformat(component);
    return reformat.autoFormat().toString() + ending;
}


