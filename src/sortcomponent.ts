import { formatLines } from "./sorter.js";
import { Component } from "./uml/component.js";
import { Definition } from "./uml/definition.js";
import { Line } from "./uml/line.js";

export class SortComponent {
  constructor(private component: Component) {}

  autoFormat(rebuild: boolean): Component {
    this.restructure();
    const lines = Array.from(this.component.lines());
    formatLines(lines, rebuild);
    const definitions = Array.from(this.component.definitions());
    this.component.content = [...definitions, ...lines];
    this._sortPackages();
    return this.component;
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
          if (c?.startsWith(".") === true) {
            c = c.substring(1);
            if (c?.includes(".")) {
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

  private _extractLineDefinitions(
    comp: Component,
    names: Map<string, string>
  ): { lineComponents: Set<string>; lineInterfaces: Set<string> } {
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

  private _addDefinitions(
    def: Definition,
    components: Map<string, string>
  ): void {
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
      /* v8 ignore next @preserve */
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
        !(parentNames?.has(name) ?? false) &&
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
      /* v8 ignore else @preserve */
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
        if (c?.[0] == "[") {
          c = c.substring(1, c.length - 1);
        }
        /* v8 ignore else @preserve */
        if (c != null) {
          const name = componentNames.get(c);
          if (name !== undefined) {
            line.components[i] = name;
          }
        }
      }
    }
  }

}
