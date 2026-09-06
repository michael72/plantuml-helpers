import { DefaultMap } from "./helpers.js";

import { Component } from "./uml/component.js";
import { Content, Definition } from "./uml/definition.js";
import { Line } from "./uml/line.js";
import { orderNames } from "./sortKernels.js";

function _toKey(s: [string, string]): string {
  return s[0] + "," + s[1];
}

// The items with the most incoming dependencies should be on the right.
// The items with the most outgoing dependencies should be on the left.
// The strongest connected items should be neighbors.
// The items should be sorted by incoming/outgoing dependencies.
// The order of lines with arrows and the direction of the arrows cannot be changed!
// Sorting of sequences can only swap the definitions.

export class SortSequence {
  constructor(private component: Component) {}

  autoFormat(): Component {
    this._reformat();
    return this.component;
  }

  private _reformat(): void {
    // participant definitions define the order - they are automatically added if needed
    this.component.content = this._removeParticipants();
    const ordered = this._orderNames();

    const [newContentPre, newContentPost] = this._getOrderedContent(ordered);
    // set the ordered content
    this.component.content = newContentPre
      .concat(this.component.content)
      .concat(newContentPost);
  }

  private _removeParticipants(): Content[] {
    return this.component.content.filter((c: Content) => {
      return !(
        c instanceof Definition &&
        c.type === "participant" &&
        c.alias === undefined
      );
    });
  }

  private _orderNames(): string[] {
    const [depCount, names] = this._getCountsAndNames();

    const weights: Array<[string, string, number]> = [];
    for (const [k, v] of depCount) {
      const arr = k.split(",");
      const left = arr[0];
      const right = arr[1];
      /* v8 ignore else @preserve */
      if (
        left != null &&
        left.length > 0 &&
        right != null &&
        right.length > 0
      ) {
        weights.push([left, right, v]);
      }
    }

    return orderNames(names, weights);
  }

  private _getCountsAndNames(): [DefaultMap<string, number>, string[]] {
    const depCount = new DefaultMap<string, number>(() => 0);
    const names: string[] = [];

    for (const def of this.component.definitions()) {
      if (!names.includes(def.name)) {
        names.push(def.name);
      }
    }
    for (const line of this.component.lines()) {
      this._addLineComponentsNames(line, names);
      this._updateLineStats(line, depCount);
    }
    return [depCount, names];
  }

  private _addLineComponentsNames(line: Line, names: string[]): void {
    for (const item of line.components) {
      if (item != null && item.length > 0 && !names.includes(item)) {
        if (item === "[") {
          names.unshift(item);
        } else {
          names.push(item);
        }
      }
    }
  }

  private _updateLineStats(
    line: Line,
    depCount: DefaultMap<string, number>
  ): void {
    const key = _toKey([line.from(), line.to()]);
    depCount.set(key, depCount.getDef(key) + 1);
  }

  private _getOrderedContent(ordered: string[]): [Content[], Content[]] {
    // bring the names in `this.component` in the order as in `ordered`.
    // bring the definitions (if necessary) to the front
    const newContentPre: Content[] = [];
    const newContentPost: Content[] = [];
    const unordered: string[] = [];
    const defs: Definition[] = Array.from(this.component.definitions());
    const defNames = defs.map((d: Definition): string => {
      return d.name;
    });
    for (const c of this.component.content) {
      if (c instanceof Line) {
        for (const name of c.componentNames()) {
          if (!unordered.includes(name)) {
            unordered.push(name);
          }
        }
      } else {
        if (!unordered.includes(c.name)) {
          unordered.push(c.name);
        }
      }
    }
    if (ordered.join(",") !== unordered.join(",")) {
      for (const o of ordered) {
        let idx = defNames.indexOf(o);
        if (idx === -1) {
          newContentPost.push(new Definition("participant", o));
        } else {
          // definition stays where it was
          // all superfluous definitions (simple participants) have been removed by
          // _removeParticipants()
          // add reference to sorted section at the end
          const defAtIdx = defs[idx];
          /* v8 ignore else @preserve */
          if (defAtIdx) {
            newContentPost.push(defAtIdx.removeAlias());
          }

          // remove all other definitions by the current name from the original content
          let idxContent = 0;
          const nextIndex = (): boolean => {
            defNames[idx] = "";
            idx = defNames.indexOf(o);
            const currentDef = defs[idx];
            if (currentDef) {
              idxContent = this.component.content.indexOf(currentDef);
            }
            return idxContent !== -1 && idx !== -1;
          };
          while (nextIndex()) {
            this.component.content.splice(idxContent, 1);
          }
        }
      }
    }

    return [newContentPre, newContentPost];
  }
}
