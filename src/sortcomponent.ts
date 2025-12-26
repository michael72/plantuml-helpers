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

    const lines: Line[] = [];
    for (const c of this.component.content) {
      if (c instanceof Line) {
        lines.push(c);
      }
    }
    const dummyLine = Line.fromString("__dummy->__dummy");
    if (dummyLine) {
      lines.push(dummyLine);
    }

    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
      if (line == null) {
        // ignore line
      } else {
        const name = line.components[0] ?? "";
        const dir = line.layout();
        if (name === prevName && dir === prevDir) {
          cnt += 1;
        } else {
          prevName = name;
          prevDir = dir;
          cnt += 1;
          let c = (cnt - (cnt % 3)) / 3;
          if (cnt == 2) {
            // special case: only 2 same arrows going out:
            // rotate the first to right
            const targetLine = lines[i - cnt];
            if (targetLine) {
              targetLine.rotateRight();
            }
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
              const targetLine = lines[j];
              if (targetLine) {
                targetLine.rotateLeft();
              }
            }
            start = end;
            end += c;
            if (dir == Layout.Horizontal && cnt % 3 == 1) {
              end += 1;
            }
            for (let j = start; j < end; ++j) {
              const targetLine = lines[j];
              if (targetLine) {
                targetLine.rotateRight();
              }
            }
          }
          cnt = 0;
        }
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
    const others: Content[] = Array.from(this.component.definitions());
    let sorted: Line[] = [];
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

  private _initialSort(): Line[] {
    const nodes = this._sortByDependencies();
    return Array.from(this.component.lines()).sort((a: Line, b: Line) => {
      const aComp0 = a.components[0] ?? "";
      const bComp0 = b.components[0] ?? "";
      let result = nodes.indexOf(aComp0) - nodes.indexOf(bComp0);
      if (result === 0) {
        result = a.combinedDirection() - b.combinedDirection();
        if (result === 0) {
          const aComp1 = a.components[1] ?? "";
          const bComp1 = b.components[1] ?? "";
          result = nodes.indexOf(aComp1) - nodes.indexOf(bComp1);
        }
      }
      return result;
    });
  }

  private _sortByDependencies(): string[] {
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

  private _calcDependencies(): { deps: DefaultMap<string, string[]>; froms: string[] } {
    const deps = new DefaultMap<string, string[]>(() => []);
    const fromSet = new Set<string>();
    for (const line of this.component.lines()) {
      const from = line.components[0] ?? "";
      const to = line.components[1] ?? "";
      deps.getDef(from).push(to);
      fromSet.add(from);
    }
    const froms = Array.from(fromSet.values());
    return { deps, froms };
  }

  private _calcPointedCounts(deps: DefaultMap<string, string[]>): DefaultMap<string, number> {
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
  ): void {
    // addedDeps will contain the newly added dependencies, which will be used in the next round again
    let addedDeps = savedDeps;
    while (addedDeps.length !== 0) {
      addedDeps = addedDeps.flatMap((c) =>
        Array.from(this._itemDeps(deps.get(c), savedDeps))
      );
    }
  }

  private _moveOrigToSorted(sorted: Line[], lineIdx: number, orig: Line[]): Line[] {
    const currentLine = sorted[lineIdx];
    if (!currentLine) return sorted;

    for (const c of currentLine.components) {
      if (c == null) {
        // skip
      } else {
        for (let oidx = 0; oidx < orig.length; ++oidx) {
          const origLine = orig[oidx];
          // move lines to sorted with elements that are already in the sorted lines
          if (origLine?.has(c) ?? false) {
            sorted = sorted.concat(orig.splice(oidx, 1));
            --oidx;
          }
        }
      }
    }
    return sorted;
  }

  private _sortPackages(component: Component = this.component): void {
    component.forAll((c) => {
      if (c.children) {
        c.children = this._sorted(c.children);
      }
    });
  }

  private _sorted(children: Component[]): Component[] {
    return children.sort((c1: Component, c2: Component): number => {
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

  private _removeLeadingDots(comp: Component): void {
    if (comp.isNamespace()) {
      for (const line of comp.lines()) {
        for (let i = 0; i < line.components.length; i++) {
          let c = line.components[i];
          if ((c?.startsWith(".")) ?? false) {
            c = c!.substring(1);
            if (c.includes(".") ?? false) {
              // rename .a.b.c to a.b.c
              line.components[i] = c!;
            }
          }
        }
      }
    }
  }

  private _getComponentNames(comp: Component): Map<string, string> {
    const names = new Map<string, string>();
    if (comp.name != null && comp.name) {
      names.set(comp.name, comp.isComponent() ? `[${comp.name}]` : comp.name);
    }
    return names;
  }

  private _extractLineDefinitions(comp: Component, names: Map<string, string>): { lineComponents: Set<string>; lineInterfaces: Set<string> } {
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

  private _addDefinitions(def: Definition, components: Map<string, string>): void {
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
  ): void {
    for (const c of line.components) {
      if (c == null) {
        // skip
      } else {
        const isComponent = c.startsWith("[");
        const name = isComponent ? c.substring(1, c.length - 1) : c;
        if (!names.has(name)) {
          (isComponent ? lineComponents : lineInterfaces).add(name);
        }
      }
    }
  }

  private _mergeChildComponents(
    comp: Component,
    names: Map<string, string>,
    lineComponents: Set<string>
  ): void {
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
  ): string[] {
    const isNamespace = comp.isNamespace();
    return Array.from(lineInterfaces).filter(
      (name) =>
        !names.has(name) &&
        (!((parentNames?.has(name)) ?? false)) &&
        (!isNamespace || !name.includes("."))
    );
  }

  private _hasComponents(
    lineComponents: Set<string>,
    names: Map<string, string>
  ): boolean {
    // hasComponents -> is a component diagram, otherwise: class diagram
    return (
      lineComponents.size > 0 ||
      Array.from(names.values()).some((v) => v.startsWith("["))
    );
  }

  private _addLineDefinitions(
    comp: Component,
    lineComponents: Set<string>,
    lineInterfaces: string[],
    defaultItem: string
  ): void {
    if (comp.name != null && comp.name) {
      this._addDefinitionsByNames(lineInterfaces, comp, defaultItem);
      this._addDefinitionsByNames(lineComponents, comp);
    }
  }

  private _addDefinitionsByNames(
    names: Iterable<string>,
    comp: Component,
    defType = "component"
  ): void {
    for (const name of names) {
      const def = new Definition(defType, name);
      comp.content = [def, ...comp.content];
    }
  }

  /// collect the content of type `Line`, remove it from the actual content
  // and return it
  private _extractLines(comp: Component): Line[] {
    let extracted: Line[] = [];
    comp.forAll((c) => {
      const lines = this._linesWithAdaptedNames(c);
      if (lines.length > 0) {
        c.content = Array.from(c.definitions());
      }
      extracted = extracted.concat(lines);
    });
    return extracted;
  }

  private _linesWithAdaptedNames(c: Component): Line[] {
    const lines = Array.from(c.lines());
    for (const line of lines) {
      // remove leading spaces
      const leftSide = line.sides[0];
      if (leftSide != null) {
        line.sides[0] = leftSide.trimStart();
      }
      if (c.isNamespace()) {
        this._addNamespace(line, c.name!);
      }
    }
    return lines;
  }

  private _addNamespace(c: Line, compName: string): void {
    for (let i = 0; i < c.components.length; ++i) {
      const name = c.components[i];
      if (name != null && name.lastIndexOf(".") < 1) {
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
        if (c != null && c[0] == "[") {
          c = c.substring(1, c.length - 1);
        }
        if (c != null) {
          const name = componentNames.get(c);
          if (name !== undefined) {
            line.components[i] = name;
          }
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
