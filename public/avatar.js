const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const statusEl = document.querySelector("#status");
const remoteAudio = document.querySelector("#remoteAudio");
const shell = document.querySelector(".avatar-shell");
const avatarStage = document.querySelector(".avatar-stage");
const canvas = document.querySelector("#avatarCanvas");
const avatarFileButton = document.querySelector("#avatarFileButton");
const avatarFileInput = document.querySelector("#avatarFileInput");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const DEFAULT_AVATAR_IMAGE_PATH = "/assets/ayaka.png";
const avatarRuntime = globalThis.AvatarRuntime || {};
const applyControlValue = avatarRuntime.applyControlValue || (() => {});
const createFacialAnimationState =
  avatarRuntime.createFacialAnimationState ||
  (() => ({
    mouthOpen: 0
  }));
const detectFacialControls =
  avatarRuntime.detectFacialControls ||
  (() => ({
    blinkLeft: [],
    blinkRight: [],
    mouthOpen: [],
    visemes: {}
  }));
const stepFacialAnimation =
  avatarRuntime.stepFacialAnimation ||
  (() => ({
    blinkLeft: 0,
    blinkRight: 0,
    mouthOpen: 0,
    visemes: {}
  }));

let peerConnection;
let localStream;
let dataChannel;
let avatarState = "idle";

startButton.addEventListener("click", () => {
  startVoiceSession().catch((error) => {
    setStatus(`Failed: ${error.message}`, "error");
    stopVoiceSession();
  });
});

stopButton.addEventListener("click", () => {
  stopVoiceSession();
  setStatus("Stopped. Session resources were released.", "stopped");
});

startAvatarScene();

async function startVoiceSession() {
  startButton.disabled = true;
  stopButton.disabled = false;
  setStatus("Requesting ephemeral voice session from backend...", "connecting");

  const tenantId = "tenant_demo";
  const userId = "user_demo";
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

  if (session.config.provider.startsWith("mock-")) {
    setStatus("Mock session created. Open Operations for detailed runtime logs.", "stopped");
    startButton.disabled = false;
    stopButton.disabled = true;
    return;
  }

  if (session.config.provider === "elevenlabs") {
    startElevenLabsSession(session);
    return;
  }

  setStatus("Opening microphone...", "connecting");
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  peerConnection = new RTCPeerConnection();
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.onplaying = () => setAvatarState("speaking");
    remoteAudio.onpause = () => setAvatarState("listening");
  };

  dataChannel = peerConnection.createDataChannel("oai-events");
  dataChannel.addEventListener("message", (event) => {
    handleProviderEvent(JSON.parse(event.data));
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  setStatus("Connecting to OpenAI Realtime over WebRTC...", "connecting");
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

  setStatus("Connected. Aiko is listening.", "listening");
}

function startElevenLabsSession(session) {
  setStatus("Connecting to ElevenLabs agent over signed WebSocket...", "connecting");
  dataChannel = new WebSocket(session.clientSecret);
  dataChannel.addEventListener("open", () => {
    dataChannel.send(
      JSON.stringify({
        type: "conversation_initiation_client_data",
        dynamic_variables: {
          session_id: session.sessionId
        }
      })
    );
    setStatus("Connected to ElevenLabs agent. Aiko is listening.", "listening");
  });
  dataChannel.addEventListener("message", (event) => {
    handleProviderEvent(JSON.parse(event.data));
  });
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
  if (avatarState !== "error") {
    setAvatarState("idle");
  }
}

function handleProviderEvent(event) {
  if (!event || typeof event.type !== "string") {
    return;
  }
  if (event.type.includes("speech_started") || event.type.includes("input_audio")) {
    setAvatarState("listening");
  }
  if (event.type.includes("response.audio") || event.type.includes("audio.delta")) {
    setAvatarState("speaking");
  }
  if (event.type.includes("response.completed") || event.type.includes("response.done")) {
    setAvatarState("listening");
  }
  if (event.type.includes("error")) {
    setStatus("Provider event reported an error. Check Operations for details.", "error");
  }
}

function setStatus(message, state = avatarState) {
  statusEl.textContent = message;
  setAvatarState(state);
}

function setAvatarState(state) {
  avatarState = state;
  shell.dataset.avatarState = state;
}

async function startAvatarScene() {
  try {
    const [THREE, gltfModule] = await Promise.all([
      import("https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js"),
      import("https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/loaders/GLTFLoader.js")
    ]);
    buildThreeAvatar(THREE, gltfModule.GLTFLoader);
  } catch {
    buildCanvasFallback();
  }
}

function buildThreeAvatar(THREE, GLTFLoader) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 1.25, 8);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const keyLight = new THREE.DirectionalLight(0xfff4e0, 3.2);
  keyLight.position.set(3, 5, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x78d3c7, 1.4);
  fillLight.position.set(-4, 2, 3);
  scene.add(fillLight);
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));

  let activeAvatar = {
    root: new THREE.Group(),
    type: "procedural",
    mixer: undefined,
    baseScale: 1,
    mouth: undefined,
    leftEye: undefined,
    rightEye: undefined,
    mouthOpen: undefined,
    blinkLeft: undefined,
    blinkRight: undefined,
    visemes: {}
  };
  const avatar = activeAvatar.root;
  scene.add(avatar);
  const facialAnimation = createFacialAnimationState({ reducedMotion: prefersReducedMotion.matches });

  const skin = new THREE.MeshStandardMaterial({ color: 0xf0c8ad, roughness: 0.56, metalness: 0.02 });
  const blush = new THREE.MeshStandardMaterial({ color: 0xe9a99d, roughness: 0.9, transparent: true, opacity: 0.34 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x11100f, roughness: 0.72 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xfff5e7, roughness: 0.62 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x0e5f58, roughness: 0.48 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.55 });
  const lip = new THREE.MeshStandardMaterial({ color: 0x9f4e48, roughness: 0.5 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(1.22, 1.2, 10, 26), ivory);
  torso.position.set(0, -1.92, 0);
  torso.scale.set(1.18, 0.74, 0.54);
  avatar.add(torso);

  const collar = new THREE.Mesh(new THREE.ConeGeometry(1.02, 0.9, 4), teal);
  collar.position.set(0, -1.27, 0.1);
  collar.rotation.y = Math.PI / 4;
  collar.scale.set(1, 0.38, 0.44);
  avatar.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.72, 28), skin);
  neck.position.set(0, -0.78, 0);
  avatar.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(1.02, 48, 48), skin);
  head.position.set(0, 0.15, 0);
  head.scale.set(0.88, 1.05, 0.78);
  avatar.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(1.06, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.72), hair);
  hairCap.position.set(0, 0.46, -0.03);
  hairCap.scale.set(0.94, 0.82, 0.84);
  avatar.add(hairCap);

  const backHair = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 1.7, 12, 32), hair);
  backHair.position.set(0, -0.24, -0.34);
  backHair.scale.set(0.86, 1, 0.32);
  avatar.add(backHair);

  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 18), hair);
  fringe.position.set(-0.24, 0.78, 0.52);
  fringe.scale.set(1.2, 0.42, 0.22);
  fringe.rotation.z = -0.18;
  avatar.add(fringe);

  const leftEye = makeEye(THREE, dark, -0.32);
  const rightEye = makeEye(THREE, dark, 0.32);
  avatar.add(leftEye, rightEye);
  activeAvatar.leftEye = leftEye;
  activeAvatar.rightEye = rightEye;

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.035), lip);
  mouth.position.set(0, -0.28, 0.78);
  avatar.add(mouth);
  activeAvatar.mouth = mouth;

  const leftBlush = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 12), blush);
  leftBlush.position.set(-0.52, -0.16, 0.68);
  leftBlush.scale.set(1.3, 0.45, 0.12);
  const rightBlush = leftBlush.clone();
  rightBlush.position.x = 0.52;
  avatar.add(leftBlush, rightBlush);

  const headset = new THREE.Group();
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.026, 8, 64, Math.PI), dark);
  band.position.set(0, 0.45, 0);
  band.rotation.z = Math.PI;
  const leftCup = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), teal);
  leftCup.position.set(-0.88, 0.1, 0.02);
  leftCup.scale.set(0.45, 0.8, 0.28);
  const rightCup = leftCup.clone();
  rightCup.position.x = 0.88;
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.82, 12), dark);
  boom.position.set(0.72, -0.28, 0.42);
  boom.rotation.z = -0.82;
  boom.rotation.x = 0.3;
  headset.add(band, leftCup, rightCup, boom);
  avatar.add(headset);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.78, 0.018, 12, 96),
    new THREE.MeshStandardMaterial({ color: 0x78d3c7, emissive: 0x0e5f58, emissiveIntensity: 0.26 })
  );
  ring.position.set(0, -0.05, -0.8);
  scene.add(ring);

  const loader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  setupAvatarDropzone(loadDroppedAvatar);
  loadDefaultAvatarImage().catch(() => {
    setStatusMessage("Default portrait could not be loaded. Using the fallback avatar.");
  });

  async function loadDefaultAvatarImage() {
    const texture = await loadTexture(textureLoader, DEFAULT_AVATAR_IMAGE_PATH);
    const nextAvatar = buildPortraitAvatar(THREE, texture);
    scene.remove(activeAvatar.root);
    disposeAvatarRoot(activeAvatar.root);
    activeAvatar = nextAvatar;
    scene.add(activeAvatar.root);
    markAvatarLoadState("loaded");
  }

  async function loadDroppedAvatar(file) {
    markAvatarLoadState("loading");
    setStatusMessage(`Loading ${file.name}...`);

    try {
      const gltf = await loadGltfFile(loader, file);
      const builtAvatar = buildDroppedAvatarRoot(THREE, gltf);
      const facialControls = detectFacialControls(builtAvatar.model);
      const fallbackFace = attachFallbackFace(THREE, builtAvatar.root, builtAvatar.metrics, {
        mouth: facialControls.mouthOpen.length === 0,
        blink: facialControls.blinkLeft.length === 0 || facialControls.blinkRight.length === 0
      });
      const nextAvatar = {
        root: builtAvatar.root,
        type: "model",
        mixer: createAnimationMixer(THREE, gltf),
        baseScale: builtAvatar.root.scale.x,
        mouth: fallbackFace ? fallbackFace.mouth : undefined,
        leftEye: fallbackFace ? fallbackFace.leftEye : undefined,
        rightEye: fallbackFace ? fallbackFace.rightEye : undefined,
        mouthOpen: facialControls.mouthOpen,
        blinkLeft: facialControls.blinkLeft,
        blinkRight: facialControls.blinkRight,
        visemes: facialControls.visemes
      };

      scene.remove(activeAvatar.root);
      disposeAvatarRoot(activeAvatar.root);
      activeAvatar = nextAvatar;
      scene.add(activeAvatar.root);
      markAvatarLoadState("loaded");
      setStatusMessage(
        facialControls.blinkLeft.length > 0 || facialControls.mouthOpen.length > 0
          ? `Loaded ${file.name} with facial controls. Voice session state is preserved.`
          : `Loaded ${file.name}. Using fallback blink and mouth animation.`
      );
    } catch (error) {
      console.error(error);
      markAvatarLoadState("error");
      const reason = error instanceof Error ? error.message : "Unknown model error";
      setStatusMessage(`The 3D avatar could not be loaded. ${reason}`);
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(rect.height, 1);
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  resize();

  const clock = new THREE.Clock();
  function render() {
    const delta = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const motionScale = prefersReducedMotion.matches ? 0.18 : 1;
    const speaking = avatarState === "speaking";
    const listening = avatarState === "listening";
    const connecting = avatarState === "connecting";
    const idle = avatarState === "idle" || avatarState === "stopped";
    const root = activeAvatar.root;

    if (activeAvatar.mixer) {
      activeAvatar.mixer.update(delta);
    }

    const facialFrame = stepFacialAnimation({
      animationState: facialAnimation,
      avatarState,
      deltaSeconds: delta,
      nowMs: performance.now(),
      reducedMotion: prefersReducedMotion.matches,
      visemeNames: Object.keys(activeAvatar.visemes || {})
    });

    root.position.y = Math.sin(t * 1.4) * 0.035 * motionScale;
    root.rotation.y = Math.sin(t * 0.48) * 0.08 * motionScale;
    root.rotation.x = listening ? -0.06 : Math.sin(t * 0.38) * 0.025 * motionScale;
    root.scale.setScalar(activeAvatar.baseScale * (speaking && activeAvatar.type === "model" ? 1 + Math.sin(t * 16) * 0.018 * motionScale : 1));
    if (activeAvatar.type === "image") {
      root.position.x = 2.12 + Math.sin(t * 0.34) * 0.06 * motionScale;
      root.position.y = -0.26 + Math.sin(t * 1.15) * 0.08 * motionScale;
      root.rotation.y = -0.22 + Math.sin(t * 0.44) * 0.06 * motionScale;
      root.rotation.x = -0.02 + (listening ? -0.04 : 0) + Math.sin(t * 0.31) * 0.02 * motionScale;
      root.scale.setScalar(
        activeAvatar.baseScale *
          (speaking
            ? 1 + Math.sin(t * 10) * 0.012 * motionScale
            : connecting
              ? 1.02 + Math.sin(t * 3.4) * 0.012 * motionScale
              : idle
                ? 1
                : 1.01)
      );
    }
    ring.rotation.z += (connecting ? 0.026 : 0.006) * motionScale;
    ring.scale.setScalar(listening ? 1.04 + Math.sin(t * 4) * 0.025 : 1);
    if (activeAvatar.mouthOpen && activeAvatar.mouthOpen.length > 0) {
      applyControlValue(activeAvatar.mouthOpen, facialFrame.mouthOpen);
    }
    if (activeAvatar.blinkLeft && activeAvatar.blinkLeft.length > 0) {
      applyControlValue(activeAvatar.blinkLeft, facialFrame.blinkLeft);
    }
    if (activeAvatar.blinkRight && activeAvatar.blinkRight.length > 0) {
      applyControlValue(activeAvatar.blinkRight, facialFrame.blinkRight);
    }
    Object.entries(activeAvatar.visemes || {}).forEach(([name, bindings]) => {
      applyControlValue(bindings, facialFrame.visemes[name] || 0);
    });
    if (activeAvatar.mouth) {
      activeAvatar.mouth.scale.y = 1 + facialFrame.mouthOpen * (prefersReducedMotion.matches ? 2.8 : 5.8);
      activeAvatar.mouth.scale.x = 0.96 - facialFrame.mouthOpen * (prefersReducedMotion.matches ? 0.18 : 0.34);
    }
    if (activeAvatar.leftEye) {
      activeAvatar.leftEye.scale.y = eyeScaleForBlinkAmount(facialFrame.blinkLeft);
    }
    if (activeAvatar.rightEye) {
      activeAvatar.rightEye.scale.y = eyeScaleForBlinkAmount(facialFrame.blinkRight);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  render();
}

function makeEye(THREE, material, x) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 12), material);
  eye.position.set(x, 0.18, 0.74);
  eye.scale.set(1.7, 0.52, 0.28);
  return eye;
}

function eyeScaleForBlinkAmount(blinkAmount) {
  const openScale = 0.52;
  const closedScale = prefersReducedMotion.matches ? 0.18 : 0.06;
  return openScale - Math.min(Math.max(blinkAmount, 0), 1) * (openScale - closedScale);
}

function loadTexture(loader, path) {
  return new Promise((resolve, reject) => {
    loader.load(path, resolve, undefined, reject);
  });
}

function setupAvatarDropzone(loadAvatar) {
  if (!avatarStage) {
    return;
  }

  const preventWindowFileDrop = (event) => {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
  };

  window.addEventListener("dragover", preventWindowFileDrop);
  window.addEventListener("drop", preventWindowFileDrop);

  avatarStage.addEventListener("dragover", (event) => {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    avatarStage.classList.add("is-drag-active");
  });

  avatarStage.addEventListener("dragenter", (event) => {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    avatarStage.classList.add("is-drag-active");
  });

  avatarStage.addEventListener("dragleave", (event) => {
    if (avatarStage.contains(event.relatedTarget)) {
      return;
    }
    avatarStage.classList.remove("is-drag-active");
  });

  avatarStage.addEventListener("drop", (event) => {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    avatarStage.classList.remove("is-drag-active");

    const file = event.dataTransfer && event.dataTransfer.files[0];
    maybeLoadAvatarFile(file, loadAvatar);
  });

  if (avatarFileButton && avatarFileInput) {
    avatarFileButton.addEventListener("click", () => {
      avatarFileInput.click();
    });

    avatarFileInput.addEventListener("change", () => {
      const file = avatarFileInput.files && avatarFileInput.files[0];
      maybeLoadAvatarFile(file, loadAvatar);
      avatarFileInput.value = "";
    });
  }
}

function isAvatarModelFile(file) {
  const name = file.name.toLowerCase();
  return name.endsWith(".glb") || name.endsWith(".gltf");
}

function hasDraggedFiles(event) {
  const types = event.dataTransfer && event.dataTransfer.types;
  return Boolean(types && Array.from(types).includes("Files"));
}

function maybeLoadAvatarFile(file, loadAvatar) {
  if (!file) {
    return;
  }

  if (!isAvatarModelFile(file)) {
    markAvatarLoadState("error");
    setStatusMessage("Unsupported avatar file. Choose a .glb or .gltf model.");
    return;
  }

  loadAvatar(file);
}

function setStatusMessage(message) {
  statusEl.textContent = message;
}

function markAvatarLoadState(state) {
  if (!avatarStage) {
    return;
  }
  avatarStage.classList.toggle("is-drag-active", state === "dragging");
  avatarStage.classList.toggle("has-load-error", state === "error");
}

async function loadGltfFile(loader, file) {
  const lowerName = file.name.toLowerCase();
  const source = lowerName.endsWith(".glb") ? await file.arrayBuffer() : await file.text();

  return new Promise((resolve, reject) => {
    loader.parse(source, "", resolve, (error) => {
      const message = error instanceof Error ? error.message : String(error || "Unknown model parse error");
      reject(new Error(message));
    });
  });
}

function buildDroppedAvatarRoot(THREE, gltf) {
  const root = new THREE.Group();
  const model = gltf.scene;
  root.add(model);
  const metrics = frameModelInAvatarStage(THREE, model, root);
  return { root, model, metrics };
}

function buildPortraitAvatar(THREE, texture) {
  const root = new THREE.Group();
  const imageAspect = texture.image && texture.image.width && texture.image.height ? texture.image.width / texture.image.height : 1;
  const portraitHeight = 4.65;
  const portraitWidth = portraitHeight * imageAspect;

  texture.colorSpace = THREE.SRGBColorSpace;

  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(portraitWidth + 0.12, portraitHeight + 0.12),
    new THREE.MeshStandardMaterial({
      color: 0xfff4ea,
      transparent: true,
      opacity: 0.96
    })
  );
  frame.position.z = -0.03;

  const portrait = new THREE.Mesh(
    new THREE.PlaneGeometry(portraitWidth, portraitHeight),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.04
    })
  );

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1.92, 48),
    new THREE.MeshBasicMaterial({
      color: 0xf8b089,
      transparent: true,
      opacity: 0.17
    })
  );
  glow.position.set(0, 0.18, -0.08);
  glow.scale.set(1.4, 1.7, 1);

  root.add(glow, frame, portrait);
  root.position.set(2.12, -0.26, 0.9);

  return {
    root,
    type: "image",
    mixer: undefined,
    baseScale: 0.9,
    mouth: undefined,
    leftEye: undefined,
    rightEye: undefined,
    mouthOpen: undefined,
    blinkLeft: undefined,
    blinkRight: undefined,
    visemes: {}
  };
}

function frameModelInAvatarStage(THREE, model, root) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) {
    root.scale.setScalar(1);
    return {
      size: new THREE.Vector3(1, 1, 1),
      depthOffset: 0.5,
      eyeY: 0.2,
      mouthY: -0.15,
      eyeOffsetX: 0.2
    };
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
  model.position.sub(center);
  root.scale.setScalar(3.45 / maxDimension);
  root.position.set(0, 0, 0);
  return {
    size,
    depthOffset: size.z * 0.52,
    eyeY: size.y * 0.19,
    mouthY: -size.y * 0.08,
    eyeOffsetX: size.x * 0.11
  };
}

function createAnimationMixer(THREE, gltf) {
  if (!gltf.animations || gltf.animations.length === 0) {
    return undefined;
  }

  const mixer = new THREE.AnimationMixer(gltf.scene);
  gltf.animations.forEach((clip) => {
    mixer.clipAction(clip).play();
  });
  return mixer;
}

function disposeAvatarRoot(root) {
  root.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value && value.isTexture) {
          value.dispose();
        }
      });
      material.dispose();
    });
  });
}

function attachFallbackFace(THREE, root, metrics, missingFeatures) {
  if (!missingFeatures.mouth && !missingFeatures.blink) {
    return undefined;
  }

  const faceGroup = new THREE.Group();
  faceGroup.position.set(0, metrics.eyeY * 0.18, metrics.depthOffset);
  root.add(faceGroup);

  const dark = new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.58, transparent: true, opacity: 0.96 });
  const lip = new THREE.MeshStandardMaterial({ color: 0x9f4e48, roughness: 0.45, transparent: true, opacity: 0.95 });
  const result = {
    mouth: undefined,
    leftEye: undefined,
    rightEye: undefined
  };

  if (missingFeatures.blink) {
    const leftEye = makeEye(THREE, dark, -metrics.eyeOffsetX);
    const rightEye = makeEye(THREE, dark, metrics.eyeOffsetX);
    leftEye.position.y = metrics.eyeY;
    rightEye.position.y = metrics.eyeY;
    leftEye.position.z = 0;
    rightEye.position.z = 0;
    faceGroup.add(leftEye, rightEye);
    result.leftEye = leftEye;
    result.rightEye = rightEye;
  }

  if (missingFeatures.mouth) {
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(metrics.size.x * 0.12, metrics.size.y * 0.012, 0.03), lip);
    mouth.position.set(0, metrics.mouthY, 0);
    faceGroup.add(mouth);
    result.mouth = mouth;
  }

  return result;
}

function buildCanvasFallback() {
  const context = canvas.getContext("2d");

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
  }

  function draw() {
    resize();
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h * 0.48;
    context.clearRect(0, 0, w, h);
    context.save();
    context.scale(window.devicePixelRatio, window.devicePixelRatio);
    const dpr = window.devicePixelRatio;
    const x = cx / dpr;
    const y = cy / dpr;
    const pulse = avatarState === "speaking" ? Math.sin(Date.now() / 80) * 5 : 0;

    context.fillStyle = "#0e5f58";
    context.beginPath();
    context.ellipse(x, y + 172, 116, 150, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#fff5e7";
    context.beginPath();
    context.ellipse(x, y + 176, 132, 142, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#11100f";
    context.beginPath();
    context.ellipse(x, y - 18, 118, 152, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#f0c8ad";
    context.beginPath();
    context.ellipse(x, y, 84, 102, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#171310";
    context.beginPath();
    context.ellipse(x - 30, y - 8, 16, 6, 0, 0, Math.PI * 2);
    context.ellipse(x + 30, y - 8, 16, 6, 0, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "#9f4e48";
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(x - 18, y + 46);
    context.quadraticCurveTo(x, y + 54 + pulse, x + 18, y + 46);
    context.stroke();
    context.restore();

    if (!prefersReducedMotion.matches) {
      requestAnimationFrame(draw);
    }
  }

  window.addEventListener("resize", draw);
  draw();
}
