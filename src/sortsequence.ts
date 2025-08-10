import { DefaultMap } from "./helpers";

import { Component } from "./uml/component";
import { Content, Definition } from "./uml/definition";
import { Line } from "./uml/line";

function _toKey(s: [string, string]): string {
  return s[0] + "," + s[1];
}

// The items with the most incoming dependencies should be on the right.
// The items with the most outgoing dependencies should be on the left.
// The strongest connected items should be neighbours.
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

  private _removeParticipants() {
    return this.component.content.filter((c: Content) => {
      return !(
        c instanceof Definition &&
        c.type === "participant" &&
        c.alias === undefined
      );
    });
  }

  private _calculateWeight(
    components: Array<string>,
    weights: Array<[string, string, number]>
  ): number {
    let sum = 0;
    const square = (a: number): number => {
      return a * a;
    };
    for (const [l, r, num] of weights) {
      sum += square((components.indexOf(l) - components.indexOf(r)) * num);
    }
    return sum;
  }

  private _calculateDirCount(
    components: Array<string>,
    weights: Array<[string, string, number]>
  ): number {
    let sum = 0;
    for (const [l, r, num] of weights) {
      const dist = components.indexOf(l) - components.indexOf(r);
      if (dist > 0) {
        sum += num;
      }
    }
    return sum;
  }

  private _orderNames(): Array<string> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [depCount, names] = this._getCountsAndNames();
    let filtered: Array<string> = [];

    const weights: Array<[string, string, number]> = [];
    for (const [k, v] of depCount) {
      const arr = k.split(",");
      const left = arr[0];
      const right = arr[1];
      if (left && right) {
        weights.push([left, right, v]);
      }
    }

    let off_left = names[0] === "[" ? 1 : 0;
    while (off_left != 0 && depCount.get("[," + names[off_left]) != undefined) {
      off_left += 1;
    }
    const off_right = names[names.length - 1] === "]" ? 1 : 0;

    let numElems = names.length - off_left - off_right;
    if (numElems >= 9) {
      filtered = this._filterSimpleConnections(names, depCount);
      numElems = names.length - off_left - off_right;
    }

    let ordered: Array<string> = [...names];
    let checklist = [...ordered];
    let minWeight = this._calculateWeight(ordered, weights);
    let minDirCount = this._calculateDirCount(ordered, weights);

    const swap = (arr: Array<string>, i: number, j: number) => {
      const temp = arr[i];
      const elemI = arr[i];
      const elemJ = arr[j];
      if (temp !== undefined && elemI !== undefined && elemJ !== undefined) {
        arr[i] = elemJ;
        arr[j] = elemI;
      }
    };

    const checkWeight = (recalc = false) => {
      const weight = this._calculateWeight(checklist, weights);
      if (weight <= minWeight || recalc) {
        const dirCount = this._calculateDirCount(checklist, weights);
        if (
          recalc ||
          weight < minWeight ||
          (weight == minWeight && dirCount < minDirCount)
        ) {
          minWeight = weight;
          minDirCount = dirCount;
          ordered = [...checklist];
          return true;
        }
      }
      return false;
    };

    const rotate = (left: number, right: number) => {
      let rotated: Array<string> = checklist.slice(left, right);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const popped = rotated.pop();
      if (popped !== undefined) {
        rotated.unshift(popped);
      }
      if (left > 0) {
        rotated = [...checklist.slice(0, left), ...rotated];
      }
      if (right < checklist.length) {
        rotated = [...rotated, ...checklist.slice(right)];
      }
      checklist = rotated;
    };

    if (numElems < 9) {
      // perform all permutations - for >= 9 this takes too long
      const counters = new Array<number>(numElems).fill(0);
      let i = 1;
      while (i < ordered.length - off_left - off_right) {
        const counterI = counters[i];
        if (counterI !== undefined && counterI < i) {
          const k = i % 2 && counterI;
          if (k !== undefined) {
            swap(checklist, i + off_left, k + off_left);
          }
          counters[i] = counterI + 1;
          i = 1;
          checkWeight();
        } else {
          if (counterI !== undefined) {
            counters[i] = 0;
          }
          ++i;
        }
      }
    } else {
      let finished = false;
      while (!finished) {
        finished = true;
        for (let i = off_left; i < ordered.length - off_right; i += 1) {
          for (let j = i + 1; j < ordered.length - off_right; j += 1) {
            for (let k = j - i - 1; k > 0; k--) {
              rotate(i, j + 1);
              if (checkWeight()) {
                finished = false;
              }
            }
            rotate(i, j);
          }
        }
      }
    }

    // re-add the simple connections
    for (const name of filtered) {
      let first = true;
      for (let i = checklist.length - off_right; i >= off_left; i -= 1) {
        checklist.splice(i, 0, name);
        checkWeight(first);
        first = false;
        checklist.splice(i, 1);
      }
      checklist = ordered;
    }

    return ordered.filter((c) => {
      return this._isRealComponent(c);
    });
  }

  private _isRealComponent(name: string): boolean {
    return (
      name.length > 1 || (name.length == 1 && name[0] != "[" && name[0] != "]")
    );
  }

  private _filterSimpleConnections(
    names: Array<string>,
    depCount: DefaultMap<string, number>
  ): Array<string> {
    const filtered: Array<string> = [];
    const deps = new DefaultMap<string, Array<string>>(() => {
      return new Array<string>();
    });
    for (const connection of depCount.keys()) {
      const arr = connection.split(",");
      const left = arr[0];
      const right = arr[1];
      if (left && right && this._isRealComponent(left) && this._isRealComponent(right)) {
        deps.getDef(left).push(right);
        deps.getDef(right).push(left);
      }
    }

    for (const name of names) {
      if (deps.getDef(name).length == 1) {
        filtered.push(name);
      }
    }
    for (const name of filtered) {
      names.splice(names.indexOf(name), 1);
    }
    return filtered;
  }

  private _getCountsAndNames(): [DefaultMap<string, number>, Array<string>] {
    const depCount = new DefaultMap<string, number>(() => 0);
    const names = new Array<string>();

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

  private _addLineComponentsNames(line: Line, names: string[]) {
    for (const item of line.components) {
      if (item && !names.includes(item)) {
        if (item === "[") {
          names.unshift(item);
        } else {
          names.push(item);
        }
      }
    }
  }

  private _updateLineStats(line: Line, depCount: DefaultMap<string, number>) {
    const from = line.components[0] || "";
    const to = line.components[1] || "";
    const key = _toKey([from, to]);
    depCount.set(key, depCount.getDef(key) + 1);
  }

  private _getOrderedContent(
    ordered: string[]
  ): [Array<Content>, Array<Content>] {
    // bring the names in `this.component` in the order as in `ordered`.
    // bring the definitions (if necessary) to the front
    const newContentPre = new Array<Content>();
    const newContentPost = new Array<Content>();
    const unordered = new Array<string>();
    const defs = new Array<Definition>(...this.component.definitions());
    const defNames = defs.map((d: Definition) => {
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
          if (defAtIdx) {
            newContentPost.push(defAtIdx.removeAlias());
          }

          // remove all other definitions by the current name from the original content
          let idxContent = 0;
          const nextIndex = () => {
            defNames[idx] = "";
            idx = defNames.indexOf(o);
            const currentDef = defs[idx];
            if (currentDef) {
              idxContent = this.component.content.indexOf(currentDef);
            }
            return idxContent != -1 && idx != -1;
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