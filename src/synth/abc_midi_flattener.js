//    abc_midi_flattener.js: Turn a linear series of events into a series of MIDI commands.

// We input a set of voices, but the notes are still complex. This pass changes the logical definitions
// of the grace notes, decorations, ties, triplets, rests, transpositions, keys, and accidentals into actual note durations.
// It also extracts guitar chords to a separate voice and resolves their rhythm.

var flatten;
var ChordTrack = require("./chord-track");
var pitchesToPerc = require('./pitches-to-perc');

(function() {
	"use strict";

	var barAccidentals;
	var accidentals;
	var transpose;
	var bagpipes;
	var graceStyle;
	var graceMaxMs;
	var graceMaxFraction;
	var graceDivider;
	var tracks;
	var startingTempo;
	var startingMeter;
	var tempoChangeFactor = 1;
	var instrument;
	var currentInstrument;
	// var channel;
	var currentTrack;
	var lastNoteDurationPosition;
	var currentTrackName;
	var lastEventTime;
	var chordTrack;

	var meter = { num: 4, den: 4 };
	var drumInstrument = 128;
	var lastBarTime;
	var doBeatAccents = true;
	var stressBeat1 = 105;
	var stressBeatDown = 95;
	var stressBeatUp = 85;
	var volumesPerNotePitch = [[stressBeat1, stressBeatDown, stressBeatUp]];
	var beatFraction = 0.25;
	var nextVolume;
	var nextVolumeDelta;
	var slurCount = 0;

	var drumTrack;
	var drumTrackFinished;
	var drumDefinition = {};
	var drumBars;

	var pickupLength = 0;
	var percmap;

	// The gaps per beat. The first two are in seconds, the third is in fraction of a duration.
	var normalBreakBetweenNotes = 0; //0.000520833333325*1.5; // for articulation (matches muse score value)
	var slurredBreakBetweenNotes = -0.001; // make the slurred notes actually overlap
	// How long is a grace note? The programs disagree, so this is a choice, not a fact.
	//
	//   'legacy' - the group takes half the note it decorates. This is what abcjs has
	//              always done, and it is the correct classical reading of an *unslashed*
	//              grace note (an appoggiatura). Applied to every grace note, though, it
	//              makes an Irish cut exactly as long as the melody note it decorates.
	//   'cut'    - min(half the note, graceMaxMs). MuseScore's acciaccatura rule. The
	//              millisecond ceiling is the part that matters: it is what keeps an
	//              ornament ornamental at any tempo and any note length.
	//   'unit'   - each grace keeps its own written value divided by graceDivider, with no
	//              reference to the note it decorates. This is abc2midi's %%MIDI
	//              gracedivider, which divides the L: unit length. abcjs normalises a
	//              written grace to an eighth-note basis, so divider 4 yields a 32nd --
	//              identical to abc2midi when L:1/8, and off by the L: ratio otherwise.
	//
	// A grace the source marked as an acciaccatura ({/a}) always uses 'cut' whatever the
	// default is: the notation has already said what it wants.
	var DEFAULT_GRACE_STYLE = 'cut';
	var DEFAULT_GRACE_MAX_MS = 65;   // MuseScore's acciaccatura ceiling
	// ...and a fraction cap as well, which MuseScore does not have.
	//
	// MEASURED, for a graced eighth, with the ms ceiling alone:
	//
	//   Q:1/4=60   eighth 500ms   grace 65ms   13%
	//   Q:1/4=120  eighth 250ms   grace 65ms   26%
	//   Q:1/2=100  eighth 150ms   grace 65ms   43%   <- reel tempo
	//   Q:1/4=240  eighth 125ms   grace 63ms   50%   <- same as legacy
	//
	// A fixed millisecond ceiling stops being a ceiling once the note is short
	// enough, and at the tempos this is used at -- reels and jigs -- it lets the
	// ornament take nearly half the note again, which is the complaint it was
	// meant to answer. The two caps together hold at 25% where the tempo is
	// quick and at 65ms where it is slow, and neither is ever exceeded.
	var DEFAULT_GRACE_MAX_FRACTION = 1/4;
	var DEFAULT_GRACE_DIVIDER = 4;   // only consulted by 'unit'

	var staccatoBreakBetweenNotes = 0.4; // some people say staccato is half duration, some say 3/4 so this splits it

	flatten = function(voices, options, percmap_, midiOptions) {
		if (!options) options = {};
		if (!midiOptions) midiOptions = {};
		barAccidentals = [];
		accidentals = [0,0,0,0,0,0,0];
		bagpipes = false;
		graceStyle = options.graceStyle || DEFAULT_GRACE_STYLE;
		graceMaxMs = options.graceMaxMs !== undefined ? options.graceMaxMs : DEFAULT_GRACE_MAX_MS;
		graceMaxFraction = options.graceMaxFraction !== undefined ? options.graceMaxFraction : DEFAULT_GRACE_MAX_FRACTION;
		graceDivider = DEFAULT_GRACE_DIVIDER;
		tracks = [];
		startingTempo = options.qpm;
		startingMeter = undefined;
		tempoChangeFactor = 1;
		instrument = undefined;
		currentInstrument = undefined;
		// channel = undefined;
		currentTrack = undefined;
		currentTrackName = undefined;
		lastEventTime = 0;
		percmap = percmap_;

		meter = { num: 4, den: 4 };

		doBeatAccents = true;
		stressBeat1 = 105;
		stressBeatDown = 95;
		stressBeatUp = 85;
		volumesPerNotePitch = [];
		beatFraction = 0.25;
		nextVolume = undefined;
		nextVolumeDelta = undefined;
		slurCount = 0;

		// For the drum/metronome track.
		drumTrack = [];
		drumTrackFinished = false;
		drumDefinition = {};
		drumBars = 1;

		if (voices.length > 0 && voices[0].length > 0)
			pickupLength = voices[0][0].pickupLength;

		// For resolving chords.
		if (options.bassprog !== undefined && !midiOptions.bassprog)
			midiOptions.bassprog = [options.bassprog]
		if (options.bassvol !== undefined && !midiOptions.bassvol)
			midiOptions.bassvol = [options.bassvol]
		if (options.chordprog !== undefined && !midiOptions.chordprog)
			midiOptions.chordprog = [options.chordprog]
		if (options.chordvol !== undefined && !midiOptions.chordvol)
			midiOptions.chordvol = [options.chordvol]
		if (options.gchord !== undefined && !midiOptions.gchord)
			midiOptions.gchord = [options.gchord]
		chordTrack = new ChordTrack(voices.length, options.chordsOff, midiOptions, meter)

		// First adjust the input to resolve ties, set the starting time for each note, etc. That will make the rest of the logic easier
		preProcess(voices, options);

		for (var i = 0; i < voices.length; i++) {
			transpose = 0;
			chordTrack.setTranspose(transpose)
			lastNoteDurationPosition = -1;
			var voice = voices[i];
			currentTrack = [{ cmd: 'program', channel: i, instrument: instrument }];
			currentTrackName = undefined;
			lastBarTime = 0;
			chordTrack.setLastBarTime(0)
			var voiceOff = false;
			if (options.voicesOff === true)
				voiceOff = true;
			else if (options.voicesOff && options.voicesOff.length && options.voicesOff.indexOf(i) >= 0)
				voiceOff = true;
			for (var j = 0; j < voice.length; j++) {
				var element = voice[j];
				switch (element.el_type) {
					case "name":
						currentTrackName = {cmd: 'text', type: "name", text: element.trackName };
						break;
					case "note":
						writeNote(element, voiceOff);
						break;
					case "key":
						accidentals = setKeySignature(element);
						break;
					case "meter":
						if (!startingMeter)
							startingMeter = element;
						meter = element;
						chordTrack.setMeter(meter)
						beatFraction = getBeatFraction(meter);
						alignDrumToMeter();
						break;
					case "tempo":
						if (!startingTempo)
							startingTempo = element.qpm;
						else
							tempoChangeFactor = element.qpm ? startingTempo / element.qpm : 1;
						chordTrack.setTempoChangeFactor(tempoChangeFactor)
						break;
					case "transpose":
						transpose = element.transpose;
						chordTrack.setTranspose(transpose)
						break;
					case "bar":
						chordTrack.barEnd(element)

						barAccidentals = [];
						if (i === 0) // Only write the drum part on the first voice so that it is not duplicated.
							writeDrum(voices.length+1);
							chordTrack.setRhythmHead(false) // decide whether there are rhythm heads each measure.
						lastBarTime = timeToRealTime(element.time);
						chordTrack.setLastBarTime(lastBarTime)
						break;
					case "bagpipes":
						bagpipes = true;
						break;
					case "gracedivider":
						// abc2midi's directive, so it selects abc2midi's rule too.
						if (element.value > 0) {
							graceDivider = element.value;
							graceStyle = 'unit';
						}
						break;
					case "instrument":
						if (instrument === undefined)
							instrument = element.program;
						currentInstrument = element.program;
						if (currentTrack.length > 0 && currentTrack[currentTrack.length-1].cmd === 'program')
							currentTrack[currentTrack.length-1].instrument = element.program;
						else {
							var ii;
							for (ii = currentTrack.length-1; ii >= 0 && currentTrack[ii].cmd !== 'program'; ii--)
								;
							if (ii < 0 || currentTrack[ii].instrument !== element.program)
								currentTrack.push({cmd: 'program', channel: 0, instrument: element.program});
						}
						break;
					case "channel":
						setChannel(element.channel);
						break;
					case "drum":
						drumDefinition = normalizeDrumDefinition(element.params);
						alignDrumToMeter();
						break;
					case "gchordOn":
						chordTrack.gChordOn(element)
						break;
					case "beat":
						stressBeat1 = element.beats[0];
						stressBeatDown = element.beats[1];
						stressBeatUp = element.beats[2];
						if (!element.volumesPerNotePitch)
							volumesPerNotePitch = []
						else
							volumesPerNotePitch = element.volumesPerNotePitch;
						// TODO-PER: also use the last parameter - which changes which beats are strong.
						break;
					case "vol":
						nextVolume = element.volume;
						break;
					case "volinc":
						nextVolumeDelta = element.volume;
						break;
					case "beataccents":
						doBeatAccents = element.value;
						break;
					case "gchord":
					case "bassprog":
					case "chordprog":
					case "bassvol":
					case "chordvol":
					case "gchordbars":
						chordTrack.paramChange(element)
						break
					default:
						// This should never happen
						console.log("MIDI creation. Unknown el_type: " + element.el_type + "\n");
						break;
				}
			}
			if (currentTrack[0].instrument === undefined)
				currentTrack[0].instrument = instrument ? instrument : 0;
			if (currentTrackName)
				currentTrack.unshift(currentTrackName);
			tracks.push(currentTrack);
			chordTrack.finish()
			if (drumTrack.length > 0) // Don't do drums on more than one track, so turn off drum after we create it.
				drumTrackFinished = true;
		}
		// See if any notes are octaves played at the same time. If so, raise the pitch of the higher one.
		if (options.detuneOctave)
			findOctaves(tracks, parseInt(options.detuneOctave, 10));

		chordTrack.addTrack(tracks)
		if (drumTrack.length > 0)
			tracks.push(drumTrack);

		return { tempo: startingTempo, instrument: instrument, tracks: tracks, totalDuration: lastEventTime };
	};

	function setChannel(channel) {
		for (var i = currentTrack.length-1; i>=0; i--) {
			if (currentTrack[i].cmd === "program") {
				currentTrack[i].channel = channel;
				return;
			}
		}
	}

	function timeToRealTime(time) {
		return time/1000000;
	}

	function durationRounded(duration) {
		return Math.round(duration*tempoChangeFactor*1000000)/1000000;
	}

	function preProcess(voices, options) {
		for (var i = 0; i < voices.length; i++) {
			var voice = voices[i];
			var ties = {};
			var startingTempo = options.qpm;
			var timeCounter = 0;
			var tempoMultiplier = 1;
			for (var j = 0; j < voice.length; j++) {
				var element = voice[j];

				if (element.el_type === 'tempo') {
					if (!startingTempo)
						startingTempo = element.qpm;
					else
						tempoMultiplier = element.qpm ? startingTempo / element.qpm : 1;
					continue;
				}

				// For convenience, put the current time in each event so that it doesn't have to be calculated in the complicated stuff that follows.
				element.time = timeCounter;
				var thisDuration = element.duration ? element.duration : 0;
				timeCounter += Math.round(thisDuration*tempoMultiplier*1000000); // To compensate for JS rounding problems, do all intermediate calcs on integers.

				// If there are pitches then put the duration in the pitch object and if there are ties then change the duration of the first note in the tie.
				if (element.pitches) {
					for (var k = 0; k < element.pitches.length; k++) {
						var pitch = element.pitches[k];
						if (pitch) {
							pitch.duration = element.duration;
							if (pitch.startTie) {
								//console.log(element)
								if (ties[pitch.pitch] === undefined) // We might have three notes tied together - if so just add this duration.
									ties[pitch.pitch] = {el: j, pitch: k};
								else {
									voice[ties[pitch.pitch].el].pitches[ties[pitch.pitch].pitch].duration += pitch.duration;
									element.pitches[k] = null;
								}
								//console.log(">>> START", JSON.stringify(ties));
							} else if (pitch.endTie) {
								//console.log(element)
								var tie = ties[pitch.pitch];
								//console.log(">>> END", pitch.pitch, tie, JSON.stringify(ties));
								if (tie) {
									var dur = pitch.duration;
									delete voice[tie.el].pitches[tie.pitch].startTie;
									voice[tie.el].pitches[tie.pitch].duration += dur;
									element.pitches[k] = null;
									delete ties[pitch.pitch];
								} else {
									delete pitch.endTie;
								}
							}
						}
					}
					delete element.duration;
				}
			}
			for (var key in ties) {
				if (ties.hasOwnProperty(key)) {
					var item = ties[key];
					delete voice[item.el].pitches[item.pitch].startTie;
				}
			}
			// voices[0].forEach(v => delete v.elem)
			// voices[1].forEach(v => delete v.elem)
			// console.log(JSON.stringify(voices))
		}
	}

	function getBeatFraction(meter) {
		switch (parseInt(meter.den,10)) {
			case 2: return 0.5;
			case 4: return 0.25;
			case 8:
				if (meter.num % 3 === 0)
					return 0.375;
				else
					return 0.125;
			case 16: return 0.125;
		}
		return 0.25;
	}

	function calcBeat(measureStart, beatLength, currTime) {
		var distanceFromStart = currTime - measureStart;
		return distanceFromStart / beatLength;
	}

	function processVolume(beat, voiceOff, pitchIndexOfNote) {
		if (voiceOff)
			return 0;
		let pitchStressBeat1 = stressBeat1;
		let pitchStressBeatDown = stressBeatDown;
		let pitchStressBeatUp = stressBeatUp;
		if(pitchIndexOfNote !== undefined && volumesPerNotePitch.length >= pitchIndexOfNote+1){
			pitchStressBeat1 = volumesPerNotePitch[pitchIndexOfNote][0];
			pitchStressBeatDown = volumesPerNotePitch[pitchIndexOfNote][1];
			pitchStressBeatUp = volumesPerNotePitch[pitchIndexOfNote][2];
		}
		var volume;
    	// MAE 21 Jun 2024 - This previously wasn't allowing zero volume to be applied
		if (nextVolume !== undefined) {
			volume = nextVolume;
			nextVolume = undefined;
		} else if (!doBeatAccents) {
			volume = pitchStressBeatDown;
		} else if (pickupLength > beat) {
			volume = pitchStressBeatUp;
		} else {
			//var barLength = meter.num / meter.den;
			var barBeat = calcBeat(lastBarTime, getBeatFraction(meter), beat);
			if (barBeat === 0)
				volume = pitchStressBeat1;
			else if (parseInt(barBeat,10) === barBeat)
				volume = pitchStressBeatDown;
			else
				volume = pitchStressBeatUp;
		}
		if (nextVolumeDelta) {
			volume += nextVolumeDelta;
			nextVolumeDelta = undefined;
		}
		if (volume < 0)
			volume = 0;
		if (volume > 127)
			volume = 127;
		return voiceOff ? 0 : volume;
	}


	function findNoteModifications(elem, velocity) {
		var ret = { };
		if (elem.decoration) {
			for (var d = 0; d < elem.decoration.length; d++) {
				if (elem.decoration[d] === 'staccato')
					ret.thisBreakBetweenNotes = 'staccato';
				else if (elem.decoration[d] === 'tenuto')
					ret.thisBreakBetweenNotes = 'tenuto';
				else if (elem.decoration[d] === 'accent')
					ret.velocity = Math.min(127, velocity * 1.5);
				else if (elem.decoration[d] === 'trill')
					ret.noteModification = "trill";
				else if (elem.decoration[d] === 'lowermordent')
					ret.noteModification = "lowermordent";
				else if (elem.decoration[d] === 'uppermordent')
					ret.noteModification = "pralltriller";
				else if (elem.decoration[d] === 'mordent')
					ret.noteModification = "mordent";
				else if (elem.decoration[d] === 'turn')
					ret.noteModification = "turn";
				else if (elem.decoration[d] === 'roll')
					ret.noteModification = "roll";
				else if (elem.decoration[d] === 'pralltriller')
					ret.noteModification = "pralltriller";
				else if (elem.decoration[d] === 'trillh') 
					ret.noteModification = "trillh";
			}
		}
		return ret;
	}

	function doModifiedNotes(noteModification, p) {
		var noteTime;
		var numNotes;
		var start = p.start;
		var pp;
		var runningDuration = p.duration;
		var shortestNote = durationRounded(1.0 / 32);

		switch (noteModification) {
			case "trill":
				var note = 2;
				while (runningDuration > 0) {
					currentTrack.push({ cmd: 'note', pitch: p.pitch+note, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: currentInstrument, style: 'decoration' });
					note = (note === 2) ? 0 : 2;
					runningDuration -= shortestNote;
					start += shortestNote;
				}
				break;
		      case "trillh":
			        var note = 1;
			        while (runningDuration > 0) {
			          currentTrack.push({
			            cmd: 'note',
			            pitch: p.pitch + note,
			            volume: p.volume,
			            start: start,
			            duration: shortestNote,
			            gap: 0,
			            instrument: currentInstrument,
			            style: 'decoration'
			          });
			          note = note === 1 ? 0 : 1;
			          runningDuration -= shortestNote;
			          start += shortestNote;
			        }
			        break;
			case "pralltriller":
				currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: currentInstrument, style: 'decoration' });
				runningDuration -= shortestNote;
				start += shortestNote;
				currentTrack.push({ cmd: 'note', pitch: p.pitch+2, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: currentInstrument, style: 'decoration' });
				runningDuration -= shortestNote;
				start += shortestNote;
				currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start, duration: runningDuration, gap: 0, instrument: currentInstrument });
				break;
			case "mordent":
			case "lowermordent":
				currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: currentInstrument, style: 'decoration' });
				runningDuration -= shortestNote;
				start += shortestNote;
				currentTrack.push({ cmd: 'note', pitch: p.pitch-2, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: currentInstrument, style: 'decoration' });
				runningDuration -= shortestNote;
				start += shortestNote;
				currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start, duration: runningDuration, gap: 0, instrument: currentInstrument });
				break;
			case "turn":
				shortestNote = p.duration / 4;
				currentTrack.push({ cmd: 'note', pitch: p.pitch+2, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: currentInstrument, style: 'decoration' });
				currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start+shortestNote, duration: shortestNote, gap: 0, instrument: currentInstrument, style: 'decoration' });
				currentTrack.push({ cmd: 'note', pitch: p.pitch-1, volume: p.volume, start: start+shortestNote*2, duration: shortestNote, gap: 0, instrument: currentInstrument, style: 'decoration' });
				currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start+shortestNote*3, duration: shortestNote, gap: 0, instrument: currentInstrument, style: 'decoration' });
				break;
			case "roll":
				while (runningDuration > 0) {
					currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: currentInstrument, style: 'decoration' });
					runningDuration -= shortestNote*2;
					start += shortestNote*2;
				}
				break;
		}
	}

	function writeNote(elem, voiceOff) {
		//
		// Create a series of note events to append to the current track.
		// The output event is one of: { pitchStart: pitch_in_abc_units, volume: from_1_to_64 }
		// { pitchStop: pitch_in_abc_units }
		// { moveTime: duration_in_abc_units }
		// If there are guitar chords, then they are put in a separate track, but they have the same format.
		//

		//var trackStartingIndex = currentTrack.length;

		var velocity = processVolume(timeToRealTime(elem.time), voiceOff);
		chordTrack.processChord(elem)

		// if there are grace notes, then also play them.
		// I'm not sure there is an exact rule for the length of the notes. My rule, unless I find
		// a better one is: the grace notes cannot take more than 1/2 of the main note's value.
		// A grace note (of 1/8 note duration) takes 1/8 of the main note's value.
		var graces;
		if (elem.gracenotes && elem.pitches && elem.pitches.length > 0 && elem.pitches[0]) {
			graces = processGraceNotes(elem.gracenotes, elem.pitches[0].duration);
			if (elem.elem)
				elem.elem.midiGraceNotePitches = writeGraceNotes(graces, timeToRealTime(elem.time), velocity*2/3, currentInstrument); // make the graces a little quieter.
		}

		// The beat fraction is the note that gets a beat (.25 is a quarter note)
		// The tempo is in minutes and we want to get to milliseconds.
		// If the element is inside a repeat, there may be more than one value. If there is one value,
		// then just store that as a number. If there are more than one value, then change that to
		// an array and return all of them.
		if (elem.elem) {
			var rt = timeToRealTime(elem.time);
			var ms = rt / beatFraction / startingTempo * 60 * 1000;
			if (elem.elem.currentTrackMilliseconds === undefined) {
				elem.elem.currentTrackMilliseconds = ms;
				elem.elem.currentTrackWholeNotes = rt;
			} else {
				if (elem.elem.currentTrackMilliseconds.length === undefined) {
					if (elem.elem.currentTrackMilliseconds !== ms) {
						elem.elem.currentTrackMilliseconds = [elem.elem.currentTrackMilliseconds, ms];
						elem.elem.currentTrackWholeNotes = [elem.elem.currentTrackWholeNotes, rt];
					}
				} else {
					// There can be duplicates if there are multiple voices
					var found = false;
					for (var j = 0; j < elem.elem.currentTrackMilliseconds.length; j++) {
						if (elem.elem.currentTrackMilliseconds[j] === ms)
							found = true;
					}
					if (!found) {
						elem.elem.currentTrackMilliseconds.push(ms);
						elem.elem.currentTrackWholeNotes.push(rt);
					}
				}
			}
		}
		//var tieAdjustment = 0;
		if (elem.pitches) {
			var thisBreakBetweenNotes = '';
			var ret = findNoteModifications(elem, velocity);
			if (ret.thisBreakBetweenNotes)
				thisBreakBetweenNotes = ret.thisBreakBetweenNotes;
			if (ret.velocity)
				velocity = ret.velocity;

			// TODO-PER: Can also make a different sound on style=x and style=harmonic
			var ePitches = elem.pitches;
			if (elem.style === "rhythm") {
				ePitches = chordTrack.setRhythmHead(true, elem)
			}

			if (elem.elem)
				elem.elem.midiPitches = [];
			for (var i=0; i<ePitches.length; i++) {
				//here we can set the volume for each note in a chord, if specified
				let pitchVelocity = velocity;
				if(!ret.velocity && Array.isArray(elem.decoration) && elem.decoration.length > i){
					pitchVelocity = processVolume(timeToRealTime(elem.time), voiceOff, i)
				}
				var note = ePitches[i];
				if (!note)
					continue;
				if (note.startSlur)
					slurCount += note.startSlur.length;
				if (note.endSlur)
					slurCount -= note.endSlur.length;
				var actualPitch = note.actualPitch ? note.actualPitch : adjustPitch(note);
				if (currentInstrument === drumInstrument && percmap) {
					var name = pitchesToPerc(note)
					if (name && percmap[name])
						actualPitch = percmap[name].sound;
				}
				var p = { cmd: 'note', pitch: actualPitch, volume: pitchVelocity, start: timeToRealTime(elem.time), duration: durationRounded(note.duration), instrument: currentInstrument, startChar: elem.elem.startChar, endChar: elem.elem.endChar};
				p = adjustForMicroTone(p);
				if (graces && graces.length) {
					// Borrow exactly the time the graces actually consumed, rather than assuming half.
					var graceTotal = 0;
					for (var gi = 0; gi < graces.length; gi++)
						graceTotal += graces[gi].duration;
					p.duration = Math.max(p.duration - graceTotal, 0);
					p.start = p.start + graceTotal;
				}
				if (elem.elem)
					elem.elem.midiPitches.push(p);
				if (ret.noteModification) {
					doModifiedNotes(ret.noteModification, p);
				} else {
					if (slurCount > 0)
						p.endType = 'tenuto';
					else if (thisBreakBetweenNotes)
						p.endType = thisBreakBetweenNotes;

					switch (p.endType) {
						case "tenuto":
							p.gap = slurredBreakBetweenNotes;
							break;
						case "staccato":
							var d = p.duration * staccatoBreakBetweenNotes;
							p.gap = startingTempo / 60 * d;
							break;
						default:
							p.gap = normalBreakBetweenNotes;
							break;
					}
					currentTrack.push(p);
				}
			}
			lastNoteDurationPosition = currentTrack.length-1;

		}
		var realDur = getRealDuration(elem);
		lastEventTime = Math.max(lastEventTime, timeToRealTime(elem.time)+durationRounded(realDur));
	}
	function getRealDuration(elem) {
		if (elem.pitches && elem.pitches.length > 0 && elem.pitches[0])
			return elem.pitches[0].duration;
		if (elem.elem)
			return elem.elem.duration;
		return elem.duration;
	}

	var scale = [0,2,4,5,7,9,11];
	function adjustPitch(note) {
		if (note.midipitch !== undefined)
			return note.midipitch; // The pitch might already be known, for instance if there is a drummap.
		var pitch = note.pitch;
		if (note.accidental) {
			switch(note.accidental) { // change that pitch (not other octaves) for the rest of the bar
				case "sharp":
					barAccidentals[pitch]=1; break;
				case "flat":
					barAccidentals[pitch]=-1; break;
				case "natural":
					barAccidentals[pitch]=0; break;
				case "dblsharp":
					barAccidentals[pitch]=2; break;
				case "dblflat":
					barAccidentals[pitch]=-2; break;
				case "quartersharp":
					barAccidentals[pitch]=0.25; break;
				case "quarterflat":
					barAccidentals[pitch]=-0.25; break;
			}
		}

		var actualPitch = extractOctave(pitch) *12 + scale[extractNote(pitch)] + 60;

		if ( barAccidentals[pitch]!==undefined) {
			// An accidental is always taken at face value and supersedes the key signature.
			actualPitch += barAccidentals[pitch];
		} else { // use normal accidentals
			actualPitch +=  accidentals[extractNote(pitch)];
		}
		actualPitch += transpose;
		return actualPitch;
	}

	function setKeySignature(elem) {
		var accidentals = [0,0,0,0,0,0,0];
		if (!elem.accidentals) return accidentals;
		for (var i = 0; i < elem.accidentals.length; i++) {
			var acc = elem.accidentals[i];
			var d;
			switch (acc.acc) {
				case "flat": d = -1; break;
				case "quarterflat": d = -0.25; break;
				case "sharp": d = 1; break;
				case "quartersharp": d = 0.25; break;
				default: d = 0; break;
			}

			var lowercase = acc.note.toLowerCase();
			var note = extractNote(lowercase.charCodeAt(0)-'c'.charCodeAt(0));
			accidentals[note]+=d;
		}
		return accidentals;
	}

	// Whole notes occupying the given wall-clock milliseconds at the starting tempo.
	// Same conversion the currentTrackMilliseconds bookkeeping uses, read backwards.
	function msToWholeNotes(ms) {
		if (!startingTempo || !beatFraction) return Infinity;
		return ms * beatFraction * startingTempo / 60000;
	}

	function processGraceNotes(graces, companionDuration) {
		var graceDuration = 0;
		var ret = [];
		var grace;
		var isAcciaccatura = false;
		for (var g = 0; g < graces.length; g++) {
			grace = graces[g];
			graceDuration += grace.duration;
			if (grace.acciaccatura)
				isAcciaccatura = true;
		}
		if (graceDuration <= 0)
			return ret;

		// Whatever the rule, an ornament never takes more than half of what it
		// decorates -- past that it stops ornamenting and starts replacing.
		var ceiling = companionDuration / 2;
		var style = isAcciaccatura ? 'cut' : graceStyle;
		var total;
		if (style === 'unit')
			total = graceDuration / graceDivider;
		else if (style === 'cut')
			// Both caps: the fraction is what binds at speed, the milliseconds
			// are what bind when the note is long. See the table above.
			total = Math.min(companionDuration * graceMaxFraction, msToWholeNotes(graceMaxMs));
		else
			total = ceiling;
		if (total > ceiling)
			total = ceiling;

		// The group gets `total`; the written lengths only set the split within it.
		var multiplier = total / graceDuration;

		for (g = 0; g < graces.length; g++) {
			grace = graces[g];
			var actualPitch = adjustPitch(grace);
			if (currentInstrument === drumInstrument && percmap) {
				var name = pitchesToPerc(grace)
				if (name && percmap[name])
					actualPitch = percmap[name].sound;
			}
			var pitch = { pitch: actualPitch, duration: grace.duration*multiplier };
			pitch = adjustForMicroTone(pitch);
			ret.push(pitch);
		}
		return ret;
	}

	function writeGraceNotes(graces, start, velocity, currentInstrument) {
		var midiGrace = [];
		velocity = Math.round(velocity)
		for (var g = 0; g < graces.length; g++) {
			var gp = graces[g];
			currentTrack.push({cmd: 'note', pitch: gp.pitch, volume: velocity, start: start, duration: gp.duration, gap: 0, instrument:currentInstrument, style: 'grace'});
			midiGrace.push({
				pitch: gp.pitch,
				durationInMeasures: gp.duration,
				volume: velocity,
				instrument: currentInstrument
			});
			start += gp.duration;
		}
		return midiGrace;
	}

	var quarterToneFactor = 0.02930223664349;
	function adjustForMicroTone(description) {
		// if the pitch is not a whole number then make it a whole number and add a tuning factor
		var pitch = ''+description.pitch;
		if (pitch.indexOf(".75") >= 0) {
			description.pitch = Math.round(description.pitch);
			description.cents = -50;
		} else if (pitch.indexOf(".25") >= 0) {
			description.pitch = Math.round(description.pitch);
			description.cents = 50;
		}

		return description;
	}

	function extractOctave(pitch) {
		return Math.floor(pitch/7);
	}

	function extractNote(pitch) {
		pitch = pitch%7;
		if (pitch<0) pitch+=7;
		return pitch;
	}


	function normalizeDrumDefinition(params) {
		// Be very strict with the drum definition. If anything is not perfect,
		// just turn the drums off.
		// Perhaps all of this logic belongs in the parser instead.
		if (params.pattern.length === 0 || params.on === false)
			return { on: false };

		var str = params.pattern[0];
		var events = [];
		var event = "";
		var totalPlay = 0;
		for (var i = 0; i < str.length; i++) {
			if (str[i] === 'd')
				totalPlay++;
			if (str[i] === 'd' || str[i] === 'z') {
				if (event.length !== 0) {
					events.push(event);
					event = str[i];
				} else
					event = event + str[i];
			} else {
				if (event.length === 0) {
					// there was an error: the string should have started with d or z
					return {on: false};
				}
				event = event + str[i];
			}
		}

		if (event.length !== 0)
			events.push(event);

		// Now the events array should have one item per event.
		// There should be two more params for each event: the volume and the pitch.
		if (params.pattern.length !== totalPlay*2 + 1)
			return { on: false };

		var ret = { on: true, bars: params.bars, pattern: []};
		var beatLength = getBeatFraction(meter);
		var playCount = 0;
		for (var j = 0; j < events.length; j++) {
			event = events[j];
			var len = 1;
			var div = false;
			var num = 0;
			for (var k = 1; k < event.length; k++) {
				switch(event[k]) {
					case "/":
						if (num !== 0)
							len *= num;
						num = 0;
						div = true;
						break;
					case "1":
					case "2":
					case "3":
					case "4":
					case "5":
					case "6":
					case "7":
					case "8":
					case "9":
						num = num*10 +event[k];
						break;
					default:
						return { on: false };
				}
			}
			if (div) {
				if (num === 0) num = 2; // a slash by itself is interpreted as "/2"
				len /= num;
			} else if (num)
				len *= num;
			if (event[0] === 'd') {
				ret.pattern.push({ len: len * beatLength, pitch: params.pattern[1 + playCount], velocity: params.pattern[1 + playCount + totalPlay]});
				playCount++;
			} else
				ret.pattern.push({ len: len * beatLength, pitch: null});
		}
		drumBars = params.bars ? params.bars : 1;
		return ret;
	}

	function alignDrumToMeter() {
		if (!drumDefinition ||!drumDefinition.pattern) {
			return;
		}
		var ret = drumDefinition;
		// Now normalize the pattern to cover the correct number of measures. The note lengths passed are relative to each other and need to be scaled to fit a measure.
		var totalTime = 0;
		var measuresPerBeat = meter.num/meter.den;
		for (var ii = 0; ii < ret.pattern.length; ii++)
			totalTime += ret.pattern[ii].len;
		var factor = totalTime /  drumBars / measuresPerBeat;
		for (ii = 0; ii < ret.pattern.length; ii++)
			ret.pattern[ii].len = ret.pattern[ii].len / factor;
		drumDefinition = ret;
	}

	function writeDrum(channel) {
		if (drumTrack.length === 0 && !drumDefinition.on)
			return;

		var measureLen = meter.num/meter.den;
		if (drumTrack.length === 0) {
			if (lastEventTime < measureLen)
				return; // This is true if there are pickup notes. The drum doesn't start until the first full measure.
			drumTrack.push({cmd: 'program', channel: channel, instrument: drumInstrument});
		}

		if (!drumDefinition.on) {
			// this is the case where there has been a drum track, but it was specifically turned off.
			return;
		}
		var start = lastBarTime;
		for (var i = 0; i < drumDefinition.pattern.length; i++) {
			var len = durationRounded(drumDefinition.pattern[i].len);
			if (drumDefinition.pattern[i].pitch) {
				drumTrack.push({
					cmd: 'note',
					pitch: drumDefinition.pattern[i].pitch,
					volume: drumDefinition.pattern[i].velocity,
					start: start,
					duration: len,
					gap: 0,
					instrument: drumInstrument});
			}
			start += len;
		}
	}

	function findOctaves(tracks, detuneCents) {
		var timing = {};
		for (var i = 0; i < tracks.length; i++) {
			for (var j = 0; j < tracks[i].length; j++) {
				var note = tracks[i][j];
				if (note.cmd === "note") {
					if (timing[note.start] === undefined)
						timing[note.start] = [];
					timing[note.start].push({track: i, event: j, pitch: note.pitch});
				}
			}
		}
		var keys = Object.keys(timing);
		for (i = 0; i < keys.length; i++) {
			var arr = timing[keys[i]];
			if (arr.length > 1) {
				arr = arr.sort(function(a,b) {
					return a.pitch - b.pitch;
				});
				var topEvent = arr[arr.length-1];
				var topNote = topEvent.pitch % 12;
				var found = false;
				for (j = 0; !found && j < arr.length-1; j++) {
					if (arr[j].pitch % 12 === topNote)
						found = true;
				}
				if (found) {
					var event = tracks[topEvent.track][topEvent.event];
					if (!event.cents)
						event.cents = 0;
					event.cents += detuneCents;
				}
			}
		}
	}
})();

module.exports = flatten;
