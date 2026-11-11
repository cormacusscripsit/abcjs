describe("A percussion staff takes no key", function () {
	// A clef=perc staff was given no key of its own, and the flattener keeps one set of key accidentals for the
	// whole tune, so a drum voice sounded with the key the voice before it ended in, or the header's when the drum
	// voice came first (and the staff's own key when a %%MIDI program had been seen). Now a drum is the note
	// written, with the accidentals written in its bar and nothing else: header, staff and inline keys all ignored.
	// Every other voice plays as before.
	//
	// Each case gives the pitches of every track, in order.

	var drums = "V:D clef=perc\n%%MIDI channel 10\n";
	var cases = [
		{
			name: "after a melody that ends in another key than the header's",
			abc: "X:1\nL:1/4\nK:Ab\nV:M\nA B c [K:G] F|\n" + drums + "F, F, C F,|\n",
			// before: 54 54 60 54, the melody's last key
			tracks: ["68 70 72 66", "53 53 60 53"]
		},
		{
			name: "after a melody that ends in a flat key",
			abc: "X:1\nL:1/4\nK:G\nV:M\nA B c [K:Ab] F|\n" + drums + "F, F, C F,|\n",
			tracks: ["69 71 72 65", "53 53 60 53"]
		},
		{
			name: "after a melody in the header's key",
			abc: "X:1\nL:1/4\nK:A\nV:M\nA B c F|\n" + drums + "F, F, C F,|\n",
			// before: 54 54 61 54, the header's A major through the melody
			tracks: ["69 71 73 66", "53 53 60 53"]
		},
		{
			name: "first, under a header key",
			abc: "X:1\nL:1/4\nK:G\n" + drums + "F, F, C F,|\nV:M\nA B c F|\n",
			tracks: ["53 53 60 53", "69 71 72 66"]
		},
		{
			name: "with a key line of its own",
			abc: "X:1\nL:1/4\nK:C\nV:M\nA B c F|\nV:D clef=perc\nK:D\n%%MIDI channel 10\nF, F, C F,|\n",
			tracks: ["69 71 72 65", "53 53 60 53"]
		},
		{
			name: "with an inline key",
			abc: "X:1\nL:1/4\nK:C\n" + drums + "F, [K:D] F, C F,|\n",
			// before: 53 54 61 54
			tracks: ["53 53 60 53"]
		},
		{
			name: "with a %%MIDI program seen before it",
			abc: "X:1\nL:1/4\nK:D\nV:M\n%%MIDI program 40\nA B c F|\nV:D clef=perc\nF, F, C F,|\n",
			tracks: ["69 71 73 66", "53 53 60 53"]
		},
		{
			name: "its own accidentals hold to the bar line",
			abc: "X:1\nL:1/4\nK:Ab\nV:M\nA B c F|\n" + drums + "^F, F, _B, F,|F, B, =B, B,|\n",
			tracks: ["68 70 72 65", "54 54 58 54 53 59 59 59"]
		},
		{
			name: "on a later line, after the melody changes key",
			abc: "X:1\nL:1/4\nK:C\nV:M\nA B c F|\n" + drums + "F, F, C F,|\n[V:M] [K:E] A B c F|\n[V:D] F, F, C F,|\n",
			tracks: ["69 71 72 65 69 71 73 66", "53 53 60 53 53 53 60 53"]
		}
	];

	function pitches(abc) {
		var visualObj = abcjs.renderAbc("paper", abc, {})[0];
		return visualObj.setUpAudio({ chordsOff: true }).tracks.map(function (track) {
			return track.filter(function (ev) { return ev.cmd === "note"; }).map(function (ev) { return ev.pitch; }).join(" ");
		});
	}

	cases.forEach(function (c) {
		it(c.name, function () {
			chai.assert.deepEqual(pitches(c.abc), c.tracks);
		});
	});

	it("a melody voice still takes its key", function () {
		var abc = "X:1\nL:1/4\nK:D\nV:M\nF C [K:Bb] B E|\n" + drums + "F, C|\n";
		chai.assert.deepEqual(pitches(abc), ["66 61 70 63", "53 60"]);
	});
});
