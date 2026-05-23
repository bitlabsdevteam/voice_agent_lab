const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const statusEl = document.querySelector("#status");
const eventsEl = document.querySelector("#events");
const remoteAudio = document.querySelector("#remoteAudio");

let peerConnection;
let localStream;
let dataChannel;

startButton.addEventListener("click", () => {
  startVoiceSession().catch((error) => {
    setStatus(`Failed: ${error.message}`);
    stopVoiceSession();
  });
});

stopButton.addEventListener("click", () => {
  stopVoiceSession();
  setStatus("Stopped. Session resources were released.");
});

async function startVoiceSession() {
  setStatus("Requesting ephemeral voice session from backend...");
  const tenantId = document.querySelector("#tenantId").value.trim();
  const userId = document.querySelector("#userId").value.trim();

  const sessionResponse = await fetch("/api/voice/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": tenantId,
      "x-user-id": userId,
      "x-scopes": "voice:session:create policy:read"
    },
    body: JSON.stringify({
      channel: "web",
      tenantId,
      userId,
      consentState: "denied"
    })
  });

  if (!sessionResponse.ok) {
    throw new Error(await sessionResponse.text());
  }

  const session = await sessionResponse.json();
  appendEvent({ type: "session.created", sessionId: session.sessionId, provider: session.config.provider });

  if (session.config.provider.startsWith("mock-")) {
    setStatus("Mock session created. Switch the backend to the live OpenAI provider for real WebRTC.");
    startButton.disabled = false;
    stopButton.disabled = true;
    return;
  }

  if (session.config.provider === "elevenlabs") {
    startElevenLabsSession(session);
    return;
  }

  setStatus("Opening microphone...");
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  peerConnection = new RTCPeerConnection();
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
  };

  dataChannel = peerConnection.createDataChannel("oai-events");
  dataChannel.addEventListener("message", (event) => {
    appendEvent(JSON.parse(event.data));
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  setStatus("Connecting to OpenAI Realtime over WebRTC...");
  const realtimeResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.clientSecret}`,
      "content-type": "application/sdp"
    },
    body: offer.sdp
  });

  if (!realtimeResponse.ok) {
    throw new Error(await realtimeResponse.text());
  }

  await peerConnection.setRemoteDescription({
    type: "answer",
    sdp: await realtimeResponse.text()
  });

  startButton.disabled = true;
  stopButton.disabled = false;
  setStatus("Connected. You can speak now.");
}

function startElevenLabsSession(session) {
  setStatus("Connecting to ElevenLabs agent over signed WebSocket...");
  dataChannel = new WebSocket(session.clientSecret);
  dataChannel.addEventListener("open", () => {
    appendEvent({ type: "elevenlabs.connected", sessionId: session.sessionId });
    dataChannel.send(
      JSON.stringify({
        type: "conversation_initiation_client_data",
        dynamic_variables: {
          session_id: session.sessionId
        }
      })
    );
    setStatus("Connected to ElevenLabs agent. Audio streaming can be enabled with microphone chunking.");
  });
  dataChannel.addEventListener("message", (event) => {
    appendEvent(JSON.parse(event.data));
  });
  startButton.disabled = true;
  stopButton.disabled = false;
}

function stopVoiceSession() {
  if (dataChannel) {
    dataChannel.close();
  }
  if (peerConnection) {
    peerConnection.close();
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  dataChannel = undefined;
  peerConnection = undefined;
  localStream = undefined;
  startButton.disabled = false;
  stopButton.disabled = true;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function appendEvent(event) {
  const current = JSON.parse(eventsEl.textContent);
  current.push(event);
  eventsEl.textContent = JSON.stringify(current.slice(-20), null, 2);
}
