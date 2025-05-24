const passwordInput = document.getElementById('password');
const offerSdpTextarea = document.getElementById('offerSdp');
const setOfferButton = document.getElementById('setOffer');
const answerSdpTextarea = document.getElementById('answerSdp');
const generateAnswerButton = document.getElementById('generateAnswer');
const remoteVideo = document.getElementById('remoteVideo');
const localIceCandidatesTextarea = document.getElementById('localIceCandidates');
const remoteIceCandidatesFromControllerTextarea = document.getElementById('remoteIceCandidatesFromController');
const addRemoteIceCandidatesMonitorButton = document.getElementById('addRemoteIceCandidatesMonitor');
const saveMonitorToFileButton = document.getElementById('saveMonitorToFileButton');
const loadMonitorFromFileButton = document.getElementById('loadMonitorFromFileButton');
const fileMonitorInput = document.getElementById('fileMonitorInput');

let peerConnection;
let allMonitorIceCandidatesCollected = false; // Flag for ICE collection

// Function to save monitor connection data to a file - Will be replaced by exportMonitorResponseData
function saveMonitorDataToFile() {
    console.log('[saveMonitorDataToFile] この関数は新しいフローでは直接使用されません。代わりに exportMonitorResponseData を使用してください。');
    alert('この保存機能は更新中です。自動エクスポートを使用してください。');
}

// New function to export monitor response data
function exportMonitorResponseData(data) {
    console.log('[exportMonitorResponseData] モニター応答データをエクスポートします:', data);
    try {
        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'monitor-response-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('[exportMonitorResponseData] monitor-response-data.json のダウンロードを開始しました。');
        alert('モニター応答データファイル (monitor-response-data.json) がエクスポートされました。このファイルをコントローラーに渡してください。');
    } catch (error) {
        console.error('[exportMonitorResponseData] データのエクスポート失敗:', error);
        alert('モニター応答データのエクスポートに失敗しました。コンソールを確認してください。');
    }
}

async function initializePeerConnection() {
  console.log('[initializePeerConnection] PeerConnection設定を開始します。');
  allMonitorIceCandidatesCollected = false; // Reset flag
  localIceCandidatesTextarea.value = ''; // Clear previous candidates
  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  const icePromise = new Promise((resolve) => {
      const candidates = [];
      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          console.log('[onicecandidate] モニター: ローカルICE候補集集中:', event.candidate);
          candidates.push(event.candidate);
        } else {
          console.log('[onicecandidate] モニター: 全てのローカルICE候補収集完了。');
          localIceCandidatesTextarea.value = JSON.stringify(candidates, null, 2);
          allMonitorIceCandidatesCollected = true;
          resolve(candidates); // Resolve with all collected candidates
        }
      };
  });

  peerConnection.ontrack = event => {
    console.log('[ontrack] モニター: リモートトラック受信:', event.streams[0]);
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };
  
  peerConnection.oniceconnectionstatechange = () => {
    console.log('[oniceconnectionstatechange] モニター: ICE接続状態変更:', peerConnection.iceConnectionState);
  };

  return icePromise; // Return the promise that resolves when ICE gathering is done
}

// Simplified setRemoteOffer, expects offer SDP string
async function setRemoteOffer(offerSdpString) {
  if (!offerSdpString) {
    alert('コントローラーからのオファーSDPが提供されていません。');
    console.error('[setRemoteOffer] オファーSDP文字列がありません。');
    return false;
  }
  // initializePeerConnection should be called before this by the main processing function
  if (!peerConnection) {
    console.error('[setRemoteOffer] PeerConnectionが初期化されていません。先にinitializePeerConnectionを呼び出すべきです。');
    alert('エラー: PeerConnectionが未初期化です。');
    return false;
  }
  try {
    const offer = new RTCSessionDescription({ type: 'offer', sdp: offerSdpString });
    await peerConnection.setRemoteDescription(offer);
    console.log('[setRemoteOffer] モニター: リモートオファーSDP設定完了。');
    return true;
  } catch (error) {
    console.error('[setRemoteOffer] リモートオファー設定エラー:', error);
    alert('オファーSDPの設定中にエラーが発生しました。');
    return false;
  }
}

// Simplified createAnswer, returns answer object
async function createAnswer() {
  if (!peerConnection) {
    console.error('[createAnswer] PeerConnectionが初期化されていません。');
    alert('PeerConnectionが初期化されていません。オファーを先に設定してください。');
    return null;
  }
  try {
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    answerSdpTextarea.value = answer.sdp;
    console.log('[createAnswer] アンサー生成成功。SDP:', answer.sdp);
    return answer;
  } catch(error) {
    console.error('[createAnswer] アンサー生成エラー:', error);
    alert('アンサーの生成中にエラーが発生しました。');
    return null;
  }
}

// Simplified addRemoteIceCandidatesMonitor, expects array of candidates
async function addRemoteIceCandidates(candidates) {
  if (!peerConnection) {
    console.warn('[addRemoteIceCandidates] PeerConnectionが初期化されていません。ICE候補を追加できません。');
    // No alert, as this is part of an automated flow
    return false;
  }
  if (!candidates || !Array.isArray(candidates)) {
    console.warn('[addRemoteIceCandidates] 無効なICE候補データです。', candidates);
    return false;
  }
  console.log('[addRemoteIceCandidates] コントローラーからのリモートICE候補を追加します:', candidates);
  try {
    for (const candidate of candidates) {
      if (candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[addRemoteIceCandidates] モニター: リモートICE候補追加成功:', candidate);
      }
    }
    return true;
  } catch (e) {
    console.error('[addRemoteIceCandidates] モニター: リモートICE候補の追加エラー:', e);
    alert('コントローラーのICE候補の追加中にエラーが発生しました。');
    return false;
  }
}

// Main function to process loaded controller data and export monitor response
async function processControllerFileAndExport(controllerData) {
    console.log('[processControllerFileAndExport] 受信したコントローラーデータ:', controllerData);
    if (!controllerData || !controllerData.password || !controllerData.offerSdp || !controllerData.localIceCandidates) {
        alert('無効なコントローラーデータファイルです。必要な情報が不足しています。');
        console.error('[processControllerFileAndExport] 無効なコントローラーデータ:', controllerData);
        return;
    }

    passwordInput.value = controllerData.password;
    offerSdpTextarea.value = controllerData.offerSdp;
    // Display controller's ICE candidates for informational purposes (optional)
    remoteIceCandidatesFromControllerTextarea.value = JSON.stringify(controllerData.localIceCandidates, null, 2);

    // 1. Initialize PeerConnection and get ICE promise for monitor's candidates
    const monitorIceGatheringPromise = initializePeerConnection();
    console.log('[processControllerFileAndExport] PeerConnection設定完了。モニターのICE候補収集中...');

    // 2. Set remote offer from controller
    const offerSet = await setRemoteOffer(controllerData.offerSdp);
    if (!offerSet) {
        console.error('[processControllerFileAndExport] リモートオファーの設定に失敗しました。処理を中止します。');
        return;
    }

    // 3. Add controller's ICE candidates
    const controllerIceAdded = await addRemoteIceCandidates(controllerData.localIceCandidates);
    if (!controllerIceAdded) {
        console.warn('[processControllerFileAndExport] コントローラーのICE候補の追加に一部失敗した可能性があります。');
        // Continue for now, as some candidates might still allow connection
    }

    // 4. Create Answer
    const answer = await createAnswer();
    if (!answer) {
        console.error('[processControllerFileAndExport] アンサーの生成に失敗しました。処理を中止します。');
        return;
    }
    console.log('[processControllerFileAndExport] アンサー生成完了。');

    // 5. Wait for all Monitor's local ICE candidates
    let monitorLocalIceCandidates;
    try {
        monitorLocalIceCandidates = await monitorIceGatheringPromise;
        console.log('[processControllerFileAndExport] モニターの全ICE候補収集完了:', monitorLocalIceCandidates);
    } catch (error) {
        alert('モニターのICE候補の収集に失敗しました。コンソールを確認してください。');
        console.error('[processControllerFileAndExport] モニターICE候補収集失敗:', error);
        return;
    }

    if (!allMonitorIceCandidatesCollected || !monitorLocalIceCandidates || monitorLocalIceCandidates.length === 0) {
        console.warn('[processControllerFileAndExport] モニターのICE候補が収集されなかったか、空です。エクスポートデータが不完全かもしれません。');
    }

    // 6. Package and Export Monitor Response Data
    const monitorResponseData = {
        answerSdp: answer.sdp,
        localIceCandidates: monitorLocalIceCandidates
    };
    exportMonitorResponseData(monitorResponseData);
    console.log('[processControllerFileAndExport] 全てのモニター処理完了。');
}

// Updated loadMonitorDataFromFile to trigger the new automated flow
function loadMonitorDataFromFile(event) {
    console.log('[loadMonitorDataFromFile] ファイル入力変更イベント発生。');
    const file = event.target.files[0];
    if (!file) {
        console.warn('[loadMonitorDataFromFile] ファイルが選択されていません。');
        return;
    }
    console.log(`[loadMonitorDataFromFile] ファイル「${file.name}」(${file.type}) を読み込みます。`);

    const reader = new FileReader();
    reader.onload = async function(e) { // Made async to await processControllerFileAndExport
        console.log('[loadMonitorDataFromFile] FileReader onload イベント発生。');
        try {
            const data = JSON.parse(e.target.result);
            console.log('[loadMonitorDataFromFile] ファイル内容パース完了:', data);

            // Expecting controller data format from controller-session-data.json
            if (data.offerSdp && data.localIceCandidates) { // Basic check for controller data
                await processControllerFileAndExport(data);
            } else {
                alert('無効なコントローラーデータファイル形式です。`controller-session-data.json` を選択してください。');
                console.error('[loadMonitorDataFromFile] 無効なファイルタイプ、または必要なフィールドがありません:', data);
            }
        } catch (error) {
            console.error('[loadMonitorDataFromFile] ファイルの読み込みまたは処理中にエラーが発生しました:', error);
            alert('ファイルの読み込みまたは処理中にエラーが発生しました。');
        }
    };
    reader.onerror = function(e) {
        console.error('[loadMonitorDataFromFile] FileReader onerror イベント発生。', e);
        alert('ファイルの読み込み中にエラーが発生しました。');
    };
    reader.readAsText(file);
    console.log('[loadMonitorDataFromFile] reader.readAsText() を呼び出しました。');
    event.target.value = null; // Reset file input
}

// Remove old event listeners for buttons that will be removed from HTML
// setOfferButton.addEventListener('click', setRemoteOffer);
// generateAnswerButton.addEventListener('click', createAnswer);
// addRemoteIceCandidatesMonitorButton.addEventListener('click', addRemoteIceCandidatesMonitor);

if (saveMonitorToFileButton) { // This button will be removed from HTML
    saveMonitorToFileButton.addEventListener('click', saveMonitorDataToFile);
}

if (loadMonitorFromFileButton) { // This button stays, triggers file input
    loadMonitorFromFileButton.addEventListener('click', () => {
        console.log('[loadMonitorFromFileButton] クリックされました。fileMonitorInput をトリガーします。');
        fileMonitorInput.click();
    });
} else {
    console.warn("loadMonitorFromFileButton がDOMに見つかりません。");
}

if (fileMonitorInput) {
    fileMonitorInput.addEventListener('change', loadMonitorDataFromFile);
}

document.addEventListener('DOMContentLoaded', () => {
  // Clear password field or set a placeholder, as it's now auto-filled from controller file
  passwordInput.value = '（コントローラーファイル読込後に表示）'; 
  // Other initializations if needed
});