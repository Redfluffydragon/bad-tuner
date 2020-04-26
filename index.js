/**
 * frequencies not correct for some notes in the middle ????
 */

'use strict'

//ask for microphone use
// navigator.mediaDevices.getUserMedia({ audio: true}).then(handleSuccess);

const frequencyDisplay = document.getElementById('frequencyDisplay');
const noteDisplay = document.getElementById('noteDisplay');
const noteLetter = document.getElementById('noteLetter');
const accidental = document.getElementById('accidental');
const octave = document.getElementById('octave');

const settings = document.getElementById('settings');
const openSettings = document.getElementById('openSettings');

const freqCheck = document.getElementById('freqCheck');

const adjustPrecision = document.getElementById('adjustPrecision');
const showPrecision = document.getElementById('showPrecision');

const adjustSensitivity = document.getElementById('adjustSensitivity');
const showSensitivity = document.getElementById('showSensitivity');

const notes = ['A', 'B&flat;', 'B', 'C', 'C&sharp;', 'D', 'E&flat;', 'E', 'F', 'F&sharp;', 'G', 'A&flat;'];

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
ctx.strokeStyle = 'black';
ctx.lineWidth = 5;

let analyser;

//for adjustment
let options = JSON.parse(localStorage.getItem('options')) || 
  {
    roundFreq: true,
    fftSize: 14,
    minDecibels: -60,
  };

freqCheck.checked = options.roundFreq;
adjustPrecision.value = options.fftSize;
showPrecision.value = Math.pow(2, options.fftSize);
adjustSensitivity.value = options.minDecibels*-1;
showSensitivity.value = options.minDecibels*-1;

document.body.style.setProperty('--settings-max-height', '35px'); //not sure why I need to do this, but it works

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
}, false);

window.addEventListener('beforeunload', () => {
  localStorage.setItem('options', JSON.stringify(options));
}, false);

document.addEventListener('click', e => {
  if (!e.target.closest('#settings')) {
    document.body.style.setProperty('--settings-max-height', '35px');
  }
}, false);

openSettings.addEventListener('click', () => {
  let settingsHeight = getComputedStyle(document.body).getPropertyValue('--settings-max-height') === '35px' ? '150px' : '35px';
  document.body.style.setProperty('--settings-max-height', settingsHeight);
}, false);

freqCheck.addEventListener('input', () => {
  options.roundFreq = freqCheck.checked;
}, false);

adjustPrecision.addEventListener('input', () => {
  showPrecision.value = Math.pow(2, adjustPrecision.value);
  options.fftSize = adjustPrecision.value;
  updateAnalyser();
}, false);

adjustSensitivity.addEventListener('input', () => {
  showSensitivity.value = adjustSensitivity.value;
  options.minDecibels = adjustSensitivity.value*-1;
  updateAnalyser();
}, false);

showSensitivity.addEventListener('input', () => {
  if (showSensitivity.value.length === 2) {
    showSensitivity.value = Math.max(parseInt(showSensitivity.value), 40);
  }
  else if (showSensitivity.value.length >= 3) {
    showSensitivity.value = Math.min(parseInt(showSensitivity.value), 100);
  }
  adjustSensitivity.value = showSensitivity.value;
  options.minDecibels = adjustSensitivity.value*-1;
  updateAnalyser();
}, false);

function handleSuccess(stream) {
  //get the audio context and create an analyser
  let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();

  //set some properties to better values for this
  updateAnalyser();

  //make an audio source and connect it to the analyser
  let source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);


  let bufferLength = analyser.frequencyBinCount;
  let soundArray = new Uint8Array(bufferLength); //make a Uint8Array to store the audio data
  function showFrequency() {
    requestAnimationFrame(showFrequency);
    analyser.getByteFrequencyData(soundArray);
    let frequency = soundArray.indexOf(Math.max(...soundArray))*audioCtx.sampleRate/analyser.fftSize; //get the loudest bin and map to Hz
    if (options.roundFreq) frequency = frequency.toFixed(1);
    if (frequency != 0.0) {
      frequencyDisplay.textContent = frequency + ' Hz';
      showNote(frequency);
      let showFineTune = fineTune(frequency);
      document.body.style.setProperty('--rotation', `${showFineTune*2*45}deg`); //pass to css variable
    }
  }
  showFrequency();
}

function updateAnalyser() {
  analyser.fftSize = Math.pow(2, options.fftSize); //adjust number of frequency bins (higher = more precision)
  analyser.minDecibels = options.minDecibels; //adjust lower decibel cutoff (sensitivity, basically) more negative = more sensitive
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