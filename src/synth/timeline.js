// The timeline player (fork, `feat/windows`): the one thing that schedules
// sound. It plays a list of passes, each a primed `CreateSynth` placed at an
// offset in heard seconds, a window at a time: the one sounding and those
// scheduled ahead of it (three at 5 s windows and 10 s ahead), never the tune. A tune on its own is a timeline of one pass; a set is
// its members, each as many times as it is played.
//
// The rules, each from a measurement or a review (abctool's
// plans/abcjs-windows.md):
//   - A window is rendered across every pass it touches, so the join between
//     two passes is mixed like any two notes.
//   - Windows start on whole frames, back to back: two windows started a whole
//     number of frames apart join exactly; half a frame off, they click.
//   - The origin is the first window's scheduled time, after the window is
//     ready: nothing at a start, a seek or a resume is dropped.
//   - A later window ready late (a stalled page) starts with the frames it
//     missed dropped, so the sound rejoins the clock and never trails it.
//   - The next window is scheduled by its number under a run counter, from a
//     timer and the clock, never by counting `ended` events: Chromium fires
//     `ended` twice for one source.
//   - At least `aheadSec` of sound is scheduled ahead of the clock: a locked
//     phone runs the page's timers once a second.
var activeAudioContext = require('./active-audio-context');

function Timeline(options) {
	var self = this;
	options = options || {};
	self.windowSec = options.windowSec || 5;
	self.firstWindowSec = options.firstWindowSec || 1;
	self.aheadSec = options.aheadSec || 10;
	self.leadSec = options.leadSec !== undefined ? options.leadSec : 0.03;
	self.tickMs = options.tickMs || 200;
	self.onWindow = options.onWindow; // ({ from, frames, when }) for tests
	self.onEnd = options.onEnd; // when the last window has played out
	self.passes = [];
	self.run = 0;
	self.sources = [];
	self.timer = null;
	self.origin = null; // the clock's time at which heard frame 0 sits
	self.isRunning = false;

	// [{ synth, at }]: `at` in heard seconds, snapped to a frame when played.
	self.setPasses = function (passes) {
		self.stop();
		self.passes = passes.slice();
	};

	self.sampleRate = function () {
		return activeAudioContext().sampleRate;
	};

	self.totalFrames = function () {
		var sr = self.sampleRate();
		var end = 0;
		self.passes.forEach(function (p) {
			end = Math.max(end, Math.round(p.at * sr) + p.synth.totalFrames());
		});
		return end;
	};

	// Frames [from, from + count) of the whole timeline, mixed.
	self.renderFrames = function (from, count) {
		var sr = self.sampleRate();
		var out = activeAudioContext().createBuffer(2, Math.max(1, count), sr);
		var parts = [];
		self.passes.forEach(function (p) {
			var at = Math.round(p.at * sr);
			var len = p.synth.totalFrames();
			var a = Math.max(from, at);
			var b = Math.min(from + count, at + len);
			if (a >= b) return;
			parts.push(p.synth.renderFrames(a - at, b - a).then(function (buffer) {
				return { buffer: buffer, offset: a - from };
			}));
		});
		return Promise.all(parts).then(function (rendered) {
			rendered.forEach(function (r) {
				for (var ch = 0; ch < 2; ch++) {
					var src = r.buffer.getChannelData(ch);
					var dst = out.getChannelData(ch);
					for (var n = 0; n < src.length && n + r.offset < count; n++) dst[n + r.offset] += src[n];
				}
			});
			return out;
		});
	};

	// Start sounding at `fromSec` of heard time. Resolves with the origin: the
	// clock's time at which heard 0 sits, so that the position is
	// `currentTime - origin`. A start that a stop overtook resolves with null.
	self.start = function (fromSec) {
		self.stopSounds();
		var run = ++self.run;
		var sr = self.sampleRate();
		var total = self.totalFrames();
		var from = Math.max(0, Math.min(Math.round(fromSec * sr), total));
		var first = Math.min(Math.round(self.firstWindowSec * sr), total - from);
		self.isRunning = true;
		if (first <= 0) {
			self.isRunning = false;
			return Promise.resolve(activeAudioContext().currentTime - fromSec);
		}
		return self.renderFrames(from, first).then(function (buffer) {
			if (run !== self.run) return null;
			var ctx = activeAudioContext();
			// On a whole frame, a little ahead of the clock: the origin is where it sounds.
			var when = Math.ceil((ctx.currentTime + self.leadSec) * sr) / sr;
			self.origin = when - from / sr;
			self.play(buffer, from, when, 0);
			self.scheduledTo = from + first;
			self.timer = setInterval(function () { self.tick(run); }, self.tickMs);
			self.tick(run);
			return self.origin;
		});
	};

	self.play = function (buffer, from, when, offsetSec) {
		var ctx = activeAudioContext();
		var source = ctx.createBufferSource();
		source.buffer = buffer;
		source.connect(ctx.destination);
		source.start(when, offsetSec);
		self.sources.push(source);
		// Let go of a window once it has played: two held, never the whole tune.
		var last = from + buffer.length >= self.totalFrames();
		source.onended = function () {
			var i = self.sources.indexOf(source);
			if (i >= 0) self.sources.splice(i, 1);
			if (last && self.onEnd && i >= 0) self.onEnd();
		};
		if (self.onWindow) self.onWindow({ from: from, frames: buffer.length, when: when, offset: offsetSec });
	};

	// Schedule windows until `aheadSec` is covered; one render at a time.
	self.tick = function (run) {
		if (run !== self.run || self.rendering) return;
		var ctx = activeAudioContext();
		var sr = self.sampleRate();
		var total = self.totalFrames();
		if (self.scheduledTo >= total) {
			clearInterval(self.timer);
			self.timer = null;
			return;
		}
		var due = self.origin + self.scheduledTo / sr;
		if (due > ctx.currentTime + self.aheadSec) return;
		var from = self.scheduledTo;
		var count = Math.min(Math.round(self.windowSec * sr), total - from);
		self.rendering = true;
		self.renderFrames(from, count).then(function (buffer) {
			self.rendering = false;
			if (run !== self.run) return;
			var now = activeAudioContext().currentTime;
			var when = self.origin + from / sr;
			var missed = now + self.leadSec - when;
			if (missed > 0) {
				// Late: drop what was missed and rejoin the clock, never trail it.
				var start = Math.ceil((now + self.leadSec) * sr) / sr;
				// Both on the frame grid (the origin is), so the offset is whole frames.
				if (start - when < buffer.duration) self.play(buffer, from, start, start - when);
			} else {
				self.play(buffer, from, when, 0);
			}
			self.scheduledTo = from + count;
			self.tick(run);
		}, function () {
			self.rendering = false;
		});
	};

	// Where the sound is, in heard seconds, while running.
	self.position = function () {
		if (self.origin === null) return 0;
		return activeAudioContext().currentTime - self.origin;
	};

	// The windows held now: the one sounding and those scheduled ahead.
	self.held = function () {
		return self.sources.length;
	};

	self.stopSounds = function () {
		self.run++;
		self.rendering = false;
		if (self.timer !== null) clearInterval(self.timer);
		self.timer = null;
		self.sources.forEach(function (s) {
			try { s.stop(); } catch (e) { /* never started, or over */ }
		});
		self.sources = [];
	};

	self.stop = function () {
		self.stopSounds();
		self.isRunning = false;
	};
}

module.exports = Timeline;
