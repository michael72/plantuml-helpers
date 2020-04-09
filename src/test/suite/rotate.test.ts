import * as assert from 'assert';
import * as ext from '../../extension';
import * as r from '../../rotate';

suite('Extension Test Suite', () => {

	test('rotate test', () => {
		assert.equal(r.rotate("", ext.Direction.Right), "");
		assert.equal(r.rotate("A --> B : hello", ext.Direction.Swap), "B <-- A : hello");
		assert.equal(r.rotate("  A --> B : hello", ext.Direction.Right), "  B <- A : hello");
		assert.equal(r.rotate("\tA -> B", ext.Direction.Left), "\tB <-- A");
		assert.equal(r.rotate("A->B", ext.Direction.Swap), "B<-A");	  
		assert.equal(r.rotate("[Main] ..> App : use", ext.Direction.Swap), "App <.. [Main] : use"); 
		assert.equal(r.rotate("    Main <.  [App]   : register", ext.Direction.Swap), "    [App] .>  Main   : register"); 
	});

	test('rotate an asymetrical arrow', () => {
		assert.equal(r.rotate('   B <|-- A', ext.Direction.Swap), '   A --|> B');
	});

	test('rotate with multiplicities', () => {
		assert.equal(r.rotate('   B "1-2" <- "0:*" D : chk', ext.Direction.Left), '   D "0:*" --> "1-2" B : chk');
		// o-|> isn't a real arrow, but just for testing...
		assert.equal(r.rotate('A "0" o-|> "1-2" B', ext.Direction.Swap), 'B "1-2" <|-o "0" A');
		assert.equal(r.rotate('(IBar) "*" <-o "1" [Foo]', ext.Direction.Right), '(IBar) "*" <--o "1" [Foo]'); 
	});
});
