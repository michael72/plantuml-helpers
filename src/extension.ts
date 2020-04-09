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
				// TODO select whole block
				const range = sel.isEmpty || sel.isSingleLine ? document.lineAt(sel.active.line).range || sel : sel;
				let txt = reformat.autoFormatTxt(document.getText(range));
				editBuilder.replace(range, txt);
			});
		}); // apply the (accumulated) replacement(s) (if multiple cursors/selections)
	}		
}

function rotateSelected(textEditor: vscode.TextEditor, dir: rotate.Direction) {
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
	let swapLine = vscode.commands.registerTextEditorCommand('pumlhelper.swapLine', (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) => {
		rotateSelected(textEditor, rotate.Direction.Swap);
	});
	let rotateLeft = vscode.commands.registerTextEditorCommand('pumlhelper.rotateLineLeft', (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) => {
		rotateSelected(textEditor, rotate.Direction.Left);
	});
	let rotateRight = vscode.commands.registerTextEditorCommand('pumlhelper.rotateLineRight', (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) => {
		rotateSelected(textEditor, rotate.Direction.Right);
	});
	let autoFormat = vscode.commands.registerTextEditorCommand('pumlhelper.autoFormat', (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) => {
		autoFormatContent(textEditor);
	});
	[swapLine, rotateLeft, rotateRight, autoFormat].forEach (s => {
		context.subscriptions.push(s);	
	});
}

export function deactivate() {}
