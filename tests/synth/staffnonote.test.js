describe("%%staffnonote 0: audio and timing", function () {
	// %%staffnonote 0 hides a staff on any line where it has no notes. The staff is only hidden: its voice is still
	// part of the music. So the audio and the timing must be what they are without the directive — one track per
	// voice, each voice at its own times, the cursor following the drawn staffs — and the notation must be what it
	// was: the empty staffs hidden on the lines where they are empty.
	//
	// The version without %%staffnonote is the oracle for the audio. Each case also states its result outright,
	// so a failure says what came out rather than only that two runs disagree.

	var cases = [
		{
			name: "two voices on one staff each, taking turns",
			abc: 'X:1\nM:4/4\nL:1/4\n%%staffnonote 0\nV:1 name="Solo"\nV:2 name="Choir"\nK:C\n' +
				'[V:1] CDEF | GABc |\n[V:2] X | X |\n' +
				'[V:1] X | X |\n[V:2] cBAG | FEDC |\n',
			// per track: number of notes, first start, last start (in whole notes)
			tracks: ["8 0-1.75", "8 2-3.75"],
			// the timing events: milliseconds@line, at a quarter note a second
			events: "0@0 1000@0 2000@0 3000@0 4000@0 5000@0 6000@0 7000@0 8000@1 9000@1 10000@1 11000@1 12000@1 13000@1 14000@1 15000@1",
			// staffs drawn on each line
			staffs: "1 1"
		},
		{
			name: "a solo staff and two shared staffs, like %%score Solo [(S A) (T B)]",
			abc: 'X:1\nM:4/4\nL:1/4\n%%score Solo [(S A) (T B)]\n%%staffnonote 0\n' +
				'V:Solo clef=treble name="Solo"\nV:S clef=treble name="Soprano" snm="S"\nV:A clef=treble name="Alto" snm="A"\n' +
				'V:T clef=bass name="Tenor" snm="T"\nV:B clef=bass name="Bass" snm="B"\nK:C\n' +
				'[V:Solo] c2d2 | g4 |\n[V:S] X | X |\n[V:A] X | X |\n[V:T] X | X |\n[V:B] X | X |\n' +
				'[V:Solo] X | X |]\n[V:S] e2d2 | c4 |]\n[V:A] cBAG | G4 |]\n[V:T] G2F2 | E4 |]\n[V:B] C,E,F,G, | C,4 |]\n',
			tracks: ["3 0-1", "3 2-3", "5 2-3", "3 2-3", "5 2-3"],
			// Before the fix the alto, the second voice on the second line, was read as the soprano's partner on
			// the first line's time: 0@0 1000@1 2000@0 3000@1 — the cursor jumping between the lines.
			events: "0@0 2000@0 4000@0 8000@1 9000@1 10000@1 11000@1 12000@1",
			staffs: "1 2"
		},
		{
			name: "a staff empty on a middle line only",
			abc: 'X:1\nM:4/4\nL:1/4\n%%staffnonote 0\nV:1 name="Melody"\nV:2 name="Bass" clef=bass\nK:C\n' +
				'[V:1] C2E2 | G4 |\n[V:2] C,D,E,F, | G,4 |\n' +
				'[V:1] c2A2 | F4 |\n[V:2] X | X |\n' +
				'[V:1] E2G2 | c4 |]\n[V:2] C,D,E,F, | C,4 |]\n',
			tracks: ["9 0-5", "10 0-5"],
			events: "0@0 1000@0 2000@0 3000@0 4000@0 8000@1 10000@1 12000@1 16000@2 17000@2 18000@2 19000@2 20000@2",
			staffs: "2 1 2"
		},
		{
			name: "visible rests count as no notes too",
			abc: 'X:1\nM:4/4\nL:1/4\n%%staffnonote 0\nV:1 name="Solo"\nV:2 name="Choir"\nK:C\n' +
				'[V:1] C4 | G4 |\n[V:2] z2z2 | z2z2 |\n' +
				'[V:1] z4 | z4 |\n[V:2] cBAG | FEDC |\n',
			tracks: ["2 0-1", "8 2-3.75"],
			// The hidden choir's rests at 2000 and 6000 are not drawn, so they make no event for the cursor to go to.
			// Without %%staffnonote they are drawn, and they do.
			events: "0@0 4000@0 8000@1 9000@1 10000@1 11000@1 12000@1 13000@1 14000@1 15000@1",
			eventsWithout: "0@0 2000@0 4000@0 6000@0 8000@1 9000@1 10000@1 11000@1 12000@1 13000@1 14000@1 15000@1",
			staffs: "1 1"
		},
		{
			name: "a hidden staff's rests in a triplet take the triplet's time",
			abc: 'X:1\nM:4/4\nL:1/4\n%%staffnonote 0\nV:1 name="Melody"\nV:2 name="Bass" clef=bass\nK:C\n' +
				'[V:1] C2E2 | G4 |\n[V:2] C,D,E,F, | G,4 |\n' +
				'[V:1] c2A2 | F4 |\n[V:2] (3z2z2z2 | z4 |\n' +
				'[V:1] E2G2 | c4 |]\n[V:2] C,D,E,F, | C,4 |]\n',
			tracks: ["9 0-5", "10 0-5"],
			events: "0@0 1000@0 2000@0 3000@0 4000@0 8000@1 10000@1 12000@1 16000@2 17000@2 18000@2 19000@2 20000@2",
			eventsWithout: "0@0 1000@0 2000@0 3000@0 4000@0 8000@1 9333@1 10000@1 10667@1 12000@1 16000@2 17000@2 18000@2 19000@2 20000@2",
			staffs: "2 1 2"
		},
		{
			name: "a tempo change on a hidden staff still changes the tempo",
			abc: 'X:1\nM:4/4\nL:1/4\nQ:1/4=60\n%%staffnonote 0\nV:1 name="Solo"\nV:2 name="Choir"\nK:C\n' +
				'[V:1] CDEF | GABc |\n[V:2] X | [Q:1/4=120] X |\n' +
				'[V:1] X | X |\n[V:2] cBAG | FEDC |\n',
			tracks: ["8 0-1.375", "8 1.5-2.375"],
			events: "0@0 1000@0 2000@0 3000@0 4000@0 4500@0 5000@0 5500@0 6000@1 6500@1 7000@1 7500@1 8000@1 8500@1 9000@1 9500@1",
			staffs: "1 1"
		},
		{
			name: "a repeat that spans a line where a staff is hidden",
			abc: 'X:1\nM:4/4\nL:1/4\n%%staffnonote 0\nV:1 name="Solo"\nV:2 name="Choir"\nK:C\n' +
				'[V:1] |: CDEF | GABc |\n[V:2] |: X | X |\n' +
				'[V:1] X |1 X :|2 X |]\n[V:2] cBAG |1 FEDC :|2 C4 |]\n',
			tracks: ["16 0-5.75", "13 2-7"],
			events: "0@0 1000@0 2000@0 3000@0 4000@0 5000@0 6000@0 7000@0 8000@1 9000@1 10000@1 11000@1 12000@1 13000@1 14000@1 15000@1 16000@0 17000@0 18000@0 19000@0 20000@0 21000@0 22000@0 23000@0 24000@1 25000@1 26000@1 27000@1 28000@1",
			staffs: "1 1"
		},
		{
			name: "a repeat on a staff hidden from the first line",
			abc: 'X:1\nM:4/4\nL:1/4\n%%staffnonote 0\nV:1 name="Choir"\nV:2 name="Solo"\nK:C\n' +
				'[V:1] |: X | X :|\n[V:2] |: CDEF | GABc :|\n' +
				'[V:1] |: cBAG | FEDC :|\n[V:2] |: X | X :|\n',
			tracks: ["16 4-7.75", "16 0-3.75"],
			events: "0@0 1000@0 2000@0 3000@0 4000@0 5000@0 6000@0 7000@0 8000@0 9000@0 10000@0 11000@0 12000@0 13000@0 14000@0 15000@0 16000@1 17000@1 18000@1 19000@1 20000@1 21000@1 22000@1 23000@1 24000@1 25000@1 26000@1 27000@1 28000@1 29000@1 30000@1 31000@1",
			staffs: "1 1"
		}
	];

	function render(abc) {
		return abcjs.renderAbc("paper", abc, { add_classes: true })[0];
	}

	// The notes of each track, without startChar and endChar: taking the directive out moves the text.
	function notes(visualObj) {
		return visualObj.setUpAudio().tracks.map(function (track) {
			return track.filter(function (ev) { return ev.cmd === "note"; }).map(function (ev) {
				return { pitch: ev.pitch, volume: ev.volume, start: ev.start, duration: ev.duration, instrument: ev.instrument, gap: ev.gap };
			});
		});
	}

	function trackNames(visualObj) {
		return visualObj.setUpAudio().tracks.map(function (track) {
			var name = track.filter(function (ev) { return ev.cmd === "text" && ev.type === "name"; })[0];
			return name ? name.text : "";
		});
	}

	function trackSummary(tracks) {
		return tracks.map(function (track) {
			return track.length + " " + (track.length ? track[0].start + "-" + track[track.length - 1].start : "");
		});
	}

	function events(visualObj) {
		return visualObj.setTiming(60, 0).filter(function (ev) { return ev.type === "event"; }).map(function (ev) {
			return ev.milliseconds + "@" + ev.line;
		}).join(" ");
	}

	function staffsPerLine() {
		var wrappers = document.querySelectorAll("#paper .abcjs-staff-wrapper");
		var counts = [];
		for (var i = 0; i < wrappers.length; i++)
			counts.push(wrappers[i].querySelectorAll(".abcjs-staff").length);
		return counts.join(" ");
	}

	function without(abc) {
		return abc.replace(/^%%staffnonote.*\n/m, "");
	}

	cases.forEach(function (c) {
		describe(c.name, function () {
			it("hides the same staffs", function () {
				render(c.abc);
				chai.assert.equal(staffsPerLine(), c.staffs);
			});

			it("plays one track per voice, each at its own time", function () {
				var got = notes(render(c.abc));
				chai.assert.deepEqual(trackSummary(got), c.tracks);
				var expected = notes(render(without(c.abc)));
				chai.assert.deepEqual(JSON.stringify(got), JSON.stringify(expected), "the same notes as without %%staffnonote");
				chai.assert.deepEqual(trackNames(render(c.abc)), trackNames(render(without(c.abc))), "the same track names as without %%staffnonote");
			});

			it("times the cursor by the drawn staffs", function () {
				chai.assert.equal(events(render(c.abc)), c.events);
				chai.assert.equal(events(render(without(c.abc))), c.eventsWithout || c.events, "without %%staffnonote");
			});
		});
	});

	describe("unchanged where nothing is hidden", function () {
		var abc = cases[0].abc;
		["", "%%staffnonote 1\n"].forEach(function (directive) {
			var label = directive ? "%%staffnonote 1" : "no %%staffnonote";
			it(label, function () {
				var visualObj = render(abc.replace("%%staffnonote 0\n", directive));
				for (var i = 0; i < visualObj.lines.length; i++)
					chai.assert.isUndefined(visualObj.lines[i].hiddenStaffs, "line " + i + " has no hidden staffs");
				chai.assert.equal(staffsPerLine(), "2 2");
				chai.assert.deepEqual(trackSummary(notes(visualObj)), cases[0].tracks);
				chai.assert.equal(events(visualObj), cases[0].events);
			});
		});

		it("%%staffnonote 0 with every staff in use", function () {
			var visualObj = render('X:1\nM:4/4\nL:1/4\n%%staffnonote 0\nV:1\nV:2\nK:C\n[V:1] CDEF |\n[V:2] C,D,E,F, |\n[V:1] GABc |]\n[V:2] G,A,B,C |]\n');
			for (var i = 0; i < visualObj.lines.length; i++)
				chai.assert.isUndefined(visualObj.lines[i].hiddenStaffs, "line " + i + " has no hidden staffs");
			chai.assert.equal(staffsPerLine(), "2 2");
			chai.assert.deepEqual(trackSummary(notes(visualObj)), ["8 0-1.75", "8 0-1.75"]);
		});
	});

	it("%%maxstaves: the timing covers only the lines that are drawn", function () {
		var visualObj = render(cases[0].abc.replace("%%staffnonote 0\n", "%%staffnonote 0\n%%maxstaves 1\n"));
		chai.assert.equal(staffsPerLine(), "1");
		chai.assert.equal(events(visualObj), "0@0 1000@0 2000@0 3000@0 4000@0 5000@0 6000@0 7000@0");
		chai.assert.deepEqual(trackSummary(notes(visualObj)), cases[0].tracks, "the audio is all of it");
	});

	it("The Boar's Head Carol: the choir enters after the verse", function () {
		// The tune this was reported on. Five voices; the solo's staff is hidden on the refrain and the choir's on the verse.
		var abc = 'X:1\nT:The Boar\'s Head Carol\nM:4/4\nL:1/8\n%%score Solo [(S A) (T B)]\n%%staffnonote 0\n' +
			'V:Solo clef=treble name="Solo"\nV:S clef=treble name="Soprano" snm="S"\nV:A clef=treble name="Alto" snm="A"\n' +
			'V:T clef=bass name="Tenor" snm="T"\nV:B clef=bass name="Bass" snm="B"\nK:C\n' +
			'[V:Solo] G2 | c4 c3 c | B2 c2 G3 E | F2 F2 A3 F | G3 G c2 G G |\n' +
			'[V:S] x2 | X | X | X | X |\n[V:A] x2 | X | X | X | X |\n[V:T] x2 | X | X | X | X |\n[V:B] x2 | X | X | X | X |\n' +
			'[V:Solo] c2 c c c2 c2 | B2 c2 G3 E | F2 F2 A3 F | G3 G c4 |\n' +
			'[V:S] X | X | X | X |\n[V:A] X | X | X | X |\n[V:T] X | X | X | X |\n[V:B] X | X | X | X |\n' +
			'[V:Solo] X | X | X | X |]\n' +
			'[V:S] c3 c B2 B2 | c2 c2 G4 | F2 F2 A3 F | G3 G c4 |]\n' +
			'[V:A] G3 G G2 G2 | G2 G2 D4 | F2 F2 F3 F | G2 D2 E4 |]\n' +
			'[V:T] E3 E D2 D2 | D2 D2 C4 | D2 D2 D2 D2 | D2 C2 B,4 |]\n' +
			'[V:B] C3 C G,2 G,2 | E,2 E,2 G,4 | A,2 A,2 F,2 F,2 | E,2 G,2 C,4 |]\n';
		var visualObj = render(abc);
		chai.assert.equal(staffsPerLine(), "1 1 2");
		var got = notes(visualObj);
		chai.assert.deepEqual(trackSummary(got), ["33 0-7.75", "14 8.25-11.75", "14 8.25-11.75", "14 8.25-11.75", "14 8.25-11.75"]);
		chai.assert.deepEqual(JSON.stringify(got), JSON.stringify(notes(render(without(abc)))), "the same notes as without %%staffnonote");
		var timing = events(visualObj);
		chai.assert.equal(timing, events(render(without(abc))), "the same events as without %%staffnonote");
		var lines = timing.split(" ").map(function (ev) { return +ev.split("@")[1]; });
		for (var i = 1; i < lines.length; i++)
			chai.assert.isAtLeast(lines[i], lines[i - 1], "the cursor never goes back a line: " + timing);
	});
});
