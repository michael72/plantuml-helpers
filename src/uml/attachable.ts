export class Attachable {
  private attached?: Array<string>;

  attach(line: string): void {
    this.attached ??= new Array<string>();
    this.attached.push(line);
  }

  isNoteAttached(): boolean {
    return (
      this.attached != undefined &&
      this.attached.length > 0 &&
      this.attached[this.attached.length - 1]?.startsWith("note ") === true
    );
  }

  moveAttached(): Array<string> {
    let result = new Array<string>();
    // move attached only if not a note (notes belong to the preceeding line)
    while (
      this.attached &&
      this.attached.length > 0 &&
      !this.isNoteAttached()
    ) {
      const last = this.attached.pop();
      if (last !== undefined) {
        result = [last, ...result];
      }
    }
    return result;
  }

  attachedToString(): string {
    return this.attached ? "\n" + this.attached.join("\n") : "";
  }
}
