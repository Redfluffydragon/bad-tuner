/**
 * frequencies not correct for some notes in the middle ????
 */

'use strict'

const frequencyDisplay = document.getElementById('frequencyDisplay');
const noteDisplay = document.getElementById('noteDisplay');
const noteLetter = document.getElementById('noteLetter');
const accidental = document.getElementById('accidental');
const octave = document.getElementById('octave');

const fineTunePointer = document.getElementById('fineTunePointer');

const notes = ['A', 'B&flat;', 'B', 'C', 'C&sharp;', 'D', 'E&flat;', 'E', 'F', 'F&sharp;', 'G', 'A&flat;'];

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
ctx.strokeStyle = 'black';
ctx.lineWidth = 5;

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
}, false);

//for adjustment (later)
let options = {
  roundFreq: true,
  fftSize: 14,
  minDecibels: -60,
};

let roundFreq = true; //round the frequency to tenths or not

//ask for microphone use
navigator.mediaDevices.getUserMedia({ audio: true})
.then(handleSuccess);

function handleSuccess(stream) {
  //get the audio context and create an analyser
  let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let analyser = audioCtx.createAnalyser();

  //set some properties to better values for this
  analyser.fftSize = Math.pow(2, options.fftSize); //adjust number of frequency bins (higher = more precision)
  analyser.minDecibels = options.minDecibels; //adjust lower decibel cutoff (sensitivity, basically) more negative = more sensitive

  //make an audio source and connect it to the analyser
  let source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);


  let bufferLength = analyser.frequencyBinCount;
  let soundArray = new Uint8Array(bufferLength); //make a Uint8Array to store the audio data
  function showFrequency() {
    requestAnimationFrame(showFrequency);
    analyser.getByteFrequencyData(soundArray);
    let frequency = soundArray.indexOf(Math.max(...soundArray))*audioCtx.sampleRate/analyser.fftSize; //get the loudest bin and map to Hz
    if (roundFreq) frequency = frequency.toFixed(1);
    if (frequency != 0.0) {
      frequencyDisplay.textContent = frequency + ' Hz';
      showNote(frequency);
      let showFineTune = fineTune(frequency);
      document.body.style.setProperty('--rotation', `${showFineTune*2*45}deg`); //pass to css variable
    }
  }
  showFrequency();
}

function toSteps(frequency) {
    let f0 = 440; //use A4 as base
    let fRatio = frequency/f0; //ratio of the frequencies
    let lnA = 0.05776226504666215; //approximation of ln of 2^(1/12)
    let steps = Math.log(fRatio)/lnA; //take log base 2^(1/12) to find the number of half-steps away from A4
    return steps;
}

function showNote(frequency) {
  let steps = Math.round(toSteps(frequency)); //take ln to find the number of half-steps away from A4 - trunc? round?
  let fixSteps = steps < 0 ? notes.length + steps%notes.length - 1 : steps%notes.length;
  let tempNote = notes[fixSteps];
  noteLetter.textContent = tempNote.slice(0, 1);
  accidental.innerHTML = tempNote.slice(1);
  octave.textContent = Math.trunc(steps/notes.length)+4;
}

function fineTune(frequency) { //max value: ~0.49
  let steps = toSteps(frequency)
  return steps - Math.round(steps); //flat should be negative, and sharp should be positive
}