describe("D.S., D.C. and Fine: audio and timing", function () {
	// !D.S.! goes back to !segno!, !D.C.! to the start, and either stops at the end of the bar that carries the
	// first !fine! after that point (or plays to the end). The jump is taken at the end of the bar carrying the
	// D.S. or D.C. A mark written in one voice applies to all of them. On the way back, repeats are not taken and
	// only the last ending of a set is played.
	//
	// Each case states the notes each track plays, in order, as pitches, and the cursor's events (milliseconds at a
	// quarter note a second), so a failure says what came out.

	var head = 'X:1\nM:4/4\nL:1/4\nK:C\n';
	var C = "60 62 64 65", G = "67 69 71 72", c = "72 71 69 67", F = "65 64 62 60";
	function ms(from, count) {
		var out = [];
		for (var i = 0; i < count; i++) out.push((from + i) * 1000);
		return out.join(" ");
	}

	var cases = [
		{
			name: "D.C. al Fine",
			abc: head + 'CDEF | !fine!GABc || cBAG | !D.C.!FEDC |]\n',
			tracks: [[C, G, c, F, C, G].join(" ")],
			events: ms(0, 24)
		},
		{
			name: "D.S. al Fine, the segno at the start of a bar",
			abc: head + 'CDEF | !segno!GABc | !fine!cBAG || FEDC | !D.S.!CDEF |]\n',
			tracks: [[C, G, c, F, C, G, c].join(" ")],
			events: ms(0, 28)
		},
		{
			name: "D.S. with the segno in the middle of a bar, and no Fine: to the end",
			abc: head + 'CD!segno!EF | GABc | !D.S.!cBAG |]\n',
			tracks: [[C, G, c, "64 65", G, c].join(" ")],
			events: ms(0, 22)
		},
		{
			name: "the alfine forms",
			abc: head + 'CDEF | !fine!GABc || cBAG | !D.C.alfine!FEDC |]\n',
			tracks: [[C, G, c, F, C, G].join(" ")],
			events: ms(0, 24)
		},
		{
			name: "a Fine before the segno is not reached on the way back",
			// The Coventry Carol's shape: refrain to Fine, the verse from the segno, D.S. to the verse again.
			abc: head + 'CDEF | !fine!GABc || !segno!cBAG | !D.S.!FEDC |]\n',
			tracks: [[C, G, c, F, c, F].join(" ")],
			events: ms(0, 24)
		},
		{
			name: "the marks in one voice take every voice back",
			// In the second voice, so finding them in the first voice only would not do.
			abc: head + 'V:1\nV:2 clef=bass\n[V:1] CDEF | GABc || cBAG | FEDC |]\n[V:2] C,4 | !fine!G,4 || C,4 | !D.C.!G,4 |]\n',
			tracks: [[C, G, c, F, C, G].join(" "), "48 55 48 55 48 55"],
			events: ms(0, 24)
		},
		{
			name: "music after the D.S. bar is played only on the way back",
			abc: head + 'CDEF | !segno!GABc | !D.S.!cBAG | FEDC |]\n',
			tracks: [[C, G, c, G, c, F].join(" ")],
			events: ms(0, 24)
		},
		{
			name: "the key in force at the segno, not at the D.S.",
			abc: head + 'CDEF | [K:G] !segno!GABF | [K:C] cBAG | !D.S.!FEDC |]\n',
			tracks: [[C, "67 69 71 66", c, F, "67 69 71 66", c, F].join(" ")],
			events: ms(0, 28)
		},
		{
			name: "on the way back, repeats are not taken and only the last ending is played",
			abc: head + '|: CDEF |1 GABc :|2 cBAG || !D.C.!FEDC |]\n',
			tracks: [[C, G, C, c, F, C, c, F].join(" ")],
			events: ms(0, 32)
		},
		{
			name: "a D.S. with no segno is played as written",
			abc: head + 'CDEF | !D.S.!GABc |]\n',
			tracks: [[C, G].join(" ")],
			events: ms(0, 8)
		},
		{
			name: "al coda is not handled: played as written",
			abc: head + 'CDEF | !segno!GABc | !D.S.alcoda!cBAG |]\n',
			tracks: [[C, G, c].join(" ")],
			events: ms(0, 12)
		},
		{
			name: "a Fine with no D.S. or D.C. is played as written",
			abc: head + 'CDEF | !fine!GABc |]\n',
			tracks: [[C, G].join(" ")],
			events: ms(0, 8)
		}
	];

	function render(abc) {
		return abcjs.renderAbc("paper", abc, { add_classes: true })[0];
	}

	function tracks(visualObj) {
		return visualObj.setUpAudio().tracks.map(function (track) {
			return track.filter(function (ev) { return ev.cmd === "note"; });
		});
	}

	function events(visualObj) {
		return visualObj.setTiming(60, 0).filter(function (ev) { return ev.type === "event"; }).map(function (ev) {
			return ev.milliseconds;
		}).join(" ");
	}

	cases.forEach(function (c) {
		describe(c.name, function () {
			it("plays the notes in order, back to back", function () {
				var got = tracks(render(c.abc));
				chai.assert.deepEqual(got.map(function (track) {
					return track.map(function (ev) { return ev.pitch; }).join(" ");
				}), c.tracks);
				got.forEach(function (track) {
					for (var i = 1; i < track.length; i++)
						chai.assert.isAtLeast(track[i].start, track[i - 1].start, "the notes go forward in time: note " + i);
				});
				var ends = got.map(function (track) {
					var last = track[track.length - 1];
					return last.start + last.duration;
				});
				for (var t = 1; t < ends.length; t++)
					chai.assert.closeTo(ends[t], ends[0], 0.0001, "every voice ends together");
			});

			it("moves the cursor to the same notes, at the same times", function () {
				chai.assert.equal(events(render(c.abc)), c.events);
			});
		});
	});

	it("the cursor goes back to the segno's line", function () {
		var visualObj = render(head + 'CDEF | !segno!GABc | !fine!cBAG |\nFEDC | !D.S.!CDEF |]\n');
		var lines = visualObj.setTiming(60, 0).filter(function (ev) { return ev.type === "event"; }).map(function (ev) {
			return ev.line;
		});
		chai.assert.equal(lines.join(""), "0000" + "0000" + "0000" + "1111" + "1111" + "0000" + "0000");
	});

	it("unchanged without the marks", function () {
		var visualObj = render(head + '|: CDEF |1 GABc :|2 cBAG |]\n');
		chai.assert.deepEqual(tracks(visualObj).map(function (track) {
			return track.map(function (ev) { return ev.pitch; }).join(" ");
		}), [[C, G, C, c].join(" ")]);
		chai.assert.equal(events(visualObj), ms(0, 16));
	});
});
