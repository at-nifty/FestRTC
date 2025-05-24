const passwordInput = document.getElementById('password');
const offerSdpTextarea = document.getElementById('offerSdp');
const setOfferButton = document.getElementById('setOffer');
const answerSdpTextarea = document.getElementById('answerSdp');
const generateAnswerButton = document.getElementById('generateAnswer');
const remoteVideo = document.getElementById('remoteVideo');
const localIceCandidatesTextarea = document.getElementById('localIceCandidates');
const remoteIceCandidatesFromControllerTextarea = document.getElementById('remoteIceCandidatesFromController');
const addRemoteIceCandidatesMonitorButton = document.getElementById('addRemoteIceCandidatesMonitor');

let peerConnection;

async function initializePeerConnection() {
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  peerConnection.ontrack = event => {
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      localIceCandidatesTextarea.value += JSON.stringify(event.candidate) + '\n';
      console.log('Monitor: Local ICE candidate:', JSON.stringify(event.candidate));
    }
  };
}

async function setRemoteOffer() {
  const offerSdp = offerSdpTextarea.value;
  if (offerSdp) {
    await initializePeerConnection();
    try {
      const offer = new RTCSessionDescription({ type: 'offer', sdp: offerSdp });
      await peerConnection.setRemoteDescription(offer);
      console.log('Monitor: Remote Offer SDP set.');
      await createAnswer();
    } catch (error) {
      console.error('Error setting remote offer:', error);
    }
  } else {
    alert('Please paste the Offer SDP from the controller.');
  }
}

async function createAnswer() {
  if (!peerConnection) {
    console.error('PeerConnection not initialized.');
    return;
  }
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  answerSdpTextarea.value = answer.sdp;
  console.log('Generated Answer SDP:', answer.sdp);
}

async function addRemoteIceCandidatesMonitor() {
  const iceCandidates = remoteIceCandidatesFromControllerTextarea.value.trim().split('\n');
  for (const candidate of iceCandidates) {
    if (candidate) {
      try {
        const ice = JSON.parse(candidate);
        await peerConnection.addIceCandidate(ice);
        console.log('Monitor: Added remote ICE candidate:', ice);
      } catch (e) {
        console.warn('Monitor: Error parsing remote ICE candidate:', e, candidate);
      }
    }
  }
  remoteIceCandidatesFromControllerTextarea.value = ''; // Clear after adding
}

setOfferButton.addEventListener('click', setRemoteOffer);
generateAnswerButton.addEventListener('click', createAnswer);
addRemoteIceCandidatesMonitorButton.addEventListener('click', addRemoteIceCandidatesMonitor);

document.addEventListener('DOMContentLoaded', () => {
  passwordInput.value = 'waiting...'; // モニター側はパスワード生成しない
});