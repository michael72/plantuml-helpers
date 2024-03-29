/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DefaultMap } from "./helpers";
import { Layout } from "./uml/arrow";
import { Component } from "./uml/component";
import { Content, Definition } from "./uml/definition";
import { Line } from "./uml/line";

export class SortComponent {
  constructor(private component: Component) {}

  autoFormat(rebuild: boolean): Component {
    this.restructure();
    for (const line of this.component.lines()) {
      line.setDefaultDirection(rebuild);
    }
    this._sort();
    this._sortPackages();
    if (rebuild) {
      this._rebuild();
    }
    return this.component;
  }

  private _rebuild(): void {
    let prevName = "";
    let prevDir: Layout | undefined = undefined;
    let cnt = 0;

    const lines = new Array<Line>();
    for (const c of this.component.content) {
      if (c instanceof Line) {
        lines.push(c);
      }
    }
    lines.push(Line.fromString("__dummy->__dummy")!);

    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
      const name = line.components[0];
      const dir = line.layout();
      if (name === prevName && dir == prevDir) {
        cnt += 1;
      } else {
        prevName = name;
        prevDir = dir;
        cnt += 1;
        let c = (cnt - (cnt % 3)) / 3;
        if (cnt == 2) {
          // special case: only 2 same arrows going out:
          // rotate the first to right
          lines[i - cnt].rotateRight();
        }
        // 3 or more arrows going out
        else if (c != 0) {
          // leave the last arrows in the same direction
          // rotate the first ones to the left
          // rotate the in-between arrows to the right
          // <- ... | -> ... | ^ ...
          // rotate more when in horizontal layout: vertical arrows can also be drawn diagonally
          if (dir == Layout.Horizontal && cnt % 3 == 2) {
            c += 1;
          }
          let start = i - cnt;
          let end = start + c;
          for (let j = start; j < end; ++j) {
            lines[j].rotateLeft();
          }
          start = end;
          end += c;
          if (dir == Layout.Horizontal && cnt % 3 == 1) {
            end += 1;
          }
          for (let j = start; j < end; ++j) {
            lines[j].rotateRight();
          }
        }
        cnt = 0;
      }
    }
  }

  restructure(): void {
    const componentNames = this._componentNames(this.component);
    if (this.component.children) {
      // lines (A -> B) are moved from the inner components to the top level
      const lines = this._extractLines(this.component);
      this.component.content = this.component.content.concat(lines);
    }
    this._renameComponents(componentNames);
  }

  private _sort(): void {
    const orig = this._initialSort();
    // leave all content that is not explicitly an arrow connection
    // before the arrow lines that are being sorted
    const others: Array<Content> = Array.from(this.component.definitions());
    let sorted = new Array<Line>();
    let idx = 0;

    // now sort in the original sorted elements using already present
    // elements: left side of arrow first, then right side.
    while (orig.length !== 0) {
      if (idx === sorted.length) {
        // take the first element of the original list
        sorted = sorted.concat(orig.splice(0, 1));
      }
      sorted = this._moveOrigToSorted(sorted, idx, orig);
      idx++;
    }
    this.component.content = others.concat(sorted);
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

  private _sortByDependencies(): Array<string> {
    // try to bring the components in order
    const { deps, froms } = this._calcDependencies();

    const pointedCounts = this._calcPointedCounts(deps);

    return Array.from(deps.keys()).sort((s1: string, s2: string) => {
      // sort objects to the beginning that are the least pointed to
      let cmp = pointedCounts.get(s1)! - pointedCounts.get(s2)!;
      if (cmp === 0) {
        // more objects depend on the current key: sort to the end
        cmp = deps.get(s2)!.length - deps.get(s1)!.length;
        if (cmp === 0) {
          // preserve original order
          cmp = froms.indexOf(s1) - froms.indexOf(s2);
        }
      }
      return cmp;
    });
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
    savedDeps: string[]
  ) {
    // addedDeps will contain the newly added dependencies, which will be used in the next round again
    let addedDeps = savedDeps;
    while (addedDeps.length !== 0) {
      addedDeps = addedDeps.flatMap((c) =>
        Array.from(this._itemDeps(deps.get(c), savedDeps))
      );
    }
  }

  private _moveOrigToSorted(sorted: Line[], lineIdx: number, orig: Line[]) {
    for (const c of sorted[lineIdx].components) {
      for (let oidx = 0; oidx < orig.length; ++oidx) {
        // move lines to sorted with elements that are already in the sorted lines
        if (orig[oidx].has(c)) {
          sorted = sorted.concat(orig.splice(oidx, 1));
          --oidx;
        }
      }
    }
    return sorted;
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
      let result = 0;
      // sort package definitions last that contain component definitions
      // which are used in lines first.
      for (const l of this.component.lines()) {
        // reversed sort
        if (l.includes(c1)) {
          result = 1;
          break;
        }
        if (l.includes(c2)) {
          result = -1;
          break;
        }
      }
      return result;
    });
  }

  private _componentNames(
    comp: Component,
    parentComponents?: Map<string, string>
  ): Map<string, string> {
    this._removeLeadingDots(comp);
    const names = this._getComponentNames(comp);

    const { lineComponents, lineInterfaces } = this._extractLineDefinitions(
      comp,
      names
    );
    Array.from(lineComponents).forEach((n) => names.set(n, `[${n}]`));

    const interfaces = this._filterExistingInterfaces(
      comp,
      lineInterfaces,
      names,
      parentComponents
    );
    interfaces.forEach((i) => names.set(i, i));

    const defaultItem = this._hasComponents(lineComponents, names)
      ? "interface"
      : "class";
    this._addLineDefinitions(comp, lineComponents, interfaces, defaultItem);

    return names;
  }

  private _removeLeadingDots(comp: Component) {
    if (comp.isNamespace()) {
      for (const line of comp.lines()) {
        for (let i = 0; i < line.components.length; i++) {
          let c = line.components[i];
          if (c.startsWith(".")) {
            c = c.substring(1);
            if (c.includes(".")) {
              // rename .a.b.c to a.b.c
              line.components[i] = c;
            }
          }
        }
      }
    }
  }

  private _getComponentNames(comp: Component) {
    const names = new Map<string, string>();
    if (comp.name != null && comp.name) {
      names.set(comp.name, comp.isComponent() ? `[${comp.name}]` : comp.name);
    }
    return names;
  }

  private _extractLineDefinitions(comp: Component, names: Map<string, string>) {
    const lineComponents = new Set<string>();
    const lineInterfaces = new Set<string>();
    for (const def of comp.definitions()) {
      this._addDefinitions(def, names);
    }
    for (const line of comp.lines()) {
      this._getInterfacesAndComponents(
        line,
        lineComponents,
        lineInterfaces,
        names
      );
    }
    this._mergeChildComponents(comp, names, lineComponents);

    return { lineComponents, lineInterfaces };
  }

  private _addDefinitions(def: Definition, components: Map<string, string>) {
    const isAlias = def.alias != null && def.alias.length > 0;
    const aliasName = isAlias ? def.alias! : def.name;
    const compName = def.isComponent() ? `[${aliasName}]` : aliasName;
    components.set(aliasName, compName);
    if (isAlias) {
      components.set(def.name, compName);
    }
  }

  private _getInterfacesAndComponents(
    line: Line,
    lineComponents: Set<string>,
    lineInterfaces: Set<string>,
    names: Map<string, string>
  ) {
    for (const c of line.components) {
      const isComponent = c.startsWith("[");
      const name = isComponent ? c.substring(1, c.length - 1) : c;
      if (!names.has(name)) {
        (isComponent ? lineComponents : lineInterfaces).add(name);
      }
    }
  }

  private _mergeChildComponents(
    comp: Component,
    names: Map<string, string>,
    lineComponents: Set<string>
  ) {
    if (comp.children) {
      for (const c of comp.children) {
        const childComponents = this._componentNames(c, names);
        for (const [k, v] of childComponents.entries()) {
          lineComponents.delete(k);
          names.set(k, v);
        }
      }
    }
  }

  private _filterExistingInterfaces(
    comp: Component,
    lineInterfaces: Set<string>,
    names: Map<string, string>,
    parentNames: Map<string, string> | undefined
  ) {
    const isNamespace = comp.isNamespace();
    return Array.from(lineInterfaces).filter(
      (name) =>
        !names.has(name) &&
        (parentNames === undefined || !parentNames.has(name)) &&
        (!isNamespace || !name.includes("."))
    );
  }

  private _hasComponents(
    lineComponents: Set<string>,
    names: Map<string, string>
  ) {
    // hasComponents -> is a component diagram, otherwise: class diagram
    return (
      lineComponents.size > 0 ||
      Array.from(names.values()).some((v) => v.startsWith("["))
    );
  }

  private _addLineDefinitions(
    comp: Component,
    lineComponents: Set<string>,
    lineInterfaces: Array<string>,
    defaultItem: string
  ) {
    if (comp.name != null && comp.name) {
      this._addDefinitionsByNames(lineInterfaces, comp, defaultItem);
      this._addDefinitionsByNames(lineComponents, comp);
    }
  }

  private _addDefinitionsByNames(
    names: Iterable<string>,
    comp: Component,
    defType = "component"
  ) {
    for (const name of names) {
      const def = new Definition(defType, name);
      comp.content = [def, ...comp.content];
    }
  }

  /// collect the content of type `Line`, remove it from the actual content
  // and return it
  private _extractLines(comp: Component): Array<Line> {
    let extracted = new Array<Line>();
    comp.forAll((c) => {
      const lines = this._linesWithAdaptedNames(c);
      if (lines.length > 0) {
        c.content = Array.from(c.definitions());
      }
      extracted = extracted.concat(lines);
    });
    return extracted;
  }

  private _linesWithAdaptedNames(c: Component): Array<Line> {
    const lines = Array.from(c.lines());
    for (const line of lines) {
      // remove leading spaces
      line.sides[0] = line.sides[0].trimLeft();
      if (c.isNamespace()) {
        this._addNamespace(line, c.name!);
      }
    }
    return lines;
  }

  private _addNamespace(c: Line, compName: string) {
    for (let i = 0; i < c.components.length; ++i) {
      const name = c.components[i];
      if (name.lastIndexOf(".") < 1) {
        c.components[i] = name.startsWith(".")
          ? name.substring(1)
          : compName + "." + name;
      }
    }
  }

  // add [] brackets to defined components (saved to componentNames)
  private _renameComponents(componentNames: Map<string, string>): void {
    for (const line of this.component.lines()) {
      for (let i = 0; i < line.components.length; ++i) {
        let c = line.components[i];
        if (c[0] == "[") {
          c = c.substring(1, c.length - 1);
        }
        const name = componentNames.get(c);
        if (name !== undefined) {
          line.components[i] = name;
        }
      }
    }
  }

  private *_itemDeps(
    dependentComponents: string[] | undefined,
    savedDeps: string[]
  ): Generator<string> {
    if (dependentComponents) {
      for (const d of dependentComponents) {
        // only add elements that are not already contained
        if (!savedDeps.includes(d)) {
          savedDeps.push(d);
          yield d;
        }
      }
    }
  }
}
