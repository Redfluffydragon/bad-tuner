'use strict';

//ask for microphone use
let audioCtx;
let analyser; //for audio analyser
let soundArray;
getAudio();

/* if (navigator.serviceWorker) {
  navigator.serviceWorker.register('/tuner/sw.js', {scope: '/tuner/'});
} */

const fineTunePointer = document.getElementById('fineTunePointer');
const fineTuneMarks = document.getElementById('fineTuneMarks');
const justFrequency = document.getElementById('justFrequency');
const noteDisplay = document.getElementById('noteDisplay');
const noteLetter = document.getElementById('noteLetter');
const accidental = document.getElementById('accidental');
const octave = document.getElementById('octave');

const settings = document.getElementById('settings');
const openSettings = document.getElementById('openSettings');

const darkModeCheck = document.getElementById('darkModeCheck');

const freqCheck = document.getElementById('freqCheck');

const adjustPrecision = document.getElementById('adjustPrecision');
const showPrecision = document.getElementById('showPrecision');

const adjustSensitivity = document.getElementById('adjustSensitivity');
const showSensitivity = document.getElementById('showSensitivity');

const adjustTuning = document.getElementById('adjustTuning');
const showTuning = document.getElementById('showTuning');

const adjustTicks = document.getElementById('adjustTicks');
const showTicks = document.getElementById('showTicks');

const moreSettingsCheck = document.getElementById('moreSettingsCheck');

//note names with sharp and flat signs
const notes = ['A', 'B♭', 'B', 'C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭'];

//for storing settings
const startOptions = {
  darkMode: null,
  roundFreq: true,
  fftSize: 15,
  minDecibels: -70,
  tuning: 2,
  tickNum: 9,
  moreSettings: false,
};
let options = JSON.parse(localStorage.getItem('options')) || startOptions;

//for updating with new settings, since it won't get added in otherwise
if (!sameKeys(startOptions, options)) {
  options = startOptions;
}

let settingsOpen = false; //settings open or not

//to move the settings div in either the x or y dimension depending on a css variable set using media queries (value passed in load and resize listeners)
const moveSettingsAxis = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--settings-sideways'), 10) === 0 ? 'Y' : 'X';

//get pixel values for where the settings drawer should be when closed
const closedVals = {
  X: () => - settings.offsetWidth + openSettings.offsetWidth - 1, //+-1 is to get the divider line off screen on certain screen ratios
  Y: () => settings.offsetHeight - openSettings.offsetHeight + 1, 
};

//standalone window or not
let isInWebApp = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

//system dark more detection
const darkMode = () => window.matchMedia('(prefers-color-scheme: dark)');

//change mode when the system mode preference changes (gets preference over manual toggle)
window.matchMedia('(prefers-color-scheme: dark)').addListener(() => {
  document.body.classList = '';
  darkModeCheck.checked = darkMode();
  options.darkMode = null;
});

//set up settings with correct values, generate tuning ticks, dark/light mode
window.addEventListener('load', () => {
  changeTicks();

  freqCheck.checked = options.roundFreq;
  
  adjustPrecision.value = options.fftSize;
  showPrecision.value = Math.pow(2, options.fftSize);

  adjustSensitivity.value = options.minDecibels*-1;
  showSensitivity.value = options.minDecibels*-1;

  adjustTicks.value = options.tickNum;
  showTicks.value = options.tickNum;

  adjustTuning.value = options.tuning;
  showTuning.value = options.tuning === -1 ? '' : options.tuning;
  if (options.tuning === -1) {
    showTuning.placeholder = 'OFF';
  }

  if (options.darkMode !== null) { //if dark mode has been set manually, set everything according to that
    document.body.classList.add(options.darkMode ? 'dark' : 'light');
    darkModeCheck.checked = options.darkMode;
  }
  else {
    darkModeCheck.checked = darkMode(); //else, make sure the checkbox reflects the auto value
  }

  if (options.moreSettings) {
    document.documentElement.style.setProperty('--more-settings-display', 'list-item');
    document.documentElement.style.setProperty('--make-line-up', 'right');

    moreSettingsCheck.checked = options.moreSettings;
  }

  if (isInWebApp && window.matchMedia('(orientation: landscape)')) { //gross hack to make sure it's the right width when reloaded in landscape
    document.documentElement.style.setProperty('--hacky-hack-hack', settings.offsetWidth + 'px');
  }

  document.documentElement.style.setProperty('--settings' + moveSettingsAxis(), closedVals[moveSettingsAxis()]() + 'px');
}, false);

//save the options object in localstorage - ios doesn't support beforeunload
let whichUnload = (navigator.userAgent.match(/iPad/i) || navigator.userAgent.match(/iPhone/i)) ? 'pagehide' : 'beforeunload';
window.addEventListener(whichUnload, () => {
  options.roundFreq = freqCheck.checked;
  localStorage.setItem('options', JSON.stringify(options));
}, false);

//make sure the settings are still in the right place
window.addEventListener('resize', () => {
  let resetAxis = moveSettingsAxis() === 'X' ? 'Y' : 'X';
  document.documentElement.style.setProperty('--settings' + resetAxis, '-50%');
  moveSettings(true);
  if (isInWebApp) {
    document.documentElement.style.setProperty('--hacky-hack-hack', '0');
    window.setTimeout(() => { moveSettings(true); }, 50); //disgusting hack to get rid of like 2 pixels when going from portrait to landscape in standalone mode
  }
}, false);

//click events: open/close settings and reload the page
document.addEventListener('click', e => {
  if (!e.target.closest('#settings')) { //if not on settings, close settings
    document.documentElement.style.setProperty('--settings' + moveSettingsAxis(), closedVals[moveSettingsAxis()]() + 'px');
    settingsOpen = false;
  }
  else if (e.target.matches('#openSettings') && !touchMoved) {
    moveSettings();
  }
  else if (e.target.matches('#reloader')) {
    e.preventDefault();
    window.location.reload();
  }
}, false);

//swipe the settings open and closed
let initialPos = {}; //initial position of the touch
let touchMoved = false; //if the touch moved or not
let switchSettings = false; //if the settings should switch position or not
let framePending = false; //if there's an animation frame pending (so another one isn't sent)

settings.addEventListener('touchstart', e => {
  if (e.target.tagName !== 'INPUT' && !e.target.classList.contains('checkmark') && e.targetTouches[0].clientY < window.innerHeight) { //don't swipe in and out on the inputs or when the touch is coming from the bottom of the screen
    touchMoved = false;
    switchSettings = false;
    framePending = false;
    initialPos = {X: e.targetTouches[0].clientX, Y: e.targetTouches[0].clientY};
    document.addEventListener('touchmove', swipeSettings, {passive: true, useCapture: true});

    settings.addEventListener('touchend', () => { //add self-removing touchend listener
      document.documentElement.style.setProperty('--settings-transition', 'transform .4s'); //add transition back so it's smooth the rest of the way
      if (touchMoved) {
        moveSettings(!switchSettings);
      }
      document.removeEventListener('touchmove', swipeSettings, {passive: true, useCapture: true}); //remove the touchmove listener for performance
    }, {useCapture: true, once: true});
  }
}, true);

//to reset the settings position if the control center gets opened or something (only sort of works)
settings.addEventListener('touchcancel', () => { 
  moveSettings(true); 
  window.setTimeout(() => {
    moveSettings(true); 
  }, 100);
}, false);

//event listeners  for settings inputs
darkModeCheck.addEventListener('input', () => {
  options.darkMode = darkModeCheck.checked;
  if (options.darkMode) {
    document.body.classList.add('dark');
    document.body.classList.remove('light');
  }
  else {
    document.body.classList.add('light');
    document.body.classList.remove('dark');
  }
}, false);

adjustPrecision.addEventListener('input', () => {
  showPrecision.value = Math.pow(2, adjustPrecision.value);
  options.fftSize = parseInt(adjustPrecision.value, 10);
  updateAnalyser();
}, false);

adjustSensitivity.addEventListener('input', () => {
  showSensitivity.value = adjustSensitivity.value;
  options.minDecibels = adjustSensitivity.value*-1;
  updateAnalyser();
}, false);

showSensitivity.addEventListener('input', () => {
  if (showSensitivity.value.length === 2) {
    showSensitivity.value = Math.max(parseInt(showSensitivity.value, 10), 40);
  }
  else if (showSensitivity.value.length > 2) {
    showSensitivity.value = Math.min(parseInt(showSensitivity.value, 10), 100);
  }
  adjustSensitivity.value = showSensitivity.value;
  options.minDecibels = parseInt(adjustSensitivity.value, 10)*-1;
  updateAnalyser();
}, false);

showSensitivity.addEventListener('focusout', () => {
  showSensitivity.value = adjustSensitivity.value;
}, false);

adjustTuning.addEventListener('input', () => {
  tuningOnOff();
  options.tuning = parseInt(adjustTuning.value, 10);
}, false);

showTuning.addEventListener('input', () => {
  showTuning.value = Math.max(Math.min(parseInt(showTuning.value, 10), 10), -1);

  adjustTuning.value = showTuning.value;
  options.tuning = parseInt(adjustTuning.value, 10);

  showTuning.placeholder = parseInt(showTuning.value, 10) === -1 ?'OFF' : '';
  if (parseInt(showTuning.value, 10) === -1) {
    showTuning.value = '';
  }
}, false);

showTuning.addEventListener('focusout', tuningOnOff, false);

adjustTicks.addEventListener('input', () => {
  showTicks.value = adjustTicks.value;
  options.tickNum = parseInt(adjustTicks.value, 10);
  changeTicks();
}, false);

moreSettingsCheck.addEventListener('input', () => {
  document.documentElement.style.setProperty('--more-settings-display', moreSettingsCheck.checked ? 'list-item' : 'none');
  document.documentElement.style.setProperty('--make-line-up', moreSettingsCheck.checked ? 'right' : 'unset');
  
  options.moreSettings = moreSettingsCheck.checked;
}, false);

async function getAudio() {
  makeAnalyser(await navigator.mediaDevices.getUserMedia({ audio: true })); //await stuff evaluates to an audio stream if successful
}

//set up audio analyser and show frequency data
function makeAnalyser(stream) {
  //get the audio context and create an analyser
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  analyser = audioCtx.createAnalyser();

  //set fft size and minDecibels properties according to options
  updateAnalyser();

  //make an audio source and connect it to the analyser
  audioCtx.createMediaStreamSource(stream).connect(analyser);

  soundArray = new Uint8Array(analyser.frequencyBinCount); //make a Uint8Array to store the audio data, same length as number of bins

  showFrequency();
}

//change analyser setting according
function updateAnalyser() {
  analyser.fftSize = Math.pow(2, options.fftSize); //adjust number of frequency bins (higher = more precision)
  analyser.minDecibels = options.minDecibels; //adjust lower decibel cutoff (sensitivity, basically) more negative = more sensitive
}

//barycentric interpolation seems to be a little more accurate than quadratic, and doesn't return nasty values
const interpolate = bin => bin + (soundArray[bin+1] - soundArray[bin-1]) / (soundArray[bin] + soundArray[bin-1] + soundArray[bin+1]);

//recursive function to constantly get new audio data and display it
function showFrequency() {
  requestAnimationFrame(showFrequency); //run again

  analyser.getByteFrequencyData(soundArray); //get data into array
  let midBin = soundArray.indexOf(Math.max(...soundArray)); //get index of loudest bin
  
  let finBin; //for the final bin (after the logic)
  let lastHarmonic = Math.round(midBin/2); //the next lowest harmonic - wants to read high, so try to go down
  
  //check the volume difference vs an experimentally determined constant minus the midBin volume: if the volume diff is small enough, switch down an octave
  //300 - midBin seems to work pretty well to take into account the frequency
  //seems to work decently well, actually. 
  if ((soundArray[midBin] - soundArray[lastHarmonic]) < Math.max(280 + (300 - midBin) - soundArray[midBin], 60)) { //if the next lowest harmonic is close enough, switch to that
    finBin = interpolate(lastHarmonic);
  }
  else {
    finBin = interpolate(midBin);
  }

  if (finBin > 0) { //if not silent, update stuff
    let frequency = finBin*audioCtx.sampleRate/analyser.fftSize; //map the final bin to Hz
    
    if (freqCheck.checked) { //if the round frequency checkbox is checked, round the frequency
      frequency = frequency.toFixed(1);
    }
    justFrequency.textContent = frequency; //show the frequency

    //take log base 2^(1/12) of the ratio between the current frequency and A4 to find the number of half-steps away from A4 - big decimal is approx. ln(2^(1/12))
    let steps = Math.log(frequency/440)/0.05776226504666215;
    let roundSteps = Math.round(steps);

    //get the letter note and octave and show them
    let fixSteps = roundSteps < 0 ? notes.length + roundSteps%notes.length : roundSteps%notes.length; //if lower than A4, add notes.length to reverse the index (I think)
    fixSteps = fixSteps === 12 ? 0 : fixSteps; //if it's an A it'll end up 12, which we need to be zero
    let tempNote = notes[fixSteps]; //get the string from notes

    noteLetter.textContent = tempNote.charAt(0); //the first one is the letter
    accidental.textContent = tempNote.length > 1 ? tempNote.charAt(1) : ''; //then any accidentals
    octave.textContent = Math.max(Math.floor((roundSteps + 9)/notes.length) + 4, 0); //have to add nine so it changes the octave on C instead of A, and limit it to zero 'cause negative octaves don't exist

    // console.log((soundArray[midBin] - soundArray[lastHarmonic]), 280 - soundArray[midBin], midBin, tempNote+tempOctave); //for testing
    
    let showFineTune = (steps - roundSteps) * 90; //max is about +-0.5, so scale to 45 deg both ways
    
    if (Math.abs(showFineTune) <= options.tuning) { //change to green if it's close enough
      noteDisplay.classList.replace('red', 'green');
    }
    else {
      noteDisplay.classList.replace('green', 'red');
    }
    fineTunePointer.style.transform = `rotate(${showFineTune}deg)`; //rotate the pointer to the right angle
  }
}

//for moving the settings in and out
function moveSettings(resizing=false) {
  touchMoved = false;
  let tempSet;
  if ((!settingsOpen && resizing) || (settingsOpen && !resizing)) { //if it's closed and just resizing, or if it's open and not resizing, set to closed posiiton
    tempSet = closedVals[moveSettingsAxis()]();
  }
  else {
    tempSet = 0; //0 is fully open
  }
  if (!resizing) { //toggle open and closed for js
    settingsOpen = !settingsOpen;
  }
  document.documentElement.style.setProperty('--settings' + moveSettingsAxis(), tempSet + 'px');
}

//tell if two objects have the same keys
function sameKeys(...objects) {
  const getKeys = objects.reduce((keys, object) => keys.concat(Object.keys(object)), []); //get the keys of all objects and put in an array
  const oneOfEach = new Set(getKeys); //put all the keys in a set
  return objects.every(object => oneOfEach.size === Object.keys(object).length); //check if the set has the same length as the objects' keys
}

//change the number of tuning ticks there are
function changeTicks() {
  fineTuneMarks.innerHTML = ''; //clear any previous ones
  for (let i = 0; i < options.tickNum; i++) {
    let mark = document.createElement('DIV');
    mark.classList.add('tuningMark');
    if (i % ((options.tickNum-1)/2) === 0) { //make the middle and end ones bigger
      mark.classList.add('bigTick');
    }
    mark.style.transform = `translateX(-50%) rotate(${90/(options.tickNum-1)*i-45}deg)`;
    fineTuneMarks.appendChild(mark);
  }
}

//if the tuning radius is negative one, it's off, so set it to say that (have to use placeholder 'cause it's a number input)
function tuningOnOff() {
  if (parseInt(adjustTuning.value, 10) === -1) {
    showTuning.value = '';
    showTuning.placeholder = 'OFF';
  }
  else {
    showTuning.value = adjustTuning.value;
  }
}

//for swiping the settings open and closed - called on touchmove
function swipeSettings(e) {
  let currentPos = {X: e.targetTouches[0].clientX, Y: e.targetTouches[0].clientY}; //get the current position
  if (Math.abs(currentPos[moveSettingsAxis()] - initialPos[moveSettingsAxis()]) > 1 && !framePending) { //if moved in the direction the settings would move more than 1px, and if there's no frame waiting
    touchMoved = true; //to disable tapping on openSettings
    framePending = true; //now there is one pending
    requestAnimationFrame(() => {
      framePending = false; //now there's not one pending
      let closedOffset = closedVals[moveSettingsAxis()](); //the closed position for the current direction
      let startOffset = settingsOpen ? 0 : closedOffset; //starting offset of the settings div when the touch starts (0 is fully open)
      let touchOffset = initialPos[moveSettingsAxis()] - currentPos[moveSettingsAxis()]; //how far the touch event has moved
      
      let newPos = Math.round((startOffset - touchOffset) * 100) / 100; //calculated new position
      
      document.documentElement.style.setProperty('--settings-transition', 'unset'); //remove transition because it makes it really jittery on ios
      //have to switch max and min because x goes negative and y goes positive
      if (moveSettingsAxis() === 'Y') {
        document.documentElement.style.setProperty('--settingsY', Math.max(Math.min(newPos, closedOffset), 0) + 'px');
      }
      else {
        document.documentElement.style.setProperty('--settingsX', Math.min(Math.max(newPos, closedOffset), 0) + 'px');
      }

      let settings90deg = moveSettingsAxis() === 'Y' ? settingsOpen : !settingsOpen; //reverse settingsOpen for swiping on the x axis, because it's opposite signs
      
      //if moved more than 50px in the right direction, go all the way that way. If not, snap back
      if ((!settings90deg && touchOffset > 50) || (settings90deg && touchOffset < -50)) {
        switchSettings = true;
      }
      else {
        switchSettings = false;
      }
    });
  }
}