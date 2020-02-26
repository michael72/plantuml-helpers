// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

export enum Direction {
	Left,
	Right,
	Swap
}

function rotateArrow(arrow: string, isVert: boolean) : string {
	// - <=> --
	if (isVert) {
		return arrow.replace("--", "-");
	} else {
		return arrow.replace("-", "--");
	}	
}

function reverseChar(arrow: string, left: string, right: string) : string {
	return (arrow.indexOf(left) !== -1) ? arrow.replace(left, right) : arrow.replace(right, left);
}

function reverseArrow(arrow: string, dash: number, isVert: boolean) : string {
	arrow = reverseChar(arrow, ">", "<");
	arrow = reverseChar(arrow, "/", "\\");
	let arrowLeft = arrow.substring(0, dash);
	let arrowRight = arrow.substring(dash + (isVert ? 2 : 1));
	return arrowRight + (isVert ? "--" : "-") + arrowLeft; 
}

const regex : RegExp = /(\s*)(\S+(?:\s+".*")?)(\s*)(\S*-\S*)(\s*)((?:".*"\s+)?\S+)(.*)/;
// example:                    A "1"                  ->          "2"          B  : foo
// rotate:
/* @startuml directions
[B] --> [A] : up
A -> [C] : right
C --> [D] : down
B <- D : left
@enduml */
export function rotate(line: string, dir: Direction) : string {
	let m = line.match(regex);
	if (!m) {
		return line;
	}
	let a = 4; // arrow-index
	var arrow = m[a];
	let dash = arrow.indexOf("-");
	if (dash === -1) {
		return line;
	} 
	var left = m[a - 2];
	var right = m[a + 2];
	let isVert = arrow.indexOf("--", dash) !== -1;
	if ((isVert === (dir === Direction.Right)) || dir === Direction.Swap) {
		// reverse arrow
		arrow = reverseArrow(arrow, dash, isVert);
		// also reverse content
		let copy = left;
		left = right;
		right = copy;
	}
	if (dir !== Direction.Swap) {
		arrow = rotateArrow(arrow, isVert);
	}
	return m[a-3] + left + m[a-1] + arrow + m[a+1] + right + m[a+3]; 
}

function rotateSelected(textEditor: vscode.TextEditor, dir: Direction) {
	if (textEditor) {
		const document = textEditor.document;
		textEditor.edit(editBuilder => {
			textEditor.selections.forEach(sel => {
				const range = sel.isEmpty || sel.isSingleLine ? document.lineAt(sel.active.line).range || sel : sel;
				let lines = document.getText(range);
				let rotated = lines.split("\n").map(line => {
					return rotate(line, dir);
				});
				editBuilder.replace(range, rotated.join("\n"));
			});
		}); // apply the (accumulated) replacement(s) (if multiple cursors/selections)
	}		
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let swapLine = vscode.commands.registerTextEditorCommand('pumlhelper.swapLine', (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) => {
		rotateSelected(textEditor, Direction.Swap);
	});
	let rotateLeft = vscode.commands.registerTextEditorCommand('pumlhelper.rotateLineLeft', (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) => {
		rotateSelected(textEditor, Direction.Left);
	});
	let rotateRight = vscode.commands.registerTextEditorCommand('pumlhelper.rotateLineRight', (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) => {
		rotateSelected(textEditor, Direction.Right);
	});
	[swapLine, rotateLeft, rotateRight].forEach (s => {
		context.subscriptions.push(s);	
	});
}

export function deactivate() {}
