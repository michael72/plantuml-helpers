import * as assert from 'assert';
import * as ext from '../../extension';

suite('Extension Test Suite', () => {

	test('rotate test', () => {
		assert.equal(ext.rotate("", ext.Direction.Right), "");
		assert.equal(ext.rotate("A --> B : hello", ext.Direction.Swap), "B <-- A : hello");
		assert.equal(ext.rotate("  A --> B : hello", ext.Direction.Right), "  B <- A : hello");
		assert.equal(ext.rotate("\tA -> B", ext.Direction.Left), "\tB <-- A");
		assert.equal(ext.rotate("A->B", ext.Direction.Swap), "B<-A");	  
		assert.equal(ext.rotate("[Main] ..> App : use", ext.Direction.Swap), "App <.. [Main] : use"); 
		assert.equal(ext.rotate("    Main <.  [App]   : register", ext.Direction.Swap), "    [App] .>  Main   : register"); 
	});

	test('rotate an asymetrical arrow', () => {
		assert.equal(ext.rotate('   B <|-- A', ext.Direction.Swap), '   A --|> B');
	});

	test('rotate with multiplicities', () => {
		assert.equal(ext.rotate('   B "1-2" <- "0:*" D : chk', ext.Direction.Left), '   D "0:*" --> "1-2" B : chk');
		// o-|> isn't a real arrow, but just for testing...
		assert.equal(ext.rotate('A "0" o-|> "1-2" B', ext.Direction.Swap), 'B "1-2" <|-o "0" A');
		assert.equal(ext.rotate('(IBar) "*" <-o "1" [Foo]', ext.Direction.Right), '(IBar) "*" <--o "1" [Foo]'); 
	});
});
