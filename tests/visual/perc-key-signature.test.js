describe("A percussion staff draws no key signature", function () {
	// A drum staff takes no key in the sound (tests/synth/perc-key.test.js), so a key signature drawn on it says
	// something the sound does not: three sharps before a drum part written C and F that plays C and F. Neither the
	// key at the start of each line nor an inline [K:] in the drum voice is drawn. Other staves draw theirs.

	function keySignatures(abc) {
		abcjs.renderAbc("paper", abc, { add_classes: true });
		return Array.prototype.map.call(document.querySelectorAll("#paper .abcjs-key-signature"), function (el) {
			var cls = el.getAttribute("class");
			return cls.match(/abcjs-l\d+/)[0] + " " + cls.match(/abcjs-v\d+/)[0];
		});
	}

	it("draws none at the start of a drum staff's lines, nor for its inline key", function () {
		var abc = "X:1\nL:1/4\nK:A\nV:M\nA B c F|\nV:D clef=perc\n%%MIDI channel 10\nC F [K:D] C F|\n" +
			"[V:M] A B c F|\n[V:D] C F C F|\n";
		// before: also "abcjs-l0 abcjs-v1" twice and "abcjs-l1 abcjs-v1"
		chai.assert.deepEqual(keySignatures(abc), ["abcjs-l0 abcjs-v0", "abcjs-l1 abcjs-v0"]);
	});

	it("draws the melody's inline key change as before", function () {
		var abc = "X:1\nL:1/4\nK:C\nV:M\nA B [K:Eb] c F|\nV:D clef=perc\nC F C F|\n";
		chai.assert.deepEqual(keySignatures(abc), ["abcjs-l0 abcjs-v0"]);
	});
});
