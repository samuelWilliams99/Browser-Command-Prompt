define(["program"], function(p) {
	class TestProgram extends p.Program {
		static Name = "test"
		constructor(id) {
			super(id, TestProgram.Name);
		}

		start(...args) {
			this.timer.create("timer", 1, 3, function(i) {
				console.log(i);
			})
		}
	}

	return TestProgram;
});
