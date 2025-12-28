import { Attachable } from "./attachable";
import { toString, joinContent, Content, Definition } from "./definition";
import { Line } from "./line";

export class Component {
  constructor(
    public header: Array<string>,
    public content: Array<Content>,
    public footer: Array<string>,
    public children?: Array<Component>,
    public type?: string,
    public name?: string,
    public suffix?: string, // content between name and opening brace: could be color, stereotype and/or link etc.
    private printName?: string
  ) {}

  static regexTitle =
    /\s*(package|namespace|node|folder|frame|cloud|database|class|component|interface|enum|annotation)\s+([^{\s]*)\s*([^{]*)?{.*/;

  static fromString(
    s: string | Array<string>,
    keepEmptyLines = false
  ): Component {
    let arr = typeof s === "string" ? s.split("\n") : s;
    // pre-filter: remove single open braces { and put them at the end of the previous line
    for (let i = 0; i < arr.length; ++i) {
      const currentLine = arr[i];
      const prevLine = arr[i - 1];
      if (i > 0 && currentLine !== undefined && currentLine.length > 0 && prevLine !== undefined && prevLine.length > 0 && currentLine.trim().startsWith("{")) {
        arr[i - 1] = prevLine + " " + currentLine;
        arr[i] = "";
      }
      const lineToTrim = arr[i];
      if (lineToTrim !== undefined && lineToTrim.length > 0) {
        arr[i] = lineToTrim.trimEnd();
      }
    }
    // post-filter: remove empty lines
    if (!keepEmptyLines) {
      arr = arr.filter((line: string) => {
        return line.trim().length > 0;
      });
    }

    // multiple components in sequence
    const parent = new Component(
      new Array<string>(),
      new Array<Content>(),
      new Array<string>()
    );
    const children = new Array<Component>();
    var emptyComp: undefined | Component = undefined
    for (let i = 0; i < arr.length; ++i) {
      const [comp, new_i] = this._fromString(arr, i);
      if (comp.type === undefined && comp.content?.length === 0) {
        emptyComp = comp;
        i = new_i;
      } else { 
        if (emptyComp != undefined) {
          // copy header
          const header = emptyComp.header
          for (let j = 0; j < header.length; ++j) {
            /* v8 ignore next */
            const copyHeader = header[j] ?? ""
            comp.header.splice(j, 0, copyHeader);
          }
          emptyComp = undefined;
        }
        children.push(comp);
        i = new_i;
      }
    }
    if (emptyComp != undefined) {
      children.push(emptyComp)
    }
    // shortcut: return the only child
    if (children.length === 1) {
      const firstChild = children[0];
      if (firstChild) {
        return firstChild;
      }
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
    const currentLine = arr[i];
    if (currentLine === undefined || currentLine.length === 0) {
      /* v8 ignore next */
      const header = currentLine === undefined ? [] : [currentLine]
      return [new Component(header, [], []), i];
    }
    const m = this.regexTitle.exec(currentLine);

    if (m && arr.length > 1) {
      // found a component definition
      ++i;
      type = m[1];
      printName = m[2];
      if (printName !== undefined && printName.length > 0) {
        // remove quotes
        name = printName.startsWith('"')
          ? printName.substring(1, printName.length - 1)
          : printName;
      }
      if (m[3] !== undefined && m[3].length > 0) {
        suffix = m[3].trimEnd();
      }
    }

    let prevLine: Attachable | undefined;
    const header = new Array<string>();
    const content = new Array<Content>();
    let footer = new Array<string>();
    let children: Array<Component> | undefined = undefined;

    // parse the content of the component
    for (; i < arr.length; ++i) {
      const s = arr[i];
      if (s === undefined || s.length === 0) {
        // Skip empty lines instead of using continue
        // Process next line in the next iteration
      } else {
        const def = Definition.fromString(s);
        if (def) {
          content.push(def);
          prevLine = def;
        } else if (this.regexTitle.exec(s)) {
          // parse child element until closing bracket
          const [child, next] = this._fromString(arr, i);
          children = children ?? [];
          children.push(child);
          i = next;
        } else {
          const class_types = [
            "abstract",
            "abstract class",
            "annotation",
            "class",
            "entity",
            "enum",
            "interface",
          ];
          const line =
            type !== undefined && class_types.includes(type)
              ? undefined
              : Line.fromString(s);
          if (line) {
            prevLine = line;
            content.push(line);
          } else if (s.trim() === "}") {
            break;
          } else if (prevLine) {
            prevLine.attach(s);
          } else {
            header.push(s);
          }
        }
      }
    }
   if (prevLine) {
      footer = prevLine.moveAttached();
    }

    return [
      new this(
        header,
        content,
        footer,
        children,
        type,
        name,
        suffix,
        printName
      ),
      i,
    ];
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

  containsName(name: string): boolean {
    return this.anyOf(
      (child) =>
        child.name === name ||
        child.hasDefinition(name) ||
        child.hasNamespace(name)
    );
  }

  *definitions(): Generator<Definition> {
    for (const c of this.content) {
      if (c instanceof Definition) {
        yield c;
      }
    }
  }

  forAll(fun: (c: Component) => void): void {
    fun(this);
    if (this.children) {
      for (const c of this.children) {
        c.forAll(fun);
      }
    }
  }

  hasDefinition(name: string): boolean {
    for (const d of this.definitions()) {
      if (d.name === name || d.alias === name) {
        return true;
      }
    }
    return false;
  }

  hasNamespace(name: string): boolean {
    return (
      this.name !== undefined &&
      this.isNamespace() &&
      name.startsWith(this.name)
    );
  }

  isComponent(): boolean {
    return this.type === "component";
  }

  isNamespace(): boolean {
    return this.type === "namespace";
  }

  *lines(): Generator<Line> {
    for (const c of this.content) {
      if (c instanceof Line) {
        yield c;
      }
    }
  }

  toString(lf?: string): string {
    return this._toStringTab("", lf ?? "\n");
  }

  static DEFAULT_TAB = "  ";
  private _toStringTab(tab: string, lf: string): string {
    if (this.type !== undefined && this.type) {
      let t = tab;
      let header = this.type;
      for (const s of [this.printName, this.suffix]) {
        if (s !== undefined && s) {
          header += " " + s;
        }
      }
      let result = t + header.trimLeft() + " {" + lf;
      t += Component.DEFAULT_TAB;
      const idx = this.content.findIndex((c: Content) => {
        return c instanceof Line;
      });
      const headerContent = this.header
        .map((s: string) => {
          return s.trimLeft();
        })
        .join("\n" + t)
        .trimEnd();
      if (headerContent) {
        result += t + headerContent;
      }
      if (idx !== 0) {
        result +=
          t +
          this.content
            .slice(0, idx === -1 ? this.content.length : idx)
            .map((s: Content) => {
              return s.toString().trimLeft();
            })
            .join("\n" + t);
      }
      result = result.trimEnd();
      if (this.children) {
        for (const child of this.children) {
          result += lf + child._toStringTab(t, lf).trimEnd();
        }
      }
      if (idx !== -1) {
        result +=
          lf +
          t +
          this.content
            .slice(idx)
            .map((s: Content) => {
              return s.toString().trimLeft();
            })
            .join(lf + t);
      }

      t = t.substring(Component.DEFAULT_TAB.length);
      result = result.trimEnd() + lf + t + "}\n";
      return result;
    }

    let result = "";
    if (this.children) {
      for (const child of this.children) {
        result = joinContent(
          result,
          child._toStringTab(tab, lf).trimEnd(),
          lf,
          false
        );
      }
    }
    result = joinContent(this.header.join(lf), result, lf);
    result = joinContent(result, toString(this.content, lf), lf);
    result = joinContent(result, this.footer.join(lf), lf);
    return result;
  }
}
