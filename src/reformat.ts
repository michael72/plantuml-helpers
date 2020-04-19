import { DefaultMap } from './helpers';
import { Layout } from './uml/arrow';
import { Component, Content } from './uml/component';
import { Line, CombinedDirection } from './uml/line';

export class Reformat {
    private content: Array<Content>;
    constructor(private component: Component) {
        this.content = [...component.content];
    }

    private _sortByDependencies(): Array<Content> {
        // try to bring the components in order
        const deps = new DefaultMap<string, Array<string>>(() => []);
        const froms = new Array<string>();
        this.content.forEach((line: Content) => {
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
        return this.content.filter((c: Content) => {
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
        const others = this.content.filter((c: Content) => {
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
        this.content = others.concat(sorted);
    }

    autoFormat(): Component {
        this.content.forEach((c: Content) => {
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
        return new Component(this.content, this.component.type, this.component.name);
    }

}


const regex = /(.*\S+)(\s*)/s;

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


