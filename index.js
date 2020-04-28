/**
 * swiping settings is jittery on phone - don't know how to fix
 */

'use strict'

//ask for microphone use
async function getMedia(constraints) {
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    handleSuccess(stream);
  } catch(err) {
    alert(err); //for mobile debugging - not that helpful
  }
}
getMedia({ audio: true });

const fineTuneMarks = document.getElementById('fineTuneMarks');
const justFrequency = document.getElementById('justFrequency');
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

const adjustTuning = document.getElementById('adjustTuning');
const showTuning = document.getElementById('showTuning');

const adjustTicks = document.getElementById('adjustTicks');
const showTicks = document.getElementById('showTicks');

//note names with html sharp and flat signs
const notes = ['A', 'B&flat;', 'B', 'C', 'C&sharp;', 'D', 'E&flat;', 'E', 'F', 'F&sharp;', 'G', 'A&flat;'];

//for storing settings
let options = JSON.parse(localStorage.getItem('options')) || 
  {
    darkMode: false,
    roundFreq: true,
    fftSize: 14,
    minDecibels: -60,
    tuning: 2,
    tickNum: 9,
  };

//standalone window or not
let isInWebApp = (window.navigator.standalone == true) || (window.matchMedia('(display-mode: standalone)').matches);

let analyser; //audio analyser

let settingsOpen = false; //settings open or not

//move the settings div in either the x or y dimension depending on a css variable set using media queries (value passed in load and resize listeners)
let moveSettingsAxis;

//get pixel values for where the settings drawer should be when closed
const closedVals = {
  X: () => - settings.offsetWidth + openSettings.offsetWidth,
  Y: () => settings.offsetHeight - openSettings.offsetHeight + 1, //+1 is for ipads and similar screen ratios - don't know why it won't go down far enough there
};

//set up settings with correct values, generate tuning ticks, dark/light mode
window.addEventListener('load', () => {
  changeTicks();

  moveSettingsAxis = getComputedStyle(document.body).getPropertyValue('--settings-sideways') == 0 ? 'X' : 'Y';
  document.body.style.setProperty('--settings' + moveSettingsAxis, closedVals[moveSettingsAxis]() + 'px');

  freqCheck.checked = options.roundFreq;
  
  adjustPrecision.value = options.fftSize;
  showPrecision.value = Math.pow(2, options.fftSize);

  adjustSensitivity.value = options.minDecibels*-1;
  showSensitivity.value = options.minDecibels*-1;

  adjustTicks.value = options.tickNum;
  showTicks.value = options.tickNum;

  if (options.darkMode) {
    document.body.classList.replace('light', 'dark');
    darkModeCheck.checked = options.darkMode;
  }
}, false);

//save the options object in localstorage
window.addEventListener('beforeunload', () => {
  localStorage.setItem('options', JSON.stringify(options));
}, false);

//make sure the settings are still in the right place
window.addEventListener('resize', () => {
  moveSettingsAxis = getComputedStyle(document.body).getPropertyValue('--settings-sideways') == 0 ? 'X' : 'Y'; //make sure this is updated
  let resetAxis = moveSettingsAxis === 'X' ? 'Y' : 'X';
  document.body.style.setProperty('--settings'+ resetAxis, '-50%');
  moveSettings(true);
  if (isInWebApp) {
    window.setTimeout(() => {moveSettings(true)}, 50); //disgusting hack to get rid of like 2 pixels when going from portrait to landscape in standalone mode
  }
}, false);

//click events: open/close settings and reload the page
document.addEventListener('click', e => {
  if (!e.target.closest('#settings')) { //if not on settings, close settings
    document.body.style.setProperty('--settings' + moveSettingsAxis, closedVals[moveSettingsAxis]() + 'px');
    settingsOpen = false;
  }
  else if (e.target.matches('#openSettings')) {
    if (!touchMoved) moveSettings();
  }
  else if (e.target.matches('#reloader')) {
    e.preventDefault();
    window.location.reload();
  }
}, false);

//swipe the settings open and closed
let initialPos = {};
let touchMoved = false;
let snapPos = 0;
let switchSettings = false;
let framePending = false;

settings.addEventListener('touchstart', e => {
  if (e.target.tagName !== 'INPUT' && !e.target.classList.contains('checkmark')) { //don't swipe in and out on the inputs
    snapPos = 0;
    touchMoved = false;
    switchSettings = false;
    framePending = false;
    initialPos = {X: e.targetTouches[0].clientX, Y: e.targetTouches[0].clientY};
    document.addEventListener('touchmove', swipeSettings, true);

    settings.addEventListener('touchend', () => { //add touchend listener, once
      if (touchMoved) {
        switchSettings ? moveSettings() : resetSettingsPosition(); //reset or move settings depending on
        touchMoved = false;
      }
      document.removeEventListener('touchmove', swipeSettings, true);
    }, {useCapture: true, once: true});
  }
}, true);

//to reset the settings position if the control center gets opened or something
settings.addEventListener('touchcancel', resetSettingsPosition, false);

//event listeners  for settings inputs
darkModeCheck.addEventListener('input', () => {
  options.darkMode = darkModeCheck.checked;
  options.darkMode ? document.body.classList.replace('light', 'dark') : document.body.classList.replace('dark', 'light');
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

adjustTuning.addEventListener('input', () => {
  showTuning.value = adjustTuning.value;
  options.tuning = adjustTuning.value;
}, false);

showTuning.addEventListener('input', () => {
  showTuning.value = Math.max(Math.min(parseInt(showTuning.value), 15), 0);
  adjustTuning.value = showTuning.value;
  options.tuning = adjustTuning.value;
}, false);

adjustTicks.addEventListener('input', () => {
  showTicks.value = adjustTicks.value;
  options.tickNum = adjustTicks.value;
  changeTicks();
}, false);

//set up audio analyser and show frequency data
function handleSuccess(stream) {
  //get the audio context and create an analyser
  let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();

  //set some properties according to options
  updateAnalyser();

  //make an audio source and connect it to the analyser
  audioCtx.createMediaStreamSource(stream).connect(analyser);

  let soundArray = new Uint8Array(analyser.frequencyBinCount); //make a Uint8Array to store the audio data, same length as number of bins

  //recursive function to constantly get new audio data and display it
  function showFrequency() {
    requestAnimationFrame(showFrequency);
    analyser.getByteFrequencyData(soundArray);
    let frequency = soundArray.indexOf(Math.max(...soundArray))*audioCtx.sampleRate/analyser.fftSize; //get the loudest bin and map to Hz
    if (frequency !== 0) {
      if (options.roundFreq) frequency = frequency.toFixed(1);
      justFrequency.textContent = frequency;
      showNote(frequency);
      let showFineTune = fineTune(frequency)*2*45; //max is about +-0.5, so scale to 45 deg each way
      
      if (Math.abs(showFineTune) < options.tuning) { //change to green if it's close enough - add setting for this?
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
    tempSet = 0; //0 is fully open
  }
  if (!resizing) { //toggle open and closed for js
    settingsOpen = settingsOpen ? false : true;
  }
  document.body.style.setProperty('--settings' + moveSettingsAxis, tempSet + 'px');
}

//change the number of tuning ticks there are
function changeTicks() {
  fineTuneMarks.innerHTML = ''; //clear any previous ones
  for (let i = 0; i < options.tickNum; i++) {
    let mark = document.createElement('DIV');
    mark.classList.add('tuningMark');
    if (i === 0 || i === options.tickNum-1 || i === options.tickNum/2-0.5) { //make the middle and end ones bigger
      mark.classList.add('bigTick');
    }
    mark.style.transform = `translateX(-50%) rotate(${90/(options.tickNum-1)*i-45}deg)`;
    fineTuneMarks.appendChild(mark);
  }
}

//for swiping the settings open and closed - called on touchmove
function swipeSettings(e) {
  let currentPos = {X: e.targetTouches[0].clientX, Y: e.targetTouches[0].clientY}; //get the current position
  if (currentPos[moveSettingsAxis] !== initialPos[moveSettingsAxis]) { //if moved in the direction the settings would move
    touchMoved = true;
    if (framePending) { //if there's a frame waiting, don't add another one
      return;
    }
    framePending = true; //there is one pending
    requestAnimationFrame(() => {
      framePending = false; //now there's not one pending
      let closedOffset = closedVals[moveSettingsAxis](); //the closed position for the current direction
      let startOffset = settingsOpen ? 0 : closedOffset; //starting offset of the settings div when the touch starts (0 is fully open)
      let touchOffset = initialPos[moveSettingsAxis] - currentPos[moveSettingsAxis]; //how far the touch event has moved
      console.log(touchOffset);
      let newPos = startOffset-touchOffset; //calculated new position
      
      //have to switch max and min because x goes negative and y goes positive
      if (moveSettingsAxis === 'Y') {
        document.body.style.setProperty('--settingsY', Math.max(Math.min(newPos, closedOffset), 0) + 'px');
      }
      else {
        document.body.style.setProperty('--settingsX', Math.min(Math.max(newPos, closedOffset), 0) + 'px');
      }

      let settings90deg = moveSettingsAxis === 'Y' ? settingsOpen : !settingsOpen; //reverse settingsOpen for swiping on the x axis, because it's opposite signs
      
      //if moved more than 50px in the right direction, go all the way that way. If not, snap back
      if ((!settings90deg && touchOffset > 50) || (settings90deg && touchOffset < -50)) {
        switchSettings = true;
      }
      else {
        switchSettings = false;
      }
      snapPos = switchSettings ? settingsOpen ? 0 : closedOffset : startOffset; //the position to snap to
    });
  }
}

//reset the settings position
function resetSettingsPosition() {
  touchMoved = false;
  document.body.style.setProperty('--settings' + moveSettingsAxis, snapPos + 'px');
  window.setTimeout(() => {
    document.body.style.setProperty('--settings' + moveSettingsAxis, snapPos + 'px'); //disgusting hack
  }, 50);
}