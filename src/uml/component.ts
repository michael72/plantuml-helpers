import { compToString, toString, Content, Definition } from "./definition";
import { Line } from "./line";

export class Component {
  constructor(
    public content: Array<Content>,
    public children?: Array<Component>,
    public type?: string,
    public name?: string,
    public suffix?: string, // content between name and opening brace: could be color, stereotype and/or link etc.
    private printName?: string
  ) {}

  static regexTitle = /\s*(package|namespace|node|folder|frame|cloud|database|class|component|interface|enum|annotation)\s+([^{\s]*)\s*([^{]*)?{.*/;

  static fromString(s: string | Array<string>): Component {
    let arr = typeof s === "string" ? s.split("\n") : s;
    // pre-filter: remove single open braces { and put them at the end of the previous line
    for (let i = 0; i < arr.length; ++i) {
      if (i > 0 && arr[i].trim().startsWith("{")) {
        arr[i - 1] += " " + arr[i];
        arr[i] = "";
      }
      arr[i] = arr[i].trimRight();
    }
    // post-filter: remove empty lines
    arr = arr.filter((line: string) => {
      return line.length > 0;
    });

    // multiple components in sequence
    const parent = new Component(new Array<Content>());
    const children = new Array<Component>();
    for (let i = 0; i < arr.length; ++i) {
      const [comp, new_i] = this._fromString(arr, i);
      i = new_i;
      children.push(comp);
    }
    // shortcut: return the only child
    if (children.length == 1) {
      return children[0];
    }
    parent.children = children;
    return parent;
  }

  private static _fromString(
    arr: Array<string>,
    start: number
  ): [Component, number] {
    // empty lines are being removed
    let type: string | undefined;
    let name: string | undefined;
    let printName: string | undefined;
    let suffix: string | undefined;

    let i = start;
    const m = this.regexTitle.exec(arr[i]);

    if (m && arr.length > 1) {
      // found a component definition
      ++i;
      type = m[1];
      printName = m[2];
      if (printName) {
        // remove quotes
        name = printName.startsWith('"')
          ? printName.substring(1, printName.length - 1)
          : printName;
      }
      if (m[3]) {
        suffix = m[3].trimRight();
      }
    }

    let prevLine: Line | undefined;
    const content = new Array<Content>();
    let children: Array<Component> | undefined = undefined;

    // parse the content of the component
    for (; i < arr.length; ++i) {
      const s = arr[i];
      const def = Definition.fromString(s);
      if (def) {
        content.push(def);
      } else if (this.regexTitle.exec(s)) {
        // parse child element until closing bracket
        const [child, next] = this._fromString(arr, i);
        children = children ? children : [];
        children.push(child);
        i = next;
      } else {
        const line = Line.fromString(s);
        if (line) {
          prevLine = line;
          content.push(line);
        } else if (s.trim() == "}") {
          break;
        } else if (prevLine) {
          prevLine.attach(s);
        } else {
          content.push(s);
        }
      }
    }

    return [new this(content, children, type, name, suffix, printName), i];
  }

  static DEFAULT_TAB = "  ";

  private _toStringTab(tab: string, lf: string): string {
    if (this.type != null && this.type) {
      let t = tab;
      let header = this.type;
      for (const s of [this.printName, this.suffix]) {
        if (s != null && s) {
          header += " " + s;
        }
      }
      let result = t + header.trimLeft() + " {" + lf;
      t += Component.DEFAULT_TAB;
      const idx = this.content.findIndex((c: Content) => {
        return c instanceof Line;
      });
      if (idx !== 0) {
        result +=
          t +
          this.content
            .slice(0, idx === -1 ? this.content.length : idx)
            .map((s: Content) => {
              return compToString(s).trimLeft();
            })
            .join("\n" + t);
      }
      result = result.trimRight();
      if (this.children) {
        for (const child of this.children) {
          result += lf + child._toStringTab(t, lf).trimRight();
        }
      }
      if (idx !== -1) {
        result +=
          lf +
          t +
          this.content
            .slice(idx)
            .map((s: Content) => {
              return compToString(s).trimLeft();
            })
            .join(lf + t);
      }

      t = t.substring(Component.DEFAULT_TAB.length);
      result = result.trimRight() + lf + t + "}\n";
      return result;
    }

    let result = "";
    if (this.children) {
      for (const child of this.children) {
        if (result.length > 0) {
          result += lf;
        }
        result += child._toStringTab(tab, lf).trimRight();
      }
      if (this.content.length > 0) {
        result += lf;
      }
    }
    result += toString(this.content, lf);
    return result;
  }

  toString(lf?: string): string {
    return this._toStringTab("", lf == null ? "\n" : lf);
  }

  hasDefinition(name: string): boolean {
    for (const d of this.definitions()) {
      if (d.name === name || d.alias === name) {
        return true;
      }
    }
    return false;
  }

  isNamespace(): boolean {
    return this.type === "namespace";
  }

  isComponent(): boolean {
    return this.type === "component";
  }

  hasNamespace(name: string): boolean {
    return (
      this.name !== undefined &&
      this.isNamespace() &&
      name.startsWith(this.name)
    );
  }

  containsName(name: string): boolean {
    return this.anyOf(
      (child) =>
        child.name == name ||
        child.hasDefinition(name) ||
        child.hasNamespace(name)
    );
  }

  *lines(): Generator<Line> {
    for (const c of this.content) {
      if (c instanceof Line) {
        yield c;
      }
    }
  }

  *definitions(): Generator<Definition> {
    for (const c of this.content) {
      if (c instanceof Definition) {
        yield c;
      }
    }
  }

  *noLines(): Generator<Definition | string> {
    for (const c of this.content) {
      if (!(c instanceof Line)) {
        yield c;
      }
    }
  }

  anyOf(chk: (c: Component) => boolean): boolean {
    if (chk(this)) {
      return true;
    }
    if (this.children) {
      for (const c of this.children) {
        if (c.anyOf(chk)) {
          return true;
        }
      }
    }
    return false;
  }

  forAll(fun: (c: Component) => void): void {
    fun(this);
    if (this.children) {
      for (const c of this.children) {
        c.forAll(fun);
      }
    }
  }
}
