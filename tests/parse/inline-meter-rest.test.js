describe("Whole-bar rest after an inline meter change", function () {
	// A rest written as a whole note fills the bar it is in. Its length must
	// come from the meter in force there, which an inline [M:] can change.
	function rests(abc) {
		var tune = abcjs.parseOnly(abc)[0];
		var out = [];
		tune.lines.forEach(function (line) {
			if (!line.staff) return;
			line.staff.forEach(function (staff, s) {
				staff.voices.forEach(function (voice, v) {
					voice.forEach(function (el) {
						if (el.el_type === "note" && el.rest && el.rest.type !== "spacer")
							out.push({ staff: s, voice: v, duration: el.duration });
					});
				});
			});
		});
		return { warnings: tune.warnings, rests: out };
	}

	it("z8 after [M:4/4] in a 5/8 tune fills a 4/4 bar", function () {
		var r = rests("X:1\nM:5/8\nL:1/8\nK:F\nc2 c3 | [M:4/4] c8 | z8 |\n");
		chai.assert.isUndefined(r.warnings, "warnings");
		chai.assert.deepEqual(r.rests.map(function (x) { return x.duration; }), [1]);
	});

	it("z8 after [M:3/4] in a 4/4 tune fills a 3/4 bar", function () {
		var r = rests("X:1\nM:4/4\nL:1/8\nK:C\nc8 | [M:3/4] c6 | z8 |\n");
		chai.assert.isUndefined(r.warnings, "warnings");
		chai.assert.deepEqual(r.rests.map(function (x) { return x.duration; }), [0.75]);
	});

	it("each voice keeps its own meter: the lower voice's first rest is in the old one", function () {
		var r = rests("X:1\nM:2/4\nL:1/8\nK:C\n%%score (1) (2)\n" +
			"[V:1] z8 | [M:4/4] c8 | z8 |\n" +
			"[V:2] z8 | [M:4/4] c8 | z8 |\n");
		chai.assert.isUndefined(r.warnings, "warnings");
		chai.assert.deepEqual(r.rests.map(function (x) { return x.duration; }), [0.5, 1, 0.5, 1]);
	});

	it("an M: line between systems replaces an earlier inline meter", function () {
		var r = rests("X:1\nM:5/8\nL:1/8\nK:F\nc2 c3 | [M:4/4] c8 |\nM:3/4\nz8 |\n");
		chai.assert.isUndefined(r.warnings, "warnings");
		chai.assert.deepEqual(r.rests.map(function (x) { return x.duration; }), [0.75]);
	});

	it("an M: line replaces every voice's inline meter", function () {
		var r = rests("X:1\nM:5/8\nL:1/8\nK:F\n%%score (1) (2)\n" +
			"[V:1] c2 c3 | [M:4/4] c8 |\n" +
			"[V:2] c2 c3 | [M:4/4] c8 |\n" +
			"M:3/4\n" +
			"[V:1] z8 |\n" +
			"[V:2] z8 |\n");
		chai.assert.isUndefined(r.warnings, "warnings");
		chai.assert.deepEqual(r.rests.map(function (x) { return x.duration; }), [0.75, 0.75]);
	});

	// Z is a bar rest: Z is one bar, Z2 two. Its length is the bar in force where it is written.
	it("Z after [M:4/4] in a 5/8 tune is a 4/4 bar, and Z2 two of them", function () {
		var r = rests("X:1\nM:5/8\nL:1/8\nK:F\nc2 c3 | [M:4/4] c8 | Z | Z2 |\n");
		chai.assert.isUndefined(r.warnings, "warnings");
		chai.assert.deepEqual(r.rests.map(function (x) { return x.duration; }), [1, 2]);
	});

	it("Z after an M: line is a bar of the new meter", function () {
		var r = rests("X:1\nM:4/4\nL:1/8\nK:C\nc8 |\nM:3/4\nZ |\n");
		chai.assert.isUndefined(r.warnings, "warnings");
		chai.assert.deepEqual(r.rests.map(function (x) { return x.duration; }), [0.75]);
	});

	it("Z keeps each voice's own meter", function () {
		var r = rests("X:1\nM:2/4\nL:1/8\nK:C\n%%score (1) (2)\n" +
			"[V:1] Z | [M:4/4] c8 | Z |\n" +
			"[V:2] Z | [M:4/4] c8 | Z |\n");
		chai.assert.isUndefined(r.warnings, "warnings");
		chai.assert.deepEqual(r.rests.map(function (x) { return x.duration; }), [0.5, 1, 0.5, 1]);
	});

	it("Z in a tune that never changes meter is unchanged, additive and cut time too", function () {
		[["M:6/8", 0.75], ["M:2+3/8", 0.625], ["M:C|", 1], ["M:C", 1]].forEach(function (c) {
			var r = rests("X:1\n" + c[0] + "\nL:1/8\nK:C\nZ |\n");
			chai.assert.deepEqual(r.rests.map(function (x) { return x.duration; }), [c[1]], c[0]);
		});
	});

	it("Z in a bar of five eighths is not warned: a bar rest is one sign whatever its length", function () {
		var r = rests("X:1\nM:5/8\nL:1/8\nK:C\nZ | [M:7/8] c7 | Z |\n");
		chai.assert.isUndefined(r.warnings, "warnings");
		chai.assert.deepEqual(r.rests.map(function (x) { return x.duration; }), [0.625, 0.875]);
	});

	it("a plain rest of five eighths is still warned", function () {
		var r = rests("X:1\nM:5/8\nL:1/8\nK:C\nz5 |\n");
		chai.assert.lengthOf(r.warnings, 1);
	});
});
