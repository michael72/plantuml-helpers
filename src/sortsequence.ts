import { DefaultMap } from "./helpers";
// sorting of sequences can only swap the definitions.
// I can _not_ however change the order of lines with arrows
// and also _not_ the direction of the arrows!

import { Component } from "./uml/component";
import { Content, Definition } from "./uml/definition";
import { Line } from "./uml/line";

export class SortSequence {
  constructor(private component: Component) {}
  autoFormat(): Component {
    this._reformat();
    return this.component;
  }

  _toKey(s: [string, string]): string {
    return s[0] + "," + s[1];
  }

  _toTup(s: string): [string, string] {
    const arr = s.split(",");
    return [arr[0], arr[1]];
  }

  static _hasKey(c: Content, key: string): boolean {
    if (c instanceof Line) {
      return c.components[0] === key || c.components[1] === key;
    }
    if (c instanceof Definition) {
      return c.name === key;
    }
    return false;
  }

  _reformat(): void {
    const depcount = new DefaultMap<string, number>(() => 0);
    const dcount = new DefaultMap<string, number>(() => 0);

    const items = new Array<string>();
    this.component.content = this.component.content.filter((c: Content) => {
      return !(c instanceof Definition && c.type === "participant");
    });

    for (const content of this.component.content) {
      if (content instanceof Definition) {
        items.push(content.name);
      } else if (content instanceof Line) {
        for (const item of content.components) {
          if (!items.includes(item)) {
            items.push(item);
          }
        }
        const [from, to] = content.components;
        const key = this._toKey([from, to]);
        depcount.set(key, depcount.getDef(key) + 1);
        dcount.set(from, dcount.getDef(from) + 1);
        dcount.set(to, dcount.getDef(to) + 1);
      } else {
        // ignore
      }
    }

    let bestTup: [string, string] = ["", ""];
    let bestNumFrom = 0;
    let bestNum = 0;
    for (const [tup, num] of depcount.entries()) {
      const from = tup[1];
      if (
        num > bestNum ||
        (num == bestNum && bestNumFrom < dcount.getDef(from))
      ) {
        bestNum = num;
        bestTup = this._toTup(tup);
        bestNumFrom = dcount.getDef(from);
      }
    }

    const ordered = new Array<string>();
    ordered.push(bestTup[0]);
    ordered.push(bestTup[1]);

    const remaining = new Set<string>();
    for (const i of items) {
      if (i != bestTup[0] && i != bestTup[1]) {
        remaining.add(i);
      }
    }

    // find the tuple with the most dependencies
    bestTup = ["", ""];
    const maxDeps = [0, 0];
    while (remaining.size > 0) {
      for (const r of remaining) {
        let left = 0;
        let right = 0;
        for (const i of ordered) {
          left += depcount.getDef(this._toKey([r, i]));
          right += depcount.getDef(this._toKey([i, r]));
        }
        if (left > maxDeps[0] && left > right) {
          maxDeps[0] = left;
          bestTup[0] = r;
        } else if (right > maxDeps[0] && right > left) {
          maxDeps[1] = right;
          bestTup[1] = r;
        }
      }
      if (bestTup[0]) {
        // insert at the beginning
        ordered.splice(0, 0, bestTup[0]);
        remaining.delete(bestTup[0]);
      }
      if (bestTup[1]) {
        ordered.push(bestTup[1]);
        remaining.delete(bestTup[1]);
      }
      if (!(bestTup[0] || bestTup[1])) {
        // elements are disjoint
        // add the element with the most outgoing dependencies to the right
        let best = "";
        let bestVal = -1;
        for (const r1 of remaining) {
          let deps = 0;
          for (const r2 of remaining) {
            if (r1 !== r2) {
              deps += depcount.getDef(this._toKey([r1, r2]));
            }
          }
          if (deps > bestVal) {
            best = r1;
            bestVal = deps;
          }
        }
        ordered.push(best);
        remaining.delete(best);
      }
    }

    // finally: bring the items in `this.component` in order
    // the ordering shall be done as in `ordered`
    // bring the definitions (if necessary) to the front
    const newContent = new Array<Content>();

    for (const key of ordered) {
      const contained = newContent.some((c: Content) => {
        return SortSequence._hasKey(c, key);
      });

      if (!contained) {
        const first = this.component.content[0];
        if (first instanceof Line || first instanceof Definition) {
          if (
            !(first instanceof Line) ||
            (first.components[0] != key && first.components[1] != key)
          ) {
            const newDef = new Definition("participant", key);
            newContent.push(newDef);
          }
        }
        newContent.push(first);
        this.component.content.splice(0, 1);
      }
    }
    // set the ordered content
    this.component.content = newContent.concat(this.component.content);
  }
}
