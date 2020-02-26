import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as ext from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	//function rotate(line: string, dir: Direction) : string {
	test('rotate test', () => {
		assert.equal(ext.rotate("", ext.Direction.Right), "");
		assert.equal(ext.rotate("  A --> B : hello", ext.Direction.Swap), "  B <-- A : hello");
		assert.equal(ext.rotate("  A --> B : hello", ext.Direction.Swap), "  B <-- A : hello");
		assert.equal(ext.rotate("\tA -> B", ext.Direction.Left), "\tB <-- A");
		assert.equal(ext.rotate("A->B", ext.Direction.Swap), "B<-A");
	});
	test('rotate with multiplicities', () => {
		assert.equal(ext.rotate('   B "1-2" <- "0:*" D : chk', ext.Direction.Left), '   "0:*" D --> B "1-2" : chk');
	});
});
