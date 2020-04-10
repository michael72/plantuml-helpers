import { equal } from "assert";
import * as r from "../src/rotate";

describe('Rotate', () => {

	it('should rotate arrows', () => {
		equal(r.rotateLine("", r.Direction.Right), "");
		equal(r.rotateLine("A --> B : hello", r.Direction.Swap), "B <-- A : hello");
		equal(r.rotateLine("  A --> B : hello", r.Direction.Right), "  B <- A : hello");
		equal(r.rotateLine("\tA -> B", r.Direction.Left), "\tB <-- A");
		equal(r.rotateLine("A->B", r.Direction.Swap), "B<-A");	  
		equal(r.rotateLine("[Main] ..> App : use", r.Direction.Swap), "App <.. [Main] : use"); 
		equal(r.rotateLine("    Main <.  [App]   : register", r.Direction.Swap), "    [App] .>  Main   : register"); 
	});

	it('should rotate an asymetrical arrow', () => {
		equal(r.rotateLine('   B <|-- A', r.Direction.Swap), '   A --|> B');
	});

	it('should rotate arrows with multiplicities', () => {
		equal(r.rotateLine('   B "1-2" <- "0:*" D : chk', r.Direction.Left), '   D "0:*" --> "1-2" B : chk');
		// o-|> isn't a real arrow, but just for testing...
		equal(r.rotateLine('A "0" o-|> "1-2" B', r.Direction.Swap), 'B "1-2" <|-o "0" A');
		equal(r.rotateLine('(IBar) "*" <-o "1" [Foo]', r.Direction.Right), '(IBar) "*" <--o "1" [Foo]'); 
	});
});
