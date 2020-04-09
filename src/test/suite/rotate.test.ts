import * as assert from 'assert';
import * as r from '../../rotate';

suite('Rotate Test Suite', () => {

	test('rotate test', () => {
		assert.equal(r.rotateLine("", r.Direction.Right), "");
		assert.equal(r.rotateLine("A --> B : hello", r.Direction.Swap), "B <-- A : hello");
		assert.equal(r.rotateLine("  A --> B : hello", r.Direction.Right), "  B <- A : hello");
		assert.equal(r.rotateLine("\tA -> B", r.Direction.Left), "\tB <-- A");
		assert.equal(r.rotateLine("A->B", r.Direction.Swap), "B<-A");	  
		assert.equal(r.rotateLine("[Main] ..> App : use", r.Direction.Swap), "App <.. [Main] : use"); 
		assert.equal(r.rotateLine("    Main <.  [App]   : register", r.Direction.Swap), "    [App] .>  Main   : register"); 
	});

	test('rotate an asymetrical arrow', () => {
		assert.equal(r.rotateLine('   B <|-- A', r.Direction.Swap), '   A --|> B');
	});

	test('rotate with multiplicities', () => {
		assert.equal(r.rotateLine('   B "1-2" <- "0:*" D : chk', r.Direction.Left), '   D "0:*" --> "1-2" B : chk');
		// o-|> isn't a real arrow, but just for testing...
		assert.equal(r.rotateLine('A "0" o-|> "1-2" B', r.Direction.Swap), 'B "1-2" <|-o "0" A');
		assert.equal(r.rotateLine('(IBar) "*" <-o "1" [Foo]', r.Direction.Right), '(IBar) "*" <--o "1" [Foo]'); 
	});
});
