const passwordInput = document.getElementById('password');
const generatePasswordButton = document.getElementById('generatePassword');
const localVideo = document.getElementById('localVideo');
const offerSdpTextarea = document.getElementById('offerSdp');
const generateOfferButton = document.getElementById('generateOffer');
const answerSdpTextarea = document.getElementById('answerSdp');
const setAnswerButton = document.getElementById('setAnswer');
const remoteVideo = document.getElementById('remoteVideo');
const localIceCandidatesTextarea = document.getElementById('localIceCandidates');
const remoteIceCandidatesFromMonitorTextarea = document.getElementById('remoteIceCandidatesFromMonitor');
const addRemoteIceCandidatesControllerButton = document.getElementById('addRemoteIceCandidatesController');

let localStream;
let peerConnection;

function generateRandomPassword(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function startWebcam() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    localVideo.srcObject = localStream;
  } catch (error) {
    console.error('Camera access error:', error);
  }
}

async function createOffer() {
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  localStream.getVideoTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = event => {
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      localIceCandidatesTextarea.value += JSON.stringify(event.candidate) + '\n';
      console.log('Controller: Local ICE candidate:', JSON.stringify(event.candidate));
    }
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  offerSdpTextarea.value = offer.sdp;
  console.log('Generated Offer SDP:', offer.sdp);
}

async function setRemoteAnswer() {
  const answerSdp = answerSdpTextarea.value;
  if (answerSdp) {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
      console.log('Controller: Remote Answer SDP set.');
    } catch (error) {
      console.error('Error setting remote answer:', error);
    }
  } else {
    alert('Please paste the Answer SDP from the monitor.');
  }
}

async function addRemoteIceCandidatesController() {
  const iceCandidates = remoteIceCandidatesFromMonitorTextarea.value.trim().split('\n');
  for (const candidate of iceCandidates) {
    if (candidate) {
      try {
        const ice = JSON.parse(candidate);
        await peerConnection.addIceCandidate(ice);
        console.log('Controller: Added remote ICE candidate:', ice);
      } catch (e) {
        console.warn('Controller: Error parsing remote ICE candidate:', e, candidate);
      }
    }
  }
  remoteIceCandidatesFromMonitorTextarea.value = ''; // Clear after adding
}

generatePasswordButton.addEventListener('click', () => {
  passwordInput.value = generateRandomPassword();
});

generateOfferButton.addEventListener('click', createOffer);
setAnswerButton.addEventListener('click', setRemoteAnswer);
addRemoteIceCandidatesControllerButton.addEventListener('click', addRemoteIceCandidatesController);

document.addEventListener('DOMContentLoaded', startWebcam);