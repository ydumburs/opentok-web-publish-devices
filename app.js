/* global OT */

(function closure() {

  let apiKey;
  let sessionId;
  let token;

  function handleError(error) {
    if (error) {
      console.error(error);
    }
  }

  const audioSelector = document.querySelector('#audio-source-select');
  const videoSelector = document.querySelector('#video-source-select');
  const publishBtn = document.querySelector('#publish-btn');
  const cycleVideoBtn = document.querySelector('#cycle-video-btn');
  let publisher;

  // Get the list of devices and populate the drop down lists
  function populateDeviceSources(selector, kind) {
    OT.getDevices((err, devices) => {
      if (err) {
        alert('getDevices error ' + err.message);
        return;
      }
      let index = 0;
      selector.innerHTML = devices.reduce((innerHTML, device) => {
        if (device.kind === kind) {
          index += 1;
          return `${innerHTML}<option value="${device.deviceId}">${device.label || device.kind + index}</option>`;
        }
        return innerHTML;
      }, '');
      publishBtn.disabled = false;
    });
  }
  publishBtn.disabled = true;
  // We request access to Microphones and Cameras so we can get the labels
  OT.getUserMedia().then((stream) => {
    populateDeviceSources(audioSelector, 'audioInput');
    populateDeviceSources(videoSelector, 'videoInput');
    // Stop the tracks so that we stop using this camera and microphone
    // If you don't do this then cycleVideo does not work on some Android devices
    stream.getTracks().forEach(track => track.stop());
  });

  function initializeSession() {
    const session = OT.initSession(apiKey, sessionId);

    session.on('streamCreated', (event) => {
      const subscriberOptions = {
        insertMode: 'append',
        width: '264px',
        height: '198px'
      };
      session.subscribe(event.stream, 'subscriber', subscriberOptions, handleError);
    });

    session.connect(token, (error) => {
      if (error) {
        handleError(error);
      } else {

        // Start publishing when you click the publish button
        publishBtn.addEventListener('click', () => {
          // Disable the audio and video pickers and hide the publish button
          audioSelector.disabled = true;
          videoSelector.disabled = true;
          publishBtn.style.display = 'none';

          // Start publishing with the selected devices
          publisher = OT.initPublisher('publisher', {
            audioSource: audioSelector.value,
            videoSource: videoSelector.value
          }, (err) => {
            if (err) {
              alert('Publish error ' + err.message);
            } else {
              session.publish(publisher, handleError);
              setupDeviceSwitching();
              setupAudioLevelMeter();
            }
          });
        });
      }
    });
  }

  if (API_KEY && TOKEN && SESSION_ID) {
    apiKey = API_KEY;
    sessionId = SESSION_ID;
    token = TOKEN;
    initializeSession();
  } else if (SAMPLE_SERVER_BASE_URL) {
    // Make a GET request to get the OpenTok API key, session ID, and token from the server
    fetch(SAMPLE_SERVER_BASE_URL + '/session')
      .then((response) => response.json())
      .then((json) => {
        apiKey = json.apiKey;
        sessionId = json.sessionId;
        token = json.token;
        // Initialize an OpenTok Session object
        initializeSession();
      }).catch((error) => {
        handleError(error);
        alert('Failed to get opentok sessionId and token. Make sure you have updated the config.js file.');
      });
  }

  // Allow you to switch to different cameras and microphones using
  // setAudioSource and cycleVideo
  function setupDeviceSwitching() {
    audioSelector.disabled = false;

    // When the audio selector changes we update the audio source
    audioSelector.addEventListener('change', (event) => {
      audioSelector.disabled = true;
      publisher.setAudioSource(event.target.value).then(() => {
        audioSelector.disabled = false;
      }).catch((err) => {
        alert(`setAudioSource failed: ${err.message}`);
        audioSelector.disabled = false;
      });
    });

    // When the cycleVideo button is clicked we call cycleVideo
    cycleVideoBtn.addEventListener('click', () => {
      cycleVideoBtn.disabled = true;
      publisher.cycleVideo().then(({ deviceId }) => {
        videoSelector.value = deviceId;
        cycleVideoBtn.disabled = false;
      }).catch((err) => {
        alert('cycleVideo error ' + err.message);
        cycleVideoBtn.disabled = false;
      });
    });
    cycleVideoBtn.style.display = 'inline-block';
  }

  function setupAudioLevelMeter() {
    const audioLevel = document.querySelector('#audio-meter');
    const meter = document.querySelector('#audio-meter meter');
    audioLevel.style.display = 'block';
    let movingAvg = null;
    publisher.on('audioLevelUpdated', (event) => {
      if (movingAvg === null || movingAvg <= event.audioLevel) {
        movingAvg = event.audioLevel;
      } else {
        movingAvg = 0.7 * movingAvg + 0.3 * event.audioLevel;
      }

      // 1.5 scaling to map the -30 - 0 dBm range to [0,1]
      let logLevel = (Math.log(movingAvg) / Math.LN10) / 1.5 + 1;
      logLevel = Math.min(Math.max(logLevel, 0), 1);
      meter.value = logLevel;
    });
  }
})();
