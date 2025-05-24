const passwordInput = document.getElementById('password');
const generatePasswordButton = document.getElementById('generatePassword');
const copyPasswordButton = document.getElementById('copyPasswordButton');
const localVideo = document.getElementById('localVideo');
const cameraSelect = document.getElementById('cameraSelect');
const cameraPermissionStatus = document.getElementById('cameraPermissionStatus');
const audioSelect = document.getElementById('audioSelect');
const audioPermissionStatus = document.getElementById('audioPermissionStatus');
const offerSdpTextarea = document.getElementById('offerSdp');
const generateOfferButton = document.getElementById('generateOffer');
const answerSdpTextarea = document.getElementById('answerSdp');
const setAnswerButton = document.getElementById('setAnswer');
const remoteVideo = document.getElementById('remoteVideo');
const localIceCandidatesTextarea = document.getElementById('localIceCandidates');
const remoteIceCandidatesFromMonitorTextarea = document.getElementById('remoteIceCandidatesFromMonitor');
const addRemoteIceCandidatesControllerButton = document.getElementById('addRemoteIceCandidatesController');
const saveToFileButton = document.getElementById('saveToFileButton');
const loadMonitorResponseButton = document.getElementById('loadMonitorResponseButton');
const fileInput = document.getElementById('fileInput');
const startSessionButton = document.getElementById('startSessionButton');

let localStream;
let peerConnection;
let currentCameraId = null;
let currentAudioDeviceId = null;
let allLocalIceCandidatesCollected = false;

function generateRandomPassword(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function copyToClipboard(text, buttonElement) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = buttonElement.textContent;
    buttonElement.textContent = 'コピーしました！';
    buttonElement.disabled = true;
    setTimeout(() => {
      buttonElement.textContent = originalText;
      buttonElement.disabled = false;
    }, 2000);
  }).catch(err => {
    console.error('コピー失敗: ', err);
    const originalText = buttonElement.textContent;
    buttonElement.textContent = '失敗！';
    setTimeout(() => {
      buttonElement.textContent = originalText;
    }, 2000);
  });
}

async function populateDeviceList(kind, selectElement, statusElement, currentDeviceIdRef) {
    const logPrefix = `[populateDeviceList-${kind}]`;
    const kindJP = kind === 'video' ? 'カメラ' : 'マイク';
    console.log(`${logPrefix} ${kindJP}デバイスリストの生成を開始します。`);
    statusElement.textContent = `${kindJP}デバイスを列挙中...`;

    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn(`${logPrefix} enumerateDevices() はサポートされていません。`);
        statusElement.textContent = `${kindJP}の列挙はこのブラウザではサポートされていません。`;
        selectElement.innerHTML = '<option>未サポート</option>';
        return false;
    }

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const filteredDevices = devices.filter(device => device.kind === kind + 'input');
        console.log(`${logPrefix} 発見された全デバイス:`, devices);
        console.log(`${logPrefix} 発見された${kindJP}デバイス:`, filteredDevices);

        const storedSelection = selectElement.value;
        selectElement.innerHTML = '';

        if (filteredDevices.length === 0) {
            console.warn(`${logPrefix} ${kindJP}デバイスが見つかりませんでした。`);
            selectElement.innerHTML = `<option value="">${kindJP}が見つかりません</option>`;
            statusElement.textContent = `${kindJP}が見つかりません。接続または権限を確認してください。`;
            return false;
        }

        filteredDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `${kindJP}デバイス ${index + 1}`;
            console.log(`${logPrefix} デバイス: ${option.text} (${device.deviceId})`);
            selectElement.appendChild(option);
        });

        if (filteredDevices.some(d => d.deviceId === storedSelection)) {
            selectElement.value = storedSelection;
            console.log(`${logPrefix} 前回の${kindJP}選択を復元しました:`, storedSelection);
        } else if (filteredDevices.length > 0) {
            selectElement.value = filteredDevices[0].deviceId;
            console.log(`${logPrefix} 最初の${kindJP}デバイスをデフォルトにします:`, filteredDevices[0].deviceId);
        }
        currentDeviceIdRef.id = selectElement.value;
        statusElement.textContent = filteredDevices.length > 0 ? `${kindJP}を選択してください。` : `${kindJP}が利用できません。`;
        return true;

    } catch (err) {
        console.error(`${logPrefix} ${kindJP}リストの生成エラー:`, err);
        statusElement.textContent = `${kindJP}リストの表示エラー。権限を確認してください。`;
        selectElement.innerHTML = '<option value="">リスト表示エラー</option>';
        return false;
    }
}

async function populateCameraList() {
    return populateDeviceList('video', cameraSelect, cameraPermissionStatus, { get id() { return currentCameraId; }, set id(val) { currentCameraId = val; } });
}

async function populateAudioDeviceList() {
    return populateDeviceList('audio', audioSelect, audioPermissionStatus, { get id() { return currentAudioDeviceId; }, set id(val) { currentAudioDeviceId = val; } });
}

async function startMediaStreams(selectedVideoId, selectedAudioId) {
    console.log(`[startMediaStreams] ストリーム開始試行。要求 VideoId: ${selectedVideoId}, AudioId: ${selectedAudioId}`);
    if (localStream) {
        console.log('[startMediaStreams] 既存のローカルストリームを停止します。');
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    let targetVideoDeviceId = selectedVideoId || cameraSelect.value || currentCameraId;
    let targetAudioDeviceId = selectedAudioId || audioSelect.value || currentAudioDeviceId;
    
    console.log(`[startMediaStreams]最終的な targetVideoDeviceId: ${targetVideoDeviceId}`);
    console.log(`[startMediaStreams]最終的な targetAudioDeviceId: ${targetAudioDeviceId}`);

    const constraints = {
        video: targetVideoDeviceId ? { deviceId: { exact: targetVideoDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } } : false,
        audio: targetAudioDeviceId ? { deviceId: { exact: targetAudioDeviceId } } : false,
    };

    if (!constraints.video && !constraints.audio) {
        console.warn('[startMediaStreams] 開始するビデオまたはオーディオデバイスが選択/利用可能ではありません。');
        cameraPermissionStatus.textContent = 'カメラが選択/利用可能ではありません。';
        audioPermissionStatus.textContent = 'マイクが選択/利用可能ではありません。';
        constraints.video = true; 
        constraints.audio = true;
        console.log('[startMediaStreams] パーミッションプロンプトをトリガーするために汎用メディアリクエストを試みます。');
    }

    console.log('[startMediaStreams] 使用する制約:', JSON.stringify(constraints));

    try {
        if (!constraints.video && !constraints.audio && !(constraints.video === true && constraints.audio === true) ) {
             console.warn('[startMediaStreams] 要求する特定のデバイスがなく、汎用リクエストも行いません。getUserMediaを中止します。');
             if (!targetVideoDeviceId) cameraPermissionStatus.textContent = '開始するカメラがありません。';
             if (!targetAudioDeviceId) audioPermissionStatus.textContent = '開始するマイクがありません。';
             return;
        }

        cameraPermissionStatus.textContent = constraints.video ? 'カメラアクセス要求中...' : 'カメラは要求されていません。';
        audioPermissionStatus.textContent = constraints.audio ? 'マイクアクセス要求中...' : 'マイクは要求されていません。';
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[startMediaStreams] getUserMedia 成功。ストリーム取得。', localStream);
        
        if (constraints.video) {
            localVideo.srcObject = localStream;
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                currentCameraId = videoTrack.getSettings().deviceId || targetVideoDeviceId;
                console.log('[startMediaStreams] アクティブなカメラデバイスID:', currentCameraId);
                cameraPermissionStatus.textContent = 'カメラアクセス許可済み。';
            } else if (constraints.video === true) {
                 cameraPermissionStatus.textContent = 'カメラを要求しましたが、ビデオトラックが見つかりません。';
            }
        } else {
            localVideo.srcObject = null;
            if (!constraints.video && targetVideoDeviceId) cameraPermissionStatus.textContent = 'カメラは要求されませんでした。';
        }

        if (constraints.audio) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                currentAudioDeviceId = audioTrack.getSettings().deviceId || targetAudioDeviceId;
                console.log('[startMediaStreams] アクティブなオーディオデバイスID:', currentAudioDeviceId);
                audioPermissionStatus.textContent = 'マイクアクセス許可済み。';
            } else if (constraints.audio === true) {
                audioPermissionStatus.textContent = 'マイクを要求しましたが、オーディオトラックが見つかりません。';
            }
        } else {
            if (!constraints.audio && targetAudioDeviceId) audioPermissionStatus.textContent = 'マイクは要求されていません。';
        }

        const camListPopulated = await populateCameraList();
        if (camListPopulated && currentCameraId && Array.from(cameraSelect.options).some(o => o.value === currentCameraId)) {
            cameraSelect.value = currentCameraId;
        } else if (camListPopulated && cameraSelect.options.length > 0 && !currentCameraId && constraints.video) {
            // If we requested video but couldn't determine currentCameraId (e.g. no track), select first available
            // This case should be rare if getUserMedia succeeds with a deviceId
            // currentCameraId = cameraSelect.value;
        }
        const micListPopulated = await populateAudioDeviceList();
        if (micListPopulated && currentAudioDeviceId && Array.from(audioSelect.options).some(o => o.value === currentAudioDeviceId)) {
            audioSelect.value = currentAudioDeviceId;
        } else if (micListPopulated && audioSelect.options.length > 0 && !currentAudioDeviceId && constraints.audio) {
            // currentAudioDeviceId = audioSelect.value;
        }
        return true;

    } catch (error) {
        console.error('[startMediaStreams] getUserMedia エラー:', error.name, error.message, error);
        if (constraints.video) localVideo.srcObject = null;
        let camStatus = cameraPermissionStatus.textContent;
        let micStatus = audioPermissionStatus.textContent;

        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            if(constraints.video) camStatus = '選択されたカメラが見つかりません。';
            if(constraints.audio) micStatus = '選択されたマイクが見つかりません。';
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            if(constraints.video) camStatus = 'カメラの権限が拒否されました。';
            if(constraints.audio) micStatus = 'マイクの権限が拒否されました。';
        } else if (error.name === 'OverconstrainedError') {
            const msg = `メディアデバイスが要求された設定をサポートしていません。 ${error.message}`;
            if(constraints.video) camStatus = msg;
            if(constraints.audio) micStatus = msg;
        } else if (error.name === 'NotReadableError') {
            const msg = 'メディアデバイスが既に使用中か、ハードウェアエラーが発生しました。';
            if(constraints.video) camStatus = msg;
            if(constraints.audio) micStatus = msg;
        } else {
            const msg = `エラー: ${error.name}`;
            if(constraints.video) camStatus = msg;
            if(constraints.audio) micStatus = msg;
        }
        if(constraints.video) cameraPermissionStatus.textContent = camStatus;
        if(constraints.audio) audioPermissionStatus.textContent = micStatus;
        
        console.warn('[startMediaStreams] フォールバック: getUserMediaエラー後にリストの生成を試みます。');
        await populateCameraList();
        await populateAudioDeviceList();
        return false;
    }
}

function setupPeerConnection() {
    console.log('[setupPeerConnection] PeerConnection設定を開始します。');
    allLocalIceCandidatesCollected = false;
    localIceCandidatesTextarea.value = '';
    peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const icePromise = new Promise((resolve) => {
        const candidates = [];
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                console.log('[onicecandidate] ICE候補集集中:', event.candidate);
                candidates.push(event.candidate);
            } else {
                console.log('[onicecandidate] 全てのローカルICE候補収集完了。');
                localIceCandidatesTextarea.value = JSON.stringify(candidates, null, 2);
                allLocalIceCandidatesCollected = true;
                resolve(candidates);
            }
        };
    });

    peerConnection.oniceconnectionstatechange = () => {
        console.log('[oniceconnectionstatechange] ICE接続状態変更:', peerConnection.iceConnectionState);
    };

    peerConnection.ontrack = event => {
        console.log('[ontrack] リモートトラック受信:', event.streams[0]);
        remoteVideo.srcObject = event.streams[0];
    };

    if (localStream) {
        localStream.getTracks().forEach(track => {
            console.log(`[setupPeerConnection] ローカルトラックを追加中: ${track.kind}`);
            try {
                 peerConnection.addTrack(track, localStream);
            } catch (e) {
                console.error("[setupPeerConnection] addTrack Error:", e);
            }
        });
    } else {
        console.warn('[setupPeerConnection] ローカルストリームが利用できません。トラックは追加されません。');
    }
    return icePromise;
}

async function createOffer() {
    if (!localStream) {
        alert('ローカルメディアストリームが開始されていません。まずデバイスへのアクセスを許可してください。');
        console.warn('[createOffer] ローカルストリームがありません。オファー生成を中止します。');
        return null;
    }
    if (!peerConnection) {
        console.log('[createOffer] PeerConnectionが初期化されていません。setupPeerConnectionを呼び出します。');
        setupPeerConnection();
    } else {
        console.log('[createOffer] 既存のPeerConnectionを使用します。');
    }

    console.log('[createOffer] オファーを生成します。');
    try {
        const offer = await peerConnection.createOffer();
        console.log('[createOffer] オファー生成成功。ローカルディスクリプションとして設定します。');
        await peerConnection.setLocalDescription(offer);
        offerSdpTextarea.value = offer.sdp;
        console.log('[createOffer] ローカルディスクリプション設定完了。オファーSDP:', offer.sdp);
        return offer;
    } catch (error) {
        console.error('[createOffer] オファー生成または設定エラー:', error);
        offerSdpTextarea.value = `オファー生成エラー: ${error.toString()}`;
        return null;
    }
}

async function setRemoteAnswer(answerSdpString) {
    if (!peerConnection) {
        alert('PeerConnectionが初期化されていません。まずコントローラーセッションを開始してください。');
        console.error('[setRemoteAnswer] PeerConnection not initialized.');
        return false;
    }
    if (!answerSdpString) {
        alert('モニターからのアンサーSDPが提供されていません。');
        console.error('[setRemoteAnswer] Answer SDP string is empty.');
        return false;
    }
    console.log('[setRemoteAnswer] モニターのアンサーSDPを設定します:', answerSdpString);
    try {
        const answer = new RTCSessionDescription({ type: 'answer', sdp: answerSdpString });
        await peerConnection.setRemoteDescription(answer);
        console.log('[setRemoteAnswer] リモートアンサー設定完了。');
        answerSdpTextarea.value = answerSdpString; // Update textarea for display
        return true;
    } catch (error) {
        console.error('[setRemoteAnswer] リモートアンサーSDPの設定エラー:', error);
        alert('リモートアンサーSDPの設定エラーです。コンソールを確認してください。');
        return false;
    }
}

async function addRemoteIceCandidatesController(candidates) {
    if (!peerConnection) {
        alert('PeerConnectionが初期化されていません。まずコントローラーセッションを開始し、アンサーを設定してください。');
        console.error('[addRemoteIceCandidatesController] PeerConnection not initialized.');
        return false;
    }
    if (!candidates || !Array.isArray(candidates)) {
        console.warn('[addRemoteIceCandidatesController] 無効なICE候補データです。', candidates);
        alert('提供されたICE候補の形式が無効です。');
        return false;
    }
    console.log('[addRemoteIceCandidatesController] モニターからのリモートICE候補を追加します:', candidates);
    remoteIceCandidatesFromMonitorTextarea.value = JSON.stringify(candidates, null, 2); // Update textarea for display
    try {
        for (const candidate of candidates) {
            if (candidate) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('[addRemoteIceCandidatesController] リモートICE候補追加成功:', candidate);
            }
        }
        console.log('[addRemoteIceCandidatesController] 全てのリモートICE候補の追加処理完了。');
        return true;
    } catch (error) {
        console.error('[addRemoteIceCandidatesController] リモートICE候補の追加エラー:', error);
        alert('リモートICE候補の追加中にエラーが発生しました。コンソールを確認してください。');
        return false;
    }
}

function exportControllerData(data) {
    console.log('[exportControllerData] コントローラーデータをエクスポートします:', data);
    try {
        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'controller-session-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('[exportControllerData] controller-session-data.json のダウンロードを開始しました。');
    } catch (error) {
        console.error('[exportControllerData] データのエクスポート失敗:', error);
        alert('コントローラーデータのエクスポートに失敗しました。コンソールを確認してください。');
    }
}

async function startControllerSessionAndExport() {
    console.log('[startControllerSessionAndExport] コントローラーセッション開始とデータエクスポート処理を開始します。');
    if(startSessionButton) startSessionButton.disabled = true;

    const password = generateRandomPassword();
    passwordInput.value = password;
    console.log('[startControllerSessionAndExport] パスワード生成完了:', password);

    const selectedVideoId = cameraSelect.value;
    const selectedAudioId = audioSelect.value;
    const mediaStarted = await startMediaStreams(selectedVideoId, selectedAudioId);
    if (!mediaStarted) {
        alert('メディアストリームの開始に失敗しました。カメラ/マイクの権限と接続を確認してください。');
        console.error('[startControllerSessionAndExport] メディアストリームの開始失敗。処理を中止します。');
        if(startSessionButton) startSessionButton.disabled = false;
        return;
    }
    console.log('[startControllerSessionAndExport] メディアストリーム開始完了。');

    const iceGatheringPromise = setupPeerConnection();
    console.log('[startControllerSessionAndExport] PeerConnection設定完了。ICE候補収集中...');

    const offer = await createOffer();
    if (!offer) {
        alert('オファーの生成に失敗しました。コンソールを確認してください。');
        console.error('[startControllerSessionAndExport] オファー生成失敗。処理を中止します。');
        if(startSessionButton) startSessionButton.disabled = false;
        return;
    }
    console.log('[startControllerSessionAndExport] オファー生成完了。SDP:', offer.sdp);

    let localIceCandidates;
    try {
        localIceCandidates = await iceGatheringPromise;
        console.log('[startControllerSessionAndExport] 全てのICE候補収集完了:', localIceCandidates); 
    } catch (error) {
        alert('ICE候補の収集に失敗しました。コンソールを確認してください。');
        console.error('[startControllerSessionAndExport] ICE候補収集失敗:', error);
        if(startSessionButton) startSessionButton.disabled = false;
        return;
    }
    
    if (!allLocalIceCandidatesCollected || !localIceCandidates || localIceCandidates.length === 0) {
        console.warn('[startControllerSessionAndExport] ICE候補が収集されなかったか、空です。エクスポートデータが不完全かもしれません。');
    }

    const controllerData = {
        password: password,
        offerSdp: offer.sdp,
        localIceCandidates: localIceCandidates
    };
    exportControllerData(controllerData);

    alert('コントローラーセッションデータがエクスポートされました (controller-session-data.json)。このファイルをモニターに渡してください。');
    if(startSessionButton) startSessionButton.disabled = false;
    console.log('[startControllerSessionAndExport] 全てのコントローラー処理完了。');
}

async function initializeApp() {
    console.log('[initializeApp] アプリケーションの初期化を開始します。');
    await populateCameraList();
    await populateAudioDeviceList();

    let startVideoId = (cameraSelect.options.length > 0 && cameraSelect.value !== "") ? cameraSelect.value : null;
    let startAudioId = (audioSelect.options.length > 0 && audioSelect.value !== "") ? audioSelect.value : null;

    if (startVideoId || startAudioId) {
        console.log(`[initializeApp] リストにデバイスが見つかりました。メディアストリームを開始します。 Video: ${startVideoId}, Audio: ${startAudioId}`);
        await startMediaStreams(startVideoId, startAudioId);
    } else {
        console.warn('[initializeApp] 初期デバイスが見つからないかリストが空です。汎用プロンプトのためにstartMediaStreamsを呼び出します。');
        await startMediaStreams();
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);

if (generatePasswordButton) {
    generatePasswordButton.addEventListener('click', () => {
        passwordInput.value = generateRandomPassword();
        console.log('パスワード生成ボタン(旧)がクリックされました。新しいフローでは自動化されます。');
    });
}
if (copyPasswordButton) {
    copyPasswordButton.addEventListener('click', () => {
        if (passwordInput.value) {
            copyToClipboard(passwordInput.value, copyPasswordButton);
        } else {
            alert('コピーするパスワードがありません。');
        }
    });
}

if (startSessionButton) {
    startSessionButton.addEventListener('click', startControllerSessionAndExport);
} else {
    console.warn("startSessionButton がDOMに見つかりません。");
}

if (generateOfferButton) {
    generateOfferButton.addEventListener('click', async () => {
        console.log('オファー生成ボタン(旧)がクリックされました。新しいフローでは自動化されます。');
        if (!localStream) {
            alert('まず「コントローラーセッション開始」ボタンを押してメディアを開始してください。');
            return;
        }
        const icePromise = setupPeerConnection();
        const offer = await createOffer();
        if(offer) {
            console.log("手動オファー生成成功。ICE候補を待ちます...");
            await icePromise;
            console.log("手動ICE収集完了。");
        }
    });
}

function saveDataToFile() {
    console.log('[saveDataToFile] この関数は新しいフローでは直接使用されません。代わりに exportControllerData を使用してください。');
    alert('この保存機能は更新中です。自動エクスポートを使用してください。');
}

if (saveToFileButton) {
    saveToFileButton.addEventListener('click', saveDataToFile);
}

async function loadDataFromFile(event) {
    console.log('[loadDataFromFile] ファイル読み込みがトリガーされました (モニター応答処理)。');
    const file = event.target.files[0];
    if (!file) {
        console.warn('[loadDataFromFile] ファイルが選択されていません。');
        event.target.value = null; // Reset file input
        return;
    }
    console.log(`[loadDataFromFile] ファイル「${file.name}」(${file.type}) を読み込みます。`);

    const reader = new FileReader();
    reader.onload = async function(e) { // Made async to await processing
        console.log('[loadDataFromFile] FileReader onload イベント発生。');
        try {
            const data = JSON.parse(e.target.result);
            console.log('[loadDataFromFile] ファイル内容パース完了 (モニター応答):', data);

            if (data.answerSdp && data.localIceCandidates) { // Check for monitor response data structure
                console.log('[loadDataFromFile] モニター応答データを処理中...');
                
                // 1. Set Remote Answer
                const answerSet = await setRemoteAnswer(data.answerSdp);
                if (!answerSet) {
                    console.error('[loadDataFromFile] モニターのアンサー設定に失敗しました。接続処理を中止します。');
                    // Optionally, re-enable the load button or provide specific UI feedback
                    alert('モニターのアンサー設定に失敗しました。');
                    return;
                }
                console.log('[loadDataFromFile] モニターのアンサー設定完了。');

                // 2. Add Remote ICE Candidates (from monitor)
                const iceAdded = await addRemoteIceCandidatesController(data.localIceCandidates);
                if (!iceAdded) {
                    console.warn('[loadDataFromFile] モニターのICE候補の追加に失敗または一部失敗した可能性があります。');
                    // Connection might still work with partial ICE, so don't necessarily stop
                    // alert('モニターのICE候補の追加に失敗しました。');
                }
                console.log('[loadDataFromFile] モニターのICE候補の追加処理完了。接続が確立されるはずです。');
                alert('モニター応答ファイルを処理しました。リモートビデオの接続を確認してください。');

            } else {
                alert('無効なモニター応答ファイル形式です。`monitor-response-data.json` を選択してください。');
                console.error('[loadDataFromFile] 無効なモニター応答ファイルタイプ、または必要なフィールドがありません:', data);
            }
        } catch (error) {
            console.error('[loadDataFromFile] モニター応答ファイルの読み込みまたは処理中にエラーが発生しました:', error);
            alert('モニター応答ファイルの読み込みまたは処理中にエラーが発生しました。');
        }
    };
    reader.onerror = function(e) {
        console.error('[loadDataFromFile] FileReader onerror イベント発生。', e);
        alert('ファイルの読み込み中にエラーが発生しました。');
    };
    reader.readAsText(file);
    console.log('[loadDataFromFile] reader.readAsText() を呼び出しました。');
    event.target.value = null; // Reset file input
}

if (loadMonitorResponseButton) {
    loadMonitorResponseButton.addEventListener('click', () => {
        console.log('「モニター応答ファイル選択」ボタンがクリックされました。fileInput をトリガーします。');
        fileInput.click();
    });
} else {
    console.warn("loadMonitorResponseButton がDOMに見つかりません。");
}

if (fileInput) {
    fileInput.addEventListener('change', loadDataFromFile);
}

if (cameraSelect) {
    cameraSelect.addEventListener('change', async () => {
        currentCameraId = cameraSelect.value;
        console.log(`カメラ選択変更: ${currentCameraId}. メディアストリームを再起動します。`);
        await startMediaStreams(currentCameraId, currentAudioDeviceId);
    });
}

if (audioSelect) {
    audioSelect.addEventListener('change', async () => {
        currentAudioDeviceId = audioSelect.value;
        console.log(`マイク選択変更: ${currentAudioDeviceId}. メディアストリームを再起動します。`);
        await startMediaStreams(currentCameraId, currentAudioDeviceId);
    });
}
