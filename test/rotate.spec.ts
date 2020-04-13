import { equal } from "assert";
import { should } from 'chai';
import * as r from "../src/rotate";

should();

describe('Rotate', () => {

	it('should rotate arrows', () => {
		equal(r.rotateLine("", r.RotateDirection.Right), "");
		equal(r.rotateLine("A --> B : hello", r.RotateDirection.Swap), "B <-- A : hello");
		equal(r.rotateLine("  A --> B : hello", r.RotateDirection.Right), "  B <- A : hello");
		equal(r.rotateLine("\tA -> B", r.RotateDirection.Left), "\tB <-- A");
		equal(r.rotateLine("[Main] ..> App : use", r.RotateDirection.Swap), "App <.. [Main] : use"); 
		equal(r.rotateLine("    Main <.  [App]   : register", r.RotateDirection.Swap), "    [App] .> Main   : register"); 
	});

	it ('will format to only 1 space in the arrow', () => {
		// spaces are added automatically 
		equal(r.rotateLine("A->B", r.RotateDirection.Swap), "B <- A");	  
		// spaces may also be removed
		equal(r.rotateLine("A ..  B", r.RotateDirection.Right), "B . A");	  
	});

	it('should rotate an asymetrical arrow', () => {
		equal(r.rotateLine('   B <|-- A', r.RotateDirection.Swap), '   A --|> B');
	});

	it('should rotate arrows with multiplicities', () => {
		equal(r.rotateLine('   B "1-2" <- "0:*" D : chk', r.RotateDirection.Left), '   D "0:*" --> "1-2" B : chk');
		// o-|> isn't a real arrow, but just for testing...
		equal(r.rotateLine('A "0" o-|> "1-2" B', r.RotateDirection.Swap), 'B "1-2" <|-o "0" A');
		equal(r.rotateLine('(IBar) "*" <-o "1" [Foo]', r.RotateDirection.Right), '(IBar) "*" <--o "1" [Foo]'); 
	});

	it ('should keep arrow direction in labels', () => {
		r.rotateLine('Car *- Wheel : have 4 >', r.RotateDirection.Swap).should.equal('Wheel -* Car : have 4 <');
	});
});
