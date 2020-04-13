// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as rotate from './rotate';
import * as reformat from './reformat';

function autoFormatContent(textEditor: vscode.TextEditor) {
	if (textEditor) {
		const document = textEditor.document;
		textEditor.edit(editBuilder => {
			textEditor.selections.forEach(sel => {
				var range = sel;
				if (sel.isEmpty || sel.isSingleLine) {
					var line = sel.active.line;
					var last = line;
					while (line > 0) {
						let text = document.lineAt(line).text.trim();
						if (text === "@startuml" || text === "```plantuml" || text.indexOf("{") !== -1) {
							line += 1;
							break;
						}
						line -= 1;
					}
					while (last < document.lineCount) {
						let text = document.lineAt(last).text.trim();
						if (text === "@enduml" || text === "```" || text.indexOf("}") !== -1) {
							last -= 1;
							break;
						}
						last += 1;
					}
					
					range = new vscode.Selection(line, 0, last, document.lineAt(last).range.end.character);
				}
				// TODO select whole block
				let txt = reformat.autoFormatTxt(document.getText(range));
				editBuilder.replace(range, txt);
			});
		}); // apply the (accumulated) replacement(s) (if multiple cursors/selections)
	}
}

function rotateSelected(textEditor: vscode.TextEditor, dir: rotate.RotateDirection) {
	if (textEditor) {
		const document = textEditor.document;
		textEditor.edit(editBuilder => {
			textEditor.selections.forEach(sel => {
				const range = sel.isEmpty || sel.isSingleLine ? document.lineAt(sel.active.line).range || sel : sel;
				let lines = document.getText(range);
				let rotated = lines.split("\n").map(line => {
					return rotate.rotateLine(line, dir);
				});
				editBuilder.replace(range, rotated.join("\n"));
			});
		}); // apply the (accumulated) replacement(s) (if multiple cursors/selections)
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let swapLine = vscode.commands.registerTextEditorCommand('pumlhelper.swapLine', (textEditor: vscode.TextEditor, _: vscode.TextEditorEdit) => {
		rotateSelected(textEditor, rotate.RotateDirection.Swap);
	});
	let rotateLeft = vscode.commands.registerTextEditorCommand('pumlhelper.rotateLineLeft', (textEditor: vscode.TextEditor, _: vscode.TextEditorEdit) => {
		rotateSelected(textEditor, rotate.RotateDirection.Left);
	});
	let rotateRight = vscode.commands.registerTextEditorCommand('pumlhelper.rotateLineRight', (textEditor: vscode.TextEditor, _: vscode.TextEditorEdit) => {
		rotateSelected(textEditor, rotate.RotateDirection.Right);
	});
	let autoFormat = vscode.commands.registerTextEditorCommand('pumlhelper.autoFormat', (textEditor: vscode.TextEditor, _: vscode.TextEditorEdit) => {
		autoFormatContent(textEditor);
	});
	[swapLine, rotateLeft, rotateRight, autoFormat].forEach(s => {
		context.subscriptions.push(s);
	});
}

export function deactivate() { }
