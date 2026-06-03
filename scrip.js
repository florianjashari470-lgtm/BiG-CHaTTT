const socket = io();
let localStream;
let peerConnection;
const configuration = { 'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}] };

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const statusDiv = document.getElementById('status');
const onlineCount = document.getElementById('online-count');

const startBtn = document.getElementById('startBtn');
const skipBtn = document.getElementById('skipBtn');
const stopBtn = document.getElementById('stopBtn');
const countrySelect = document.getElementById('countrySelect');


// Përditëso numrin e përdoruesve online
socket.on('onlineCount', (count) => {
    onlineCount.innerText = count;
});

// Kur shtyp butonin START
startBtn.onclick = async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        
        startBtn.disabled = true;
        skipBtn.disabled = false;
        stopBtn.disabled = false;
        countrySelect.disabled = true;
        
        findPartner();
    } catch (err) {
        alert("Ju lutem lejoni kamerën dhe mikrofonin!");
    }
};

function findPartner() {
    statusDiv.innerText = "Duke kërkuar për dikë...";
    remoteVideo.srcObject = null;
    if (peerConnection) peerConnection.close();
    
    socket.emit('join', countrySelect.value);
}

// Butoni SKIP (Next)
skipBtn.onclick = () => {
    socket.emit('skip');
    findPartner();
};

// Butoni STOP
stopBtn.onclick = () => {
    socket.emit('skip');
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) peerConnection.close();
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    
    startBtn.disabled = false;
    skipBtn.disabled = true;
    stopBtn.disabled = true;
    countrySelect.disabled = false;
    statusDiv.innerText = "Shtyp 'Start' për të filluar...";
};

// Lidhja me përdoruesin tjetër (WebRTC)
socket.on('matched', async (data) => {
    statusDiv.innerText = "U lidhët!";
    peerConnection = new RTCPeerConnection(configuration);
    
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };
    
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('signal', { 'candidate': event.candidate });
        }
    };
    
    if (data.initiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { 'offer': offer });
    }
});

socket.on('signal', async (data) => {
    if (data.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { 'answer': answer });
    } else if (data.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

socket.on('partnerLeft', () => {
    statusDiv.innerText = "Personi tjetër u largua.";
    remoteVideo.srcObject = null;
    setTimeout(() => {
        findPartner(); // Fillo kërkon automatikisht tjetër
    }, 1500);
});
