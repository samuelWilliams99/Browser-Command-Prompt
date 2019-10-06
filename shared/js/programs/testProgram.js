define(["program"], function(p) {
	class TestProgram extends p.Program {
		static Name = "test"
		constructor(id) {
			super(TestProgram.Name);
		}

		start(...args) {
			
		}
	}

	return TestProgram;
});
