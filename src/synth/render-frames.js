// A stretch of a tune's sound, rendered on its own: the windowed render
// (fork, `feat/windows`). `prime()` used to render the whole tune into one
// AudioBuffer, 23 MB a minute at 48 kHz, which a slowed-down tune turned into
// hundreds of megabytes on a phone. This renders only the frames asked for.
//
// The samples are the same as the whole render's: the same distinct sounds
// (instrument, pitch, volume, length, pan, cents), each rendered by the same
// graph `placeNote` builds, placed at the same frames. Two differences, both
// deliberate:
//   - the sounds are mixed in a fixed order (the keys sorted), where the whole
//     render added each as its render completed; so two renders of the same
//     frames are equal to the bit, and differ from a `prime()` of 6.7.0 by at
//     most one float32 step where notes overlap;
//   - each sound is rendered only as long as its sample lasts (at its playback
//     rate) plus the fade: past the sample it was silence anyway.
var activeAudioContext = require('./active-audio-context');
var createNoteMap = require('./create-note-map');
var pitchToNoteName = require('./pitch-to-note-name');
var soundsCache = require('./sounds-cache');
var centsToFactor = require('./cents-to-factor');

// How many sounds render at once: bounded, so a window of a dense tune does
// not hold hundreds of offline contexts at the same moment.
var CONCURRENT = 4;

// The tune's distinct sounds and where each one starts, in frames at `sampleRate`.
// Built once per synth from the flattened tune `init()` made; no audio.
function buildIndex(synth, sampleRate, noteMapTracks, panDistances) {
	var tempoMultiplier = synth.millisecondsPerMeasure / 1000 / synth.meterSize;
	var fadeSec = synth.fadeLength / 1000;
	var noteEndSec = synth.noteEnd / 1000;
	var byKey = {};
	noteMapTracks.forEach(function (noteMap, trackNumber) {
		var pan = panDistances && panDistances.length > trackNumber ? panDistances[trackNumber] : 0;
		noteMap.forEach(function (note) {
			var len = Math.round((note.end - note.start) * 1000) / 1000;
			var cents = note.cents ? note.cents : 0;
			var key = note.instrument + ':' + note.pitch + ':' + note.volume + ':' + len + ':' + pan + ':' + tempoMultiplier + ':' + cents;
			if (!byKey[key]) {
				var ofsMs = synth.programOffsets[note.instrument];
				var soundLen = len * tempoMultiplier;
				if (ofsMs) soundLen += ofsMs / 1000;
				soundLen -= noteEndSec;
				if (soundLen < 0) soundLen = 0.005;
				byKey[key] = {
					key: key,
					sound: { instrument: note.instrument, pitch: note.pitch, volume: note.volume, len: soundLen, pan: pan, cents: cents },
					ofsMs: ofsMs,
					starts: [],
					// The longest it can sound: its length and the fade. Trimmed to the sample once loaded.
					frames: Math.floor((soundLen + fadeSec) * sampleRate)
				};
			}
			var start = note.start * tempoMultiplier;
			if (byKey[key].ofsMs) start -= byKey[key].ofsMs / 1000;
			if (start < 0) start = 0;
			byKey[key].starts.push(Math.floor(start * sampleRate));
		});
	});
	var musicSec = synth.flattened.totalDuration * tempoMultiplier;
	return {
		sampleRate: sampleRate,
		fadeSec: fadeSec,
		keys: Object.keys(byKey).sort().map(function (k) { return byKey[k]; }),
		musicFrames: Math.floor(musicSec * sampleRate),
		totalFrames: Math.floor((musicSec + fadeSec) * sampleRate)
	};
}

// One distinct sound, rendered alone from frame 0: `placeNote`'s graph.
function renderSound(entry, sampleRate, fadeSec, volumeMultiplier) {
	var sound = entry.sound;
	var noteName = pitchToNoteName[sound.pitch];
	var cached = soundsCache[sound.instrument] ? soundsCache[sound.instrument][noteName] : undefined;
	if (!cached) return Promise.resolve(null); // as placeNote: a missing note is a gap
	return cached.then(function (response) {
		var rate = sound.cents ? centsToFactor(sound.cents) : 1;
		// Past the sample's end the source is silent; only the fade's ramp is left.
		var heard = Math.min(sound.len, response.audioBuffer.duration / rate);
		var OfflineAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
		var ctx = new OfflineAC(2, Math.max(1, Math.floor((heard + fadeSec) * sampleRate)), sampleRate);
		var source = ctx.createBufferSource();
		source.buffer = response.audioBuffer;
		var volume = (sound.volume / 96) * volumeMultiplier;
		var gain = ctx.createGain();
		gain.gain.value = volume;
		gain.gain.linearRampToValueAtTime(volume, sound.len);
		gain.gain.linearRampToValueAtTime(0.0, sound.len + fadeSec);
		var panNode = null;
		if (sound.pan && ctx.createStereoPanner) {
			panNode = ctx.createStereoPanner();
			panNode.pan.setValueAtTime(sound.pan, 0);
		}
		if (sound.cents) source.playbackRate.value = rate;
		if (panNode) {
			panNode.connect(ctx.destination);
			gain.connect(panNode);
		} else {
			gain.connect(ctx.destination);
		}
		source.connect(gain);
		source.start(0);
		source.stop(sound.len + fadeSec);
		return ctx.startRendering();
	}).catch(function () {
		return null; // as placeNote: a sound that will not render is left out
	});
}

// Render frames [from, from + count) of the tune into a new stereo buffer.
function renderFrames(index, from, count, volumeMultiplier) {
	var sampleRate = index.sampleRate;
	var length = Math.max(1, count);
	var out = activeAudioContext().createBuffer(2, length, sampleRate);
	if (count <= 0 || from >= index.totalFrames) return Promise.resolve(out);
	var touching = index.keys.filter(function (e) {
		for (var i = 0; i < e.starts.length; i++) {
			var s = e.starts[i];
			if (s < from + count && s + e.frames > from) return true;
		}
		return false;
	});
	var rendered = new Array(touching.length);
	var next = 0;
	function worker() {
		if (next >= touching.length) return Promise.resolve();
		var i = next++;
		return renderSound(touching[i], sampleRate, index.fadeSec, volumeMultiplier).then(function (buffer) {
			rendered[i] = buffer;
			return worker();
		});
	}
	var workers = [];
	for (var w = 0; w < Math.min(CONCURRENT, touching.length); w++) workers.push(worker());
	return Promise.all(workers).then(function () {
		// In key order, clipped at both ends of the window and at the tune's end.
		var end = Math.min(from + count, index.totalFrames);
		for (var t = 0; t < touching.length; t++) {
			var buffer = rendered[t];
			if (!buffer) continue;
			var starts = touching[t].starts;
			for (var ch = 0; ch < 2; ch++) {
				var src = buffer.getChannelData(ch);
				var dst = out.getChannelData(ch);
				for (var k = 0; k < starts.length; k++) {
					var start = starts[k];
					var a = Math.max(from, start);
					var b = Math.min(end, start + src.length);
					for (var n = a; n < b; n++) dst[n - from] += src[n - start];
				}
			}
		}
		return out;
	});
}

module.exports = { buildIndex: buildIndex, renderFrames: renderFrames };
