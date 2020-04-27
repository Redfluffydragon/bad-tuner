/**
 * frequencies not correct for some notes in the middle ????
 * when using defer, put the script at the bottom of the head - otherwise it block some css on ios webkit?????
 * gray is too dark or something on settings header
 */

'use strict'

//ask for microphone use
async function getMedia(constraints) {
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    handleSuccess(stream);
  } catch(err) {
    alert(err); //for mobile debugging
  }
}
getMedia({ audio: true });

const frequencyDisplay = document.getElementById('frequencyDisplay');
const noteDisplay = document.getElementById('noteDisplay');
const noteLetter = document.getElementById('noteLetter');
const accidental = document.getElementById('accidental');
const octave = document.getElementById('octave');

const settings = document.getElementById('settings');
const openSettings = document.getElementById('openSettings');
const settingsList = document.getElementById('settingsList');

const freqCheck = document.getElementById('freqCheck');

const adjustPrecision = document.getElementById('adjustPrecision');
const showPrecision = document.getElementById('showPrecision');

const adjustSensitivity = document.getElementById('adjustSensitivity');
const showSensitivity = document.getElementById('showSensitivity');

const notes = ['A', 'B&flat;', 'B', 'C', 'C&sharp;', 'D', 'E&flat;', 'E', 'F', 'F&sharp;', 'G', 'A&flat;'];

let isInWebApp = (window.navigator.standalone == true) || (window.matchMedia('(display-mode: standalone)').matches);

let analyser;

//for settings
let options = JSON.parse(localStorage.getItem('options')) || 
  {
    roundFreq: true,
    fftSize: 14,
    minDecibels: -60,
  };

const closedVals = {
  X: () => - settings.offsetWidth + openSettings.offsetWidth + 'px',
  Y: () => settings.offsetHeight - openSettings.offsetHeight - 20 + 'px', //-20 is for the weird extra height thing - should probably try css
};
let settingsOpen = false;

//move the settings div in either the x or y dimension depending on a css variable
let moveSettingsAxis = getComputedStyle(document.body).getPropertyValue('--settings-sideways') == 0 ? 'X' : 'Y';

window.addEventListener('load', () => {
  moveSettingsAxis = getComputedStyle(document.body).getPropertyValue('--settings-sideways') == 0 ? 'X' : 'Y';
  document.body.style.setProperty('--settings' + moveSettingsAxis, closedVals[moveSettingsAxis]());

  freqCheck.checked = options.roundFreq;
  
  adjustPrecision.value = options.fftSize;
  showPrecision.value = Math.pow(2, options.fftSize);

  adjustSensitivity.value = options.minDecibels*-1;
  showSensitivity.value = options.minDecibels*-1;
}, false);

window.addEventListener('beforeunload', () => {
  localStorage.setItem('options', JSON.stringify(options));
}, false);

window.addEventListener('resize', () => {
  moveSettingsAxis = getComputedStyle(document.body).getPropertyValue('--settings-sideways') == 0 ? 'X' : 'Y'; //make sure this is updated
  let resetAxis = moveSettingsAxis === 'X' ? 'Y' : 'X';
  document.body.style.setProperty('--settings'+ resetAxis, '-50%');
  moveSettings(true);
  if (isInWebApp) {
    window.setTimeout(() => {moveSettings(true)}, 50); //to get rid of like 2 pixels when going from portrait to landscape in standalone mode
  }
}, false);

document.addEventListener('click', e => {
  if (!e.target.closest('#settings')) {
    document.body.style.setProperty('--settings' + moveSettingsAxis, closedVals[moveSettingsAxis]());
    settingsOpen = false;
  }
}, false);

openSettings.addEventListener('click', () => { moveSettings(); }, false);

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

  /* let oneresult = ''  
  for (let i = 0; i < 1000; i++) {
    oneresult += toSteps(i*audioCtx.sampleRate/analyser.fftSize)+'\n'; //for testing note curve against standard one
  }
  console.log(oneresult); */

  //recursive function to constantly get new audio data and display it
  function showFrequency() {
    requestAnimationFrame(showFrequency);
    analyser.getByteFrequencyData(soundArray);
    let frequency = soundArray.indexOf(Math.max(...soundArray))*audioCtx.sampleRate/analyser.fftSize; //get the loudest bin and map to Hz
    if (frequency !== 0) {
      if (options.roundFreq) frequency = frequency.toFixed(1);
      frequencyDisplay.textContent = frequency + ' Hz';
      showNote(frequency);
      let showFineTune = fineTune(frequency)*2*45; //max is about +-0.5, so scale to 45 deg each way
      
      if (Math.abs(showFineTune) < 2) { //change to green if it's close enough - add setting for this?
        noteDisplay.classList.replace('red', 'green');
      }
      else {
        noteDisplay.classList.replace('green', 'red');
      }
      document.body.style.setProperty('--rotation', `${showFineTune}deg`); //pass to css variable

    }
  }
  showFrequency();
}

//change analyser setting according
function updateAnalyser() {
  analyser.fftSize = Math.pow(2, options.fftSize); //adjust number of frequency bins (higher = more precision)
  analyser.minDecibels = options.minDecibels; //adjust lower decibel cutoff (sensitivity, basically) more negative = more sensitive
}

//gives number of half steps away from A4
function toSteps(frequency) {
    let f0 = 440; //use A4 as base
    let fRatio = frequency/f0; //ratio of the frequencies
    let lnA = 0.05776226504666215; //approximation of ln of 2^(1/12)
    let steps = Math.log(fRatio)/lnA; //take log base 2^(1/12) to find the number of half-steps away from A4
    return steps;
}

//gives a letter note from a frequency
function showNote(frequency) {
  let steps = Math.round(toSteps(frequency)); //take ln to find the number of half-steps away from A4 - trunc? round?
  let fixSteps = steps < 0 ? notes.length + steps%notes.length - 1 : steps%notes.length;
  let tempNote = notes[fixSteps];
  noteLetter.textContent = tempNote.slice(0, 1);
  accidental.innerHTML = tempNote.slice(1);
  octave.textContent = Math.max(Math.trunc((steps+9)/notes.length)+4, 0); //have to add nine so it changes the octave on C instead of A
}

//max value: ~0.49 - gives difference between current frequency and nearest note
function fineTune(frequency) {
  let steps = toSteps(frequency)
  return steps - Math.round(steps); //flat should be negative, and sharp should be positive
}

//for moving the settings in and out
function moveSettings(resizing=false) {
  let tempSet;
  if ((!settingsOpen && resizing) || (settingsOpen && !resizing)) { //if it's closed and just resizing, or if it's open and not resizing, set to closed posiiton
    tempSet = closedVals[moveSettingsAxis]();
  }
  else {
    tempSet = 0;
  }
  if (!resizing) { //toggle open and closed for js
    settingsOpen = settingsOpen ? false : true;
  }
  document.body.style.setProperty('--settings' + moveSettingsAxis, tempSet);
}