describe("Tie Slur", function () {
	var abcMultipartTie = 
		"X:1\n" +
		"%%staffwidth 200\n" +
		"M:C\n" +
		"K:E\n" +
		"[V:T1] G8-|\n" +
		"[V:B1] c8-|\n" +
		"[V:T1] G8-|\n" +
		"G8||\n" +
		"[V:B1] c8-|\n" +
		"c8||\n"

	var expectedMultipartTie = [
		{line: 0, staff: 0, startTie: {}, endTie: undefined},
		{line: 0, staff: 1, startTie: {}, endTie: undefined},
		{line: 1, staff: 0, startTie: {}, endTie: true},
		{line: 1, staff: 1, startTie: {}, endTie: true},
		{line: 2, staff: 0, startTie: undefined, endTie: true},
		{line: 2, staff: 1, startTie: undefined, endTie: true},
	]

	var abcMultipartChordTie = 
		"X:1\n" +
		"%%staffwidth 200\n" +
		"M:C\n" +
		"K:E\n" +
		"[V:T1] [GB]8-|\n" +
		"[V:B1] [ce]8-|\n" +
		"[V:T1] [GB]8-|\n" +
		"[GB]8||\n" +
		"[V:B1] [ce]8-|\n" +
		"[ce]8||\n"

	var expectedMultipartChordTie = [
		{line: 0, staff: 0, startTie: {}, endTie: undefined},
		{line: 0, staff: 0, startTie: {}, endTie: undefined},
		{line: 0, staff: 1, startTie: {}, endTie: undefined},
		{line: 0, staff: 1, startTie: {}, endTie: undefined},
		{line: 1, staff: 0, startTie: {}, endTie: true},
		{line: 1, staff: 0, startTie: {}, endTie: true},
		{line: 1, staff: 1, startTie: {}, endTie: true},
		{line: 1, staff: 1, startTie: {}, endTie: true},
		{line: 2, staff: 0, startTie: undefined, endTie: true},
		{line: 2, staff: 0, startTie: undefined, endTie: true},
		{line: 2, staff: 1, startTie: undefined, endTie: true},
		{line: 2, staff: 1, startTie: undefined, endTie: true},
	]

	var abcMultipartOneStaffChordTie = 
		"X:1\n" +
		"%%staffwidth 200\n" +
		"%%staves (T1 B1)\n" +
		"M:C\n" +
		"K:E\n" +
		"[V:T1] [GB]8-|\n" +
		"[V:B1] [ce]8-|\n" +
		"[V:T1] [GB]8-|\n" +
		"[GB]8||\n" +
		"[V:B1] [ce]8-|\n" +
		"[ce]8||\n"

	var expectedMultipartOneStaffChordTie = [
		{line: 0, staff: 0, startTie: {}, endTie: undefined},
		{line: 0, staff: 0, startTie: {}, endTie: undefined},
		{line: 0, staff: 0, startTie: {}, endTie: undefined},
		{line: 0, staff: 0, startTie: {}, endTie: undefined},
		{line: 1, staff: 0, startTie: {}, endTie: true},
		{line: 1, staff: 0, startTie: {}, endTie: true},
		{line: 1, staff: 0, startTie: {}, endTie: true},
		{line: 1, staff: 0, startTie: {}, endTie: true},
		{line: 2, staff: 0, startTie: undefined, endTie: true},
		{line: 2, staff: 0, startTie: undefined, endTie: true},
		{line: 2, staff: 0, startTie: undefined, endTie: true},
		{line: 2, staff: 0, startTie: undefined, endTie: true},
	]

	var abcMultipartTieHeight = 
		"X:1\n" +
		"%%stretchlast 1\n" +
		"L:1/8\n" +
		"M:4/4\n" +
		"K:D\n" +
		"%%score (S A) (T B)\n" +
		"V:S clef=treble middle=B stem=up\n" +
		"V:A clef=treble middle=B stem=down\n" +
		"V:T clef=bass,, stem=up\n" +
		"V:B clef=bass,, stem=down\n" +
		"[V:S]\n" +
		"F2|F2 EF G2 E2|C6||\n" +
		"[V:A]\n" +
		"D2|D2 C=C B,2 B,2|A,6||\n" +
		"[V:T]\n" +
		"A,2|A,2(G,A,)G,2G,2|G,6||\n" +
		"[V:B]\n" +
		"D,2|D,2A,,A,,G,,2G,,2|A,,6||\n"

	var expectedMultipartTieHeight = [ 14, 20 ]

	// The tie state saved at [1 and restored at :|[2 belongs to the voice that
	// wrote them. Restoring every voice let a later voice's :|[2 put back a
	// snapshot taken lines earlier, wiping a tie an earlier voice had just
	// opened in its own second ending: the next line's note lost its endTie
	// and the engraver drew the tie edge to edge across that line.
	var abcTieAfterSecondEnding =
		"X:1\n" +
		"M:4/4\n" +
		"K:C\n" +
		"[V:S] |: c4 |[1 c4 |\n" +
		"[V:A] |: e4 |[1 e4 |\n" +
		"[V:S] c4 :|[2 G4- |\n" +
		"[V:A] e4 :|[2 C4- |\n" +
		"[V:S] G4 |]\n" +
		"[V:A] C4 |]\n"

	var expectedTieAfterSecondEnding = [
		{line: 0, staff: 0, startTie: undefined, endTie: undefined},
		{line: 0, staff: 0, startTie: undefined, endTie: undefined},
		{line: 0, staff: 1, startTie: undefined, endTie: undefined},
		{line: 0, staff: 1, startTie: undefined, endTie: undefined},
		{line: 1, staff: 0, startTie: undefined, endTie: undefined},
		{line: 1, staff: 0, startTie: {}, endTie: undefined},
		{line: 1, staff: 1, startTie: undefined, endTie: undefined},
		{line: 1, staff: 1, startTie: {}, endTie: undefined},
		{line: 2, staff: 0, startTie: undefined, endTie: true},
		{line: 2, staff: 1, startTie: undefined, endTie: true},
	]

	// A tie open going into [1 ends on the first note of [1 and, after the
	// restore, on the first note of [2 as well, in each voice: though the
	// soprano's tie has ended by the time the alto reaches its own [1.
	var abcTieIntoBothEndings =
		"X:1\n" +
		"M:4/4\n" +
		"K:C\n" +
		"[V:S] |: c4- |[1 c4 |\n" +
		"[V:A] |: e4- |[1 e4 |\n" +
		"[V:S] c4 :|[2 c4 |]\n" +
		"[V:A] e4 :|[2 e4 |]\n"

	var expectedTieIntoBothEndings = [
		{line: 0, staff: 0, startTie: {}, endTie: undefined},
		{line: 0, staff: 0, startTie: undefined, endTie: true},
		{line: 0, staff: 1, startTie: {}, endTie: undefined},
		{line: 0, staff: 1, startTie: undefined, endTie: true},
		{line: 1, staff: 0, startTie: undefined, endTie: undefined},
		{line: 1, staff: 0, startTie: undefined, endTie: true},
		{line: 1, staff: 1, startTie: undefined, endTie: undefined},
		{line: 1, staff: 1, startTie: undefined, endTie: true},
	]

	// The same with only the lower voice tied: its own state comes back at :|[2,
	// not the soprano's.
	var abcTieIntoEndingsLowerVoice =
		"X:1\n" +
		"M:4/4\n" +
		"K:C\n" +
		"[V:S] |: c4 |[1 c4 |\n" +
		"[V:A] |: e4- |[1 e4 |\n" +
		"[V:S] c4 :|[2 c4 |]\n" +
		"[V:A] e4 :|[2 e4 |]\n"

	var expectedTieIntoEndingsLowerVoice = [
		{line: 0, staff: 0, startTie: undefined, endTie: undefined},
		{line: 0, staff: 0, startTie: undefined, endTie: undefined},
		{line: 0, staff: 1, startTie: {}, endTie: undefined},
		{line: 0, staff: 1, startTie: undefined, endTie: true},
		{line: 1, staff: 0, startTie: undefined, endTie: undefined},
		{line: 1, staff: 0, startTie: undefined, endTie: undefined},
		{line: 1, staff: 1, startTie: undefined, endTie: undefined},
		{line: 1, staff: 1, startTie: undefined, endTie: true},
	]

	// A tie left open at the end of [1 goes back to the repeat, not into [2.
	var abcTieOutOfFirstEnding =
		"X:1\n" +
		"M:4/4\n" +
		"K:C\n" +
		"[V:S] |: c4 |[1 c4- :|[2 c4 |]\n" +
		"[V:A] |: e4 |[1 e4- :|[2 e4 |]\n"

	var expectedTieOutOfFirstEnding = [
		{line: 0, staff: 0, startTie: undefined, endTie: undefined},
		{line: 0, staff: 0, startTie: {}, endTie: undefined},
		{line: 0, staff: 0, startTie: undefined, endTie: undefined},
		{line: 0, staff: 1, startTie: undefined, endTie: undefined},
		{line: 0, staff: 1, startTie: {}, endTie: undefined},
		{line: 0, staff: 1, startTie: undefined, endTie: undefined},
	]

	it('tie-after-second-ending-across-line', function() {
		doParseTest(abcTieAfterSecondEnding, expectedTieAfterSecondEnding)
	})

	it('tie-into-both-endings', function() {
		doParseTest(abcTieIntoBothEndings, expectedTieIntoBothEndings)
	})

	it('tie-into-endings-lower-voice', function() {
		doParseTest(abcTieIntoEndingsLowerVoice, expectedTieIntoEndingsLowerVoice)
	})

	it('tie-out-of-first-ending', function() {
		doParseTest(abcTieOutOfFirstEnding, expectedTieOutOfFirstEnding)
	})

	it('multipart-tie', function() {
		doParseTest(abcMultipartTie, expectedMultipartTie)
	})

	it('multipart-chord-tie', function() {
		doParseTest(abcMultipartChordTie, expectedMultipartChordTie)
	})

	it('multipart-one-staff-chord-tie', function() {
		doParseTest(abcMultipartOneStaffChordTie, expectedMultipartOneStaffChordTie)
	})

	it('multipart-tie-height', function() {
		doHeightTest(abcMultipartTieHeight, expectedMultipartTieHeight)
	})

	function doHeightTest(abc, expected) {
		var visualObj = abcjs.renderAbc("paper", abc, {});
		var actual = []
		for (var i = 0; i < visualObj[0].lines.length; i++) {
			var line = visualObj[0].lines[i]
			for (var j = 0; j < line.staffGroup.staffs.length; j++) {
				var staff = line.staffGroup.staffs[j]
				actual.push(Math.round(staff.top))
			}
		}
		chai.assert.deepStrictEqual(actual, expected);
	}

	function doParseTest(abc, expected) {
		var visualObj = abcjs.renderAbc("paper", abc, {});
		var actual = []
		for (var i = 0; i < visualObj[0].lines.length; i++) {
			var line = visualObj[0].lines[i]
			for (var j = 0; j < line.staff.length; j++) {
				var staff = line.staff[j]
				for (var k = 0; k < staff.voices.length; k++) {
					var voice = staff.voices[k]
					for (var ii = 0; ii < voice.length; ii++) {
						var elem = voice[ii]
						if (elem.pitches) {
							for (var jj = 0; jj < elem.pitches.length; jj++) {
								var pitch = elem.pitches[jj]
								actual.push({line: i, staff: j, startTie: pitch.startTie, endTie: pitch.endTie})
							}
						}
					}
				}
			}
		}
		console.log(actual)
		chai.assert.deepStrictEqual(actual, expected);
	}
})
