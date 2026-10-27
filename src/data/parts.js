// Parts: a P: field in the tune header is the order the parts are played in -- P:ABA, P:A3, P:(AB)3, P:A(BC)2D --
// and each P: in the body (or an inline [P:x]) marks where a part starts. A part runs until the next one starts,
// or to the end of the tune.
//
// The audio (src/synth/repeats.js) and the timing (src/data/abc_tune.js) both play each part of the order in turn,
// taking the repeats inside it. A part is usually marked in one voice only, but it applies to all of them, so the
// starts are found by time: each layer passes one timeline per voice, in the written order with repeats not yet
// expanded, and every voice uses the times found in any of them. Music before the first part is played once,
// first. A part's name is one capital letter, as in the order; a body P: with any other text (P: 2 = version in D)
// is a label only, drawn but not a part, so its music stays in the part before it. An order that cannot be read,
// or that names a part the body never starts, is ignored without a warning: the tune is played as written.

var EPSILON = 0.0000001;
var MAX_LENGTH = 1000; // the most parts an order may expand to

// Whether a body P:'s text names a part the order can play: one capital letter, as parseOrder reads them.
function isPartName(text) {
	return /^[A-Z]$/.test(text);
}

// The header field's text, which the parser may have turned into font-change pieces.
function orderText(partOrder) {
	if (!partOrder)
		return "";
	if (typeof partOrder === "string")
		return partOrder;
	if (partOrder.length === undefined)
		return "";
	var text = "";
	for (var i = 0; i < partOrder.length; i++)
		text += typeof partOrder[i] === "string" ? partOrder[i] : (partOrder[i].text || "");
	return text;
}

// Expand a play order into the parts it plays, in order: "A(BC)2D" -> ["A", "B", "C", "B", "C", "D"].
// A number after a part or a group repeats it; dots and spaces are only for legibility.
// Returns { order: [] } or { error: string }.
function parseOrder(text) {
	var source = text.replace(/[.\s]/g, "");
	var pos = 0;

	function count() {
		var start = pos;
		while (pos < source.length && source[pos] >= "0" && source[pos] <= "9")
			pos++;
		return pos === start ? 1 : parseInt(source.substring(start, pos), 10);
	}

	function sequence(depth) {
		var out = [];
		while (pos < source.length) {
			var c = source[pos];
			var item;
			if (c >= "A" && c <= "Z") {
				pos++;
				item = [c];
			} else if (c === "(") {
				pos++;
				item = sequence(depth + 1);
				if (item.error)
					return item;
				if (source[pos] !== ")")
					return { error: "a group is not closed" };
				pos++;
			} else if (c === ")") {
				if (depth === 0)
					return { error: "a group is closed that was not opened" };
				return out;
			} else
				return { error: "'" + c + "' is not a part name, a number or a bracket" };
			var times = count();
			if (times === 0)
				return { error: "a part is played zero times" };
			if (out.length + item.length * times > MAX_LENGTH)
				return { error: "it plays more than " + MAX_LENGTH + " parts" };
			for (var t = 0; t < times; t++)
				out = out.concat(item);
		}
		if (depth > 0)
			return { error: "a group is not closed" };
		return out;
	}

	if (source.length === 0)
		return { error: "it is empty" };
	if (source[0] >= "0" && source[0] <= "9")
		return { error: "a number comes before the part it repeats: write A3, not 3A" };
	var order = sequence(0);
	if (order.error)
		return order;
	return { order: order };
}

// Each timeline is an array of { kind: 'note'|'bar'|'other', time, end, part } in the order written, where time
// is in whole notes from the start of the tune and `part` is the name of a part that starts there. Returns the parts in time order, [{ name, start, end }] (end is Infinity for
// the last), with a part named "" for any music before the first, or [] when no part is marked.
function findSegments(timelines) {
	var starts = [];
	for (var v = 0; v < timelines.length; v++) {
		var timeline = timelines[v];
		for (var i = 0; i < timeline.length; i++) {
			var ev = timeline[i];
			if (ev.part === undefined || !isPartName(orderText(ev.part).trim()))
				continue;
			var found = false;
			for (var s = 0; s < starts.length; s++) {
				if (Math.abs(starts[s].start - ev.time) < EPSILON) {
					found = true; // the same start marked in two voices: the first voice's name wins
					break;
				}
			}
			if (!found)
				starts.push({ name: orderText(ev.part).trim(), start: ev.time });
		}
	}
	if (starts.length === 0)
		return [];
	starts.sort(function (a, b) { return a.start - b.start; });
	if (starts[0].start > EPSILON)
		starts.unshift({ name: "", start: 0 });
	for (var p = 0; p < starts.length; p++)
		starts[p].end = p + 1 < starts.length ? starts[p + 1].start : Infinity;
	return starts;
}

// The segments to play, as indexes into `segments`: the music before the first part (if any), then the order.
// A part started more than once in the body is played from its first start. Returns null if the order cannot be
// played: it cannot be read, or it names a part that is never started.
function playList(partOrder, segments) {
	var text = orderText(partOrder);
	if (!text || segments.length === 0)
		return null;
	var parsed = parseOrder(text);
	if (parsed.error)
		return null;
	var first = {};
	for (var s = segments.length - 1; s >= 0; s--)
		first[segments[s].name] = s;
	var list = [];
	if (segments[0].name === "")
		list.push(0);
	for (var i = 0; i < parsed.order.length; i++) {
		if (first[parsed.order[i]] === undefined)
			return null;
		list.push(first[parsed.order[i]]);
	}
	return list;
}

// Which segment each element of one voice's timeline belongs to, as inclusive index ranges in written order:
// [{ start, end }] parallel to `segments`, or null for a segment the voice has nothing in. A bar line that falls
// on a part's start ends the part before it, so a :| there repeats the earlier part.
function ranges(timeline, segments) {
	var out = segments.map(function () { return null; });
	var seg = 0;
	for (var i = 0; i < timeline.length; i++) {
		var ev = timeline[i];
		var at = ev.kind === 'bar' ? ev.time - EPSILON : ev.time + EPSILON;
		while (seg + 1 < segments.length && at >= segments[seg + 1].start)
			seg++;
		if (out[seg])
			out[seg].end = i;
		else
			out[seg] = { start: i, end: i };
	}
	return out;
}

module.exports = {
	orderText: orderText,
	parseOrder: parseOrder,
	findSegments: findSegments,
	playList: playList,
	ranges: ranges,
	EPSILON: EPSILON
};
