import { DefaultMap } from "./helpers";
import { Component } from "./uml/component";
import { Content, Definition } from "./uml/definition";
import { Line } from "./uml/line";

export class SortComponent {
  constructor(private component: Component) {}

  private _sortByDependencies(): Array<Content> {
    // try to bring the components in order
    const { deps, froms } = this._calcDependencies();

    const pointedCounts = this._calcPointedCounts(deps);

    return Array.from(deps.keys()).sort((s1: string, s2: string) => {
      // sort objects to the beginning that are the least pointed to
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      let result = pointedCounts.get(s1)! - pointedCounts.get(s2)!;
      if (result === 0) {
        // more objects depend on the current key: sort to the end
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

  private _calcPointedCounts(deps: DefaultMap<string, string[]>) {
    const pointedCounts = new DefaultMap<string, number>(() => 0);
    for (const [k, v] of deps.entries()) {
      pointedCounts.set(k, 0);
      // add transitive dependencies - meaning that if deps contains
      // A -> B and B -> C then dependency A -> C should be added to deps
      this._addTransitiveDeps(deps, v);
    }
    for (const v of deps.values()) {
      for (const d of v) {
        pointedCounts.set(d, pointedCounts.getDef(d) + 1);
      }
    }

    return pointedCounts;
  }

  private _addTransitiveDeps(
    deps: DefaultMap<string, string[]>,
    safedDeps: string[]
  ) {
    // addedDeps will contain the newly added dependencies, which will be used in the next round again
    let addedDeps = safedDeps;
    while (addedDeps.length !== 0) {
      addedDeps = addedDeps.flatMap((c) =>
        Array.from(this._addItemDeps(deps.get(c), safedDeps))
      );
    }
  }

  private *_addItemDeps(
    dependentComponents: string[] | undefined,
    safedDeps: string[]
  ): Generator<string> {
    if (dependentComponents) {
      for (const d of dependentComponents) {
        // only add elements that are not already contained
        if (!safedDeps.includes(d)) {
          safedDeps.push(d);
          yield d;
        }
      }
    }
  }

  private _calcDependencies() {
    const deps = new DefaultMap<string, Array<string>>(() => []);
    const fromSet = new Set<string>();
    for (const line of this.component.lines()) {
      const [from, to] = line.components;
      deps.getDef(from).push(to);
      fromSet.add(from);
    }
    const froms = Array.from(fromSet.values());
    return { deps, froms };
  }

  private _initialSort(): Array<Line> {
    const nodes = this._sortByDependencies();
    return Array.from(this.component.lines()).sort((a: Line, b: Line) => {
      let result =
        nodes.indexOf(a.components[0]) - nodes.indexOf(b.components[0]);
      if (result === 0) {
        result = a.combinedDirection() - b.combinedDirection();
        if (result === 0) {
          result =
            nodes.indexOf(a.components[1]) - nodes.indexOf(b.components[1]);
        }
      }
      return result;
    });
  }

  private _sort(): void {
    const orig = this._initialSort();
    // leave all content that is not explicitly an arrow connection
    // before the arrow lines that are being sorted
    const others: Array<Content> = Array.from(this.component.noLines());
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
          if (
            orig[oidx].components[0] === c ||
            orig[oidx].components[1] === c
          ) {
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
    let extracted = new Array<Line>();
    comp.forAll((c) => {
      const lines = this._adaptNames(c);
      if (lines.length > 0) {
        c.content = Array.from(c.noLines());
      }
      extracted = extracted.concat(lines);
    });
    return extracted;
  }

  private _adaptNames(c: Component): Array<Line> {
    const lines = Array.from(c.lines());
    for (const line of lines) {
      // remove leading spaces
      line.sides[0] = line.sides[0].trimLeft();
      if (c.isNamespace()) {
        this._addNamespace(line, c.name == null ? "" : c.name);
      }
    }
    return lines;
  }

  private _addNamespace(c: Line, compName: string) {
    for (let i = 0; i < c.components.length; ++i) {
      const name = c.components[i];
      if (name.lastIndexOf(".") < 1) {
        c.components[i] = name.startsWith(".")
          ? name.substr(1)
          : compName + "." + name;
      }
    }
  }

  private _componentNames(
    comp: Component,
    parentComponents?: Map<string, string>
  ): Map<string, string> {
    let components = new Map<string, string>();
    const lineComponents = new Set<string>();
    const lineInterfaces = new Set<string>();
    if (comp.name != null && comp.name) {
      components.set(
        comp.name,
        comp.isComponent() ? `[${comp.name}]` : comp.name
      );
    }
    for (const line of comp.content) {
      if (line instanceof Line) {
        for (let i = 0; i < line.components.length; ++i) {
          let c = line.components[i];
          if (comp.isNamespace()) {
            if (c.startsWith(".")) {
              c = c.substr(1);
              if (c.indexOf(".") !== -1) {
                // rename .a.b.c to a.b.c
                line.components[i] = c;
              }
            }
          }
          if (c.startsWith("[")) {
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
      } else if (line instanceof Definition) {
        if (line.isComponent()) {
          lineComponents.delete(line.name);
        } else {
          lineInterfaces.delete(line.name);
        }
        if (line.alias != null && line.alias) {
          const alias = line.isComponent() ? `[${line.alias}]` : line.alias;
          components.set(line.name, alias);
          components.set(line.alias, alias);
        } else {
          const name = line.isComponent() ? `[${line.name}]` : line.name;
          components.set(line.name, name);
        }
      }
    }
    for (const name of lineComponents) {
      components.set(name, `[${name}]`);
    }
    if (comp.children) {
      for (const c of comp.children) {
        const childComponents = this._componentNames(c, components);
        for (const n of childComponents.keys()) {
          lineComponents.delete(n);
        }
        components = new Map<string, string>([
          ...components,
          ...childComponents,
        ]);
      }
    }
    if (comp.name != null && comp.name) {
      let hasComponents = lineComponents.size > 0;
      for (const v of components.values()) {
        if (v.startsWith("[")) {
          hasComponents = true;
          break;
        }
      }
      // hasComponents -> is component diagram, otherwise: class diagram
      const defaultItem = hasComponents ? "interface" : "class";

      for (let name of lineInterfaces) {
        if (
          !components.has(name) &&
          (parentComponents === undefined || !parentComponents.has(name))
        ) {
          if (comp.isNamespace()) {
            if (name.includes(".")) {
              name = "";
            }
          } else {
            components.set(name, name);
          }
          if (name) {
            const def = new Definition(defaultItem, name);
            comp.content = [def, ...comp.content];
          }
        }
      }
      for (const name of lineComponents) {
        const def = new Definition("component", name);
        comp.content = [def, ...comp.content];
      }
    }

    return components;
  }

  // add [] brackets to defined components - remove them otherwise
  private _renameComponents(componentNames: Map<string, string>): void {
    for (const line of this.component.lines()) {
      for (let i = 0; i < line.components.length; ++i) {
        let c = line.components[i];
        if (c[0] == "[") {
          c = c.substr(1, c.length - 2);
        }
        const name = componentNames.get(c);
        if (name !== undefined) {
          line.components[i] = name;
        }
      }
    }
  }

  private _extractComponents(lines: Array<Line>): void {
    this.component.content = this.component.content.concat(lines);
  }

  containsDefinition(): boolean {
    return (
      this.component.content.find((c: Content) => {
        return c instanceof Definition;
      }) !== undefined
    );
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
    for (const c of this.component.content) {
      if (c instanceof Line) {
        c.setDefaultDirection();
      }
    }
    this._sort();
    this._sortPackages();
    return this.component;
  }

  private _sortPackages(component: Component = this.component) {
    component.forAll((c) => {
      if (c.children) {
        c.children = this._sorted(c.children);
      }
    });
  }

  private _sorted(children: Component[]): Component[] {
    return children.sort((c1: Component, c2: Component) => {
      // sort package definitions last that contain component definitions
      // which are used in lines first.
      for (const l of this.component.lines()) {
        for (const name of l.componentNames()) {
          // reversed sort
          if (c1.containsName(name)) {
            return 1;
          }
          if (c2.containsName(name)) {
            return -1;
          }
        }
      }
      // should not come here
      /* istanbul ignore next */
      throw new Error("component not found");
    });
  }
}
