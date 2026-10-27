describe("Parts: the play order in the header, in audio and timing", function () {
	// A P: field in the header is the order the parts are played in; P: in the body (or [P:x]) marks where each one
	// starts. Each part is played with its own repeats. A part marked in one voice applies to all of them. Music
	// before the first part is played once, first. An order that cannot be read, or that names a part the body never
	// starts, is not played: the tune plays as written, and nothing is said. A part's name is one capital letter; a
	// body P: with other text is a label, and its music belongs to the part before it.
	//
	// Each case states the notes each track plays, in order, as pitches, and the cursor's events (milliseconds at a
	// quarter note a second), so a failure says what came out.

	var head = 'X:1\nM:4/4\nL:1/4\n';
	var C = "60 62 64 65", G = "67 69 71 72";
	var lowC = "48 50 52 53", lowG = "55 57 59 60";
	function ms(from, count) {
		var out = [];
		for (var i = 0; i < count; i++) out.push((from + i) * 1000);
		return out.join(" ");
	}

	var cases = [
		{
			name: "P:ABA, one voice",
			abc: head + 'P:ABA\nK:C\nP:A\nCDEF|\nP:B\nGABc|]\n',
			tracks: [[C, G, C].join(" ")],
			events: ms(0, 12)
		},
		{
			name: "P:(AB)3, a group with a count",
			abc: head + 'P:(AB)3\nK:C\nP:A\nCDEF|\nP:B\nGABc|]\n',
			tracks: [[C, G, C, G, C, G].join(" ")],
			events: ms(0, 24)
		},
		{
			name: "P:A2B2, and P:B before A",
			abc: head + 'P:BA2B\nK:C\nP:A\nCDEF|\nP:B\nGABc|]\n',
			tracks: [[G, C, C, G].join(" ")],
			events: ms(0, 16)
		},
		{
			name: "nested groups, dots and spaces",
			abc: head + 'P:(A(B)2).A\nK:C\nP:A\nCDEF|\nP:B\nGABc|]\n',
			tracks: [[C, G, G, C].join(" ")],
			events: ms(0, 16)
		},
		{
			name: "a body P: that is not a letter is a label: its music stays in the part before it",
			abc: head + 'P:BA\nK:C\nP:A\nCDEF|\nP: 2 = version in D\nGABc|\nP:B\ndefg|]\n',
			tracks: [["74 76 77 79", C, G].join(" ")],
			events: ms(0, 12)
		},
		{
			name: "an inline [P:...] that is not a letter is a label too",
			abc: head + 'P:BA\nK:C\n[P:A]CDEF|[P:Verse 2]GABc|[P:B]defg|]\n',
			tracks: [["74 76 77 79", C, G].join(" ")],
			events: ms(0, 12)
		},
		{
			name: "inline [P:B] in the middle of a line",
			abc: head + 'P:BA\nK:C\n[P:A]CDEF|[P:B]GABc|]\n',
			tracks: [[G, C].join(" ")],
			events: ms(0, 8)
		},
		{
			name: "P:A3 over the whole tune, ending on |]",
			abc: head + 'P:A3\nK:C\n[P:A]CDEF|GABc|]\n',
			tracks: [[C, G, C, G, C, G].join(" ")],
			events: ms(0, 24)
		},
		{
			name: "interleaved voices, the part marked above the first voice only",
			abc: head + 'P:ABA\nK:C\nV:1\nV:2 clef=bass\nP:A\n[V:1]CDEF|\n[V:2]C,D,E,F,|\nP:B\n[V:1]GABc|]\n[V:2]G,A,B,C|]\n',
			tracks: [[C, G, C].join(" "), [lowC, lowG, lowC].join(" ")],
			events: ms(0, 12)
		},
		{
			name: "interleaved voices, the part marked inline in the first voice only",
			abc: head + 'P:ABA\nK:C\nV:1\nV:2 clef=bass\n[V:1][P:A]CDEF|\n[V:2]C,D,E,F,|\n[V:1][P:B]GABc|]\n[V:2]G,A,B,C|]\n',
			tracks: [[C, G, C].join(" "), [lowC, lowG, lowC].join(" ")],
			events: ms(0, 12)
		},
		{
			name: "voices grouped, each voice marking its own parts",
			abc: head + 'P:ABA\nK:C\nV:1\nV:2 clef=bass\nV:1\nP:A\nCDEF|\nP:B\nGABc|]\nV:2\nP:A\nC,D,E,F,|\nP:B\nG,A,B,C|]\n',
			tracks: [[C, G, C].join(" "), [lowC, lowG, lowC].join(" ")],
			events: ms(0, 12)
		},
		{
			name: "voices grouped, only the first voice marking the parts",
			abc: head + 'P:BA\nK:C\nV:1\nV:2 clef=bass\nV:1\nP:A\nCDEF|\nP:B\nGABc|]\nV:2\nC,D,E,F,|G,A,B,C|]\n',
			tracks: [[G, C].join(" "), [lowG, lowC].join(" ")],
			events: ms(0, 8)
		},
		{
			name: "repeats inside a part are taken each time it is played",
			abc: head + 'P:ABA\nK:C\nP:A\n|:CDEF:|\nP:B\nGABc|]\n',
			tracks: [[C, C, G, C, C].join(" ")],
			events: ms(0, 20)
		},
		{
			name: "a :| with no |: repeats its own part, not the tune",
			abc: head + 'P:AB\nK:C\nP:A\nCDEF|\nP:B\nGABc:|]\n',
			tracks: [[C, G, G].join(" ")],
			events: ms(0, 12)
		},
		{
			name: "a part with first and second endings",
			abc: head + 'P:BA\nK:C\nP:A\nCDEF|\nP:B\n|:GABc|1cBAG:|2CDEF|]\n',
			tracks: [[G, "72 71 69 67", G, C, C].join(" ")],
			events: ms(0, 20)
		},
		{
			name: "the key in force where a part starts comes back with it",
			abc: head + 'P:ABA\nK:F\nP:A\nBBBB|\nP:B\nK:G\nFFFF|]\n',
			tracks: ["70 70 70 70 66 66 66 66 70 70 70 70"],
			events: ms(0, 12)
		},
		{
			name: "a part with no key of its own keeps the one in force where it is written",
			abc: head + 'P:AC\nK:F\nP:A\nBBBB|\nP:B\nK:G\nFFFF|\nP:C\nFFFF|]\n',
			tracks: ["70 70 70 70 66 66 66 66"],
			events: ms(0, 8)
		},
		{
			name: "the tempo in force where a part starts comes back with it",
			abc: head + 'P:ABA\nK:C\nP:A\nCDEF|\nP:B\n[Q:1/4=120]GABc|]\n',
			tracks: [[C, G, C].join(" ")],
			events: "0 1000 2000 3000 4000 4500 5000 5500 6000 7000 8000 9000"
		},
		{
			name: "music before the first part is played once, first",
			abc: head + 'P:AA\nK:C\nC|\nP:A\nDEFG|]\n',
			tracks: ["60 62 64 65 67 62 64 65 67"],
			events: ms(0, 9)
		},
		{
			name: "a D.S. is played as written when there is a play order",
			abc: head + 'P:AB\nK:C\nP:A\n!segno!CDEF|\nP:B\n!D.S.!GABc|]\n',
			tracks: [[C, G].join(" ")],
			events: ms(0, 8)
		},
		{
			name: "an order naming a part that is never started is played as written",
			abc: head + 'P:BAC\nK:C\nP:A\nCDEF|\nP:B\nGABc|]\n',
			tracks: [[C, G].join(" ")],
			events: ms(0, 8)
		},
		{
			name: "an order that cannot be read is played as written",
			abc: head + 'P:3A\nK:C\nP:A\nCDEF|\nP:B\nGABc|]\n',
			tracks: [[C, G].join(" ")],
			events: ms(0, 8)
		},
		{
			name: "parts with no order in the header are only labels",
			abc: head + 'K:C\nP:A\n|:CDEF:|\nP:B\nGABc|]\n',
			tracks: [[C, C, G].join(" ")],
			events: ms(0, 12)
		}
	];

	function render(abc, options) {
		return abcjs.renderAbc("paper", abc, Object.assign({ add_classes: true }, options || {}))[0];
	}

	function tracks(visualObj) {
		return visualObj.setUpAudio().tracks.map(function (track) {
			return track.filter(function (ev) { return ev.cmd === "note"; });
		});
	}

	function timing(visualObj) {
		return visualObj.setTiming(60, 0).filter(function (ev) { return ev.type === "event"; });
	}

	function events(visualObj) {
		return timing(visualObj).map(function (ev) { return ev.milliseconds; }).join(" ");
	}

	function pitches(visualObj) {
		return tracks(visualObj).map(function (track) {
			return track.map(function (ev) { return ev.pitch; }).join(" ");
		});
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
						chai.assert.closeTo(track[i].start, track[i - 1].start + track[i - 1].duration, 0.0001, "note " + i + " starts where the one before it ends");
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

			it("has the cursor on the notes the audio plays, in the order it plays them", function () {
				// By order rather than by time: the audio's times are at its own default tempo.
				var visualObj = render(c.abc);
				var events = timing(visualObj);
				tracks(visualObj).forEach(function (track, t) {
					var heard = track.map(function (note) { return note.startChar; });
					var seen = [];
					events.forEach(function (ev) {
						ev.startCharArray.forEach(function (startChar) {
							if (heard.indexOf(startChar) >= 0)
								seen.push(startChar);
						});
					});
					chai.assert.deepEqual(seen, heard, "track " + t);
				});
			});
		});
	});

	it("each pass of the cursor is over the same written notes, so their lyrics go with them", function () {
		var abc = head + 'P:A3\nK:C\nV:1\nV:2 clef=bass\n[V:1][P:A]CDEF|GABc|]\nw:one two three four five six sev-en\nw:eins zwei drei vier fünf sechs sie-ben\n[V:2]C,D,E,F,|G,A,B,C|]\n';
		var visualObj = render(abc);
		var starts = timing(visualObj).map(function (ev) { return ev.startCharArray.join(","); });
		chai.assert.lengthOf(starts, 24);
		chai.assert.deepEqual(starts.slice(8, 16), starts.slice(0, 8), "the second pass");
		chai.assert.deepEqual(starts.slice(16, 24), starts.slice(0, 8), "the third pass");
		var lyrics = visualObj.lines[0].staff[0].voices[0].filter(function (el) { return el.el_type === "note"; }).map(function (el) {
			return el.lyric.map(function (l) { return l.syllable; }).join("/");
		});
		chai.assert.deepEqual(lyrics, ["one/eins", "two/zwei", "three/drei", "four/vier", "five/fünf", "six/sechs", "sev/sie", "en/ben"]);
	});

	it("the cursor goes back to the line where the part starts", function () {
		var visualObj = render(head + 'P:ABA\nK:C\nP:A\nCDEF|\nP:B\nGABc|]\n');
		var lines = timing(visualObj).map(function (ev) { return ev.line; });
		chai.assert.equal(lines.join(""), "0000" + "1111" + "0000");
	});

	it("an order that is the written order sounds the same as no order", function () {
		var body = 'K:C\nP:A\nCDEF|\nP:B\n|:GABc:|\n';
		var written = render(head + body);
		var ordered = render(head + 'P:AB\n' + body);
		chai.assert.deepEqual(pitches(ordered), pitches(written));
		chai.assert.equal(events(ordered), events(written));
	});

	describe("warnings", function () {
		function warnings(abc) {
			return (abcjs.parseOnly(abc)[0].warnings || []).map(function (w) {
				return w.replace(/<[^>]+>/g, "");
			});
		}

		it("none for an order whose parts are all marked", function () {
			chai.assert.deepEqual(warnings(head + 'P:(AB)3\nK:C\nP:A\nCDEF|\nP:B\nGABc|]\n'), []);
		});

		it("none for parts with no order", function () {
			chai.assert.deepEqual(warnings(head + 'K:C\nP:A\nCDEF|\nP: 2 = version in D\nK:D\nGABc|]\n'), []);
		});

		it("none for an order naming a part the body never starts: it is ignored", function () {
			chai.assert.deepEqual(warnings(head + 'P:ABC\nK:C\nP:A\nCDEF|\nP:B\nGABc|]\n'), []);
		});

		it("none for an order that cannot be read, or free text: it is ignored", function () {
			["P:3A", "P:(AB", "P:ab", "P:A0", "P:(((A9)9)9)9", "P:Chorus", "P:Verse 1"].forEach(function (order) {
				chai.assert.deepEqual(warnings(head + order + '\nK:C\nP:A\nCDEF|]\n'), [], order);
			});
		});
	});

	describe("printing the order", function () {
		var abc = head + 'P:A3\nK:C\nP:A\nCDEF|]\n';

		function texts() {
			return Array.prototype.map.call(document.querySelectorAll("#paper text"), function (t) { return t.textContent; });
		}

		it("is printed above the tune, as before", function () {
			render(abc);
			chai.assert.include(texts(), "A3");
			chai.assert.include(texts(), "A", "the part's own label");
		});

		it("is not printed with hidePartOrder, and is still played", function () {
			var visualObj = render(abc, { hidePartOrder: true });
			chai.assert.notInclude(texts(), "A3");
			chai.assert.include(texts(), "A", "the part's own label is still drawn");
			chai.assert.deepEqual(pitches(visualObj), [[C, C, C].join(" ")]);
		});
	});
});
