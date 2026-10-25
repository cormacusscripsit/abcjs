// Navigation marks: !segno!, !D.S.!, !D.C.! (and their "al fine" forms), and !fine!.
//
// The audio (src/synth/repeats.js) and the timing (src/data/abc_tune.js) both play the music as written, then,
// at the end of the bar that carries the D.S. or D.C., go back to the segno (or to the start) and play on to the
// end of the bar that carries the first Fine after that point -- or to the end, if there is none.
//
// A mark is usually written in one voice only, but it applies to all of them, so it is found by time: each layer
// passes one timeline per voice, in the written order with repeats not yet expanded, and every voice uses the
// times found in any of them. On the way back, repeats are not taken again and only the last of a set of endings
// is played, which is the usual reading.
//
// Not handled: the "al coda" forms and !coda! (they are played as written).

var EPSILON = 0.0000001;

var JUMPS = {
	"D.S.": "D.S.",
	"D.S.alfine": "D.S.",
	"D.C.": "D.C.",
	"D.C.alfine": "D.C."
};

// Each timeline is an array of { kind: 'note'|'bar'|'other', time: number, end: number, decoration: [] } in the
// order written, where time and end are in whole notes from the start of the tune. Returns null when there is
// nowhere to go, or { target, jumpAt, stopAt }: go back to `target` when the music reaches `jumpAt`, and stop at
// `stopAt` (Infinity for the end).
function findNavigation(timelines) {
	var segno, jumpAt, jumpKind, fines = [];
	for (var v = 0; v < timelines.length; v++) {
		var timeline = timelines[v];
		for (var i = 0; i < timeline.length; i++) {
			var ev = timeline[i];
			if (ev.kind !== 'note' || !ev.decoration)
				continue;
			for (var d = 0; d < ev.decoration.length; d++) {
				var decoration = ev.decoration[d];
				if (decoration === "segno" && (segno === undefined || ev.time < segno))
					segno = ev.time;
				else if (JUMPS[decoration]) {
					var at = barEnd(timeline, i);
					if (jumpAt === undefined || at < jumpAt) {
						jumpAt = at;
						jumpKind = JUMPS[decoration];
					}
				} else if (decoration === "fine")
					fines.push(barEnd(timeline, i));
			}
		}
	}
	if (jumpAt === undefined)
		return null;
	var target = jumpKind === "D.S." ? segno : 0;
	if (target === undefined || target >= jumpAt - EPSILON)
		return null; // a D.S. with no segno, or a segno after it: play as written
	var stopAt = Infinity;
	for (var f = 0; f < fines.length; f++) {
		if (fines[f] > target + EPSILON && fines[f] < stopAt)
			stopAt = fines[f];
	}
	return { target: target, jumpAt: jumpAt, stopAt: stopAt };
}

// The time at which the bar holding timeline[index] ends: the next bar line, or the end of the voice.
function barEnd(timeline, index) {
	for (var i = index + 1; i < timeline.length; i++) {
		if (timeline[i].kind === 'bar')
			return timeline[i].time;
	}
	var end = timeline[index].end;
	for (var j = index + 1; j < timeline.length; j++)
		end = Math.max(end, timeline[j].end);
	return end;
}

// The span of a voice to play on the way back: from the first element at the target (with the key, meter and
// other non-note elements just before it) to the bar line that ends the Fine's bar (or the end).
// Returns { start, end } as indexes into the timeline, inclusive, or null if the voice has nothing there.
function returnSpan(timeline, nav) {
	var start = -1;
	for (var i = 0; i < timeline.length; i++) {
		if (timeline[i].kind === 'note' && timeline[i].time >= nav.target - EPSILON) {
			start = i;
			break;
		}
	}
	if (start < 0)
		return null;
	while (start > 0 && timeline[start - 1].kind === 'other')
		start--;
	var end = timeline.length - 1;
	if (nav.stopAt !== Infinity) {
		end = start;
		for (var j = start; j < timeline.length; j++) {
			if (timeline[j].kind === 'note' && timeline[j].time >= nav.stopAt - EPSILON)
				break;
			end = j;
		}
	}
	return { start: start, end: end };
}

// The index of the first note at or after the jump: the written music is played up to (not including) it.
function jumpIndex(timeline, nav) {
	for (var i = 0; i < timeline.length; i++) {
		if (timeline[i].kind === 'note' && timeline[i].time >= nav.jumpAt - EPSILON)
			return i;
	}
	return timeline.length;
}

module.exports = {
	findNavigation: findNavigation,
	returnSpan: returnSpan,
	jumpIndex: jumpIndex,
	EPSILON: EPSILON
};
