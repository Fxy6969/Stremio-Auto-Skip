const SERVER_URL = "http://localhost:3000";

const state = {
  subtitleUrl: null,
  showId: null,
  episodeId: null,
  metadata: null,
  hasPinged: false,
  skipRequested: false,
  isProcessing: false,
  skipSegments: [],
  isDEBUG: true,
  videoElement: null,
  skipButtonShown: false,
  videoCheckInterval: null,
  listenersAttached: false,
  audioContext: null,
  isRecordingAudio: false,
  recordingStartTime: null,
  videoTimeAtRecordingStart: null,
  lastRecordingAttempt: null,
  hasCheckedForSkips: false,
  shouldRecord: false,

  currentMediaIdentifier: null,
  titleObserver: null,
  urlObserver: null,
  lastDetectedTitle: null,
};

function log(...args) {
  if (state.isDEBUG) console.log("[AutoSkip]", ...args);
}

// Reset state when episode changes
function resetEpisodeState() {
  log("[Reset] Clearing episode state for new episode");

  state.episodeId = null;
  state.hasCheckedForSkips = false;
  state.shouldRecord = false;
  state.skipSegments = [];
  state.skipButtonShown = false;
  state.isRecordingAudio = false;
  state.lastRecordingAttempt = null;
  state.videoTimeAtRecordingStart = null;
  state.currentMediaIdentifier = null;

  hideSkipButton();
  hideVoteButton();
}

function detectCurrentEpisode() {
  const detected = {
    showId: null,
    episodeId: null,
    source: null,
  };

  const bgEntries = performance
    .getEntriesByType("resource")
    .filter((e) => e.name.includes("images.metahub.space/background/medium/"));

  if (bgEntries.length > 0) {
    const latestBg = bgEntries[bgEntries.length - 1];
    const showMatch = latestBg.name.match(/\/(tt\d+)/);
    const episodeMatch = latestBg.name.match(/:([\d]+):([\d]+)/);

    if (showMatch) {
      detected.showId = showMatch[1];
      detected.source = "background-url";

      if (episodeMatch) {
        detected.episodeId = `${episodeMatch[1]}_${episodeMatch[2]}`;
      }
    }
  }

  const episodeTitleEl = document.querySelector(".episode-title-dln_c");
  if (episodeTitleEl) {
    const titleText = episodeTitleEl.textContent.trim();
    const match = titleText.match(/S(\d+)E(\d+)/i);

    if (match) {
      const season = match[1];
      const episode = match[2];
      detected.episodeId = `${season}_${episode}`;
      detected.source = detected.source || "title-element";

      log("[Detect] Found episode from title:", titleText);
    }
  }

  const seriesNameEl = document.querySelector(".custom-series-name");
  if (seriesNameEl && seriesNameEl.dataset?.imdbId) {
    detected.showId = detected.showId || seriesNameEl.dataset.imdbId;
    detected.source = detected.source || "series-name-element";
  }

  return detected;
}

// Monitor for episode changes
function watchForEpisodeChanges() {
  const titleEl = document.querySelector(".episode-title-dln_c");
  if (titleEl && !state.titleObserver) {
    state.titleObserver = new MutationObserver(() => {
      const newTitle = titleEl.textContent.trim();

      if (
        newTitle !== state.lastDetectedTitle &&
        newTitle.match(/S(\d+)E(\d+)/i)
      ) {
        log("[Watch] Title changed:", newTitle);
        state.lastDetectedTitle = newTitle;

        setTimeout(() => {
          handleEpisodeChange();
        }, 500);
      }
    });

    state.titleObserver.observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    state.lastDetectedTitle = titleEl.textContent.trim();
    log("[Watch] Started watching title element");
  }

  if (!state.urlObserver) {
    state.urlObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes("images.metahub.space/background/medium/")) {
          const match = entry.name.match(/\/(tt\d+).*:([\d]+):([\d]+)/);
          if (match) {
            const [, showId, season, episode] = match;
            const newIdentifier = `${showId}_${season}_${episode}`;

            if (newIdentifier !== state.currentMediaIdentifier) {
              log(
                "[Watch] New episode detected from background load:",
                newIdentifier,
              );

              setTimeout(() => {
                handleEpisodeChange();
              }, 1000);
            }
          }
        }
      }
    });

    state.urlObserver.observe({ entryTypes: ["resource"] });
    log("[Watch] Started watching resource loads");
  }

  setInterval(() => {
    const detected = detectCurrentEpisode();

    if (detected.showId && detected.episodeId) {
      const newIdentifier = `${detected.showId}_${detected.episodeId}`;

      if (newIdentifier !== state.currentMediaIdentifier) {
        log("[Watch] Episode change detected via polling:", newIdentifier);
        handleEpisodeChange();
      }
    }
  }, 2000);
}

// Handle episode change
function handleEpisodeChange() {
  const detected = detectCurrentEpisode();

  if (!detected.showId) {
    log("[Change] No show ID detected yet");
    return;
  }

  const newIdentifier = detected.episodeId
    ? `${detected.showId}_${detected.episodeId}`
    : detected.showId;

  if (newIdentifier === state.currentMediaIdentifier) {
    return;
  }

  log(
    `[Change] Episode changed: ${state.currentMediaIdentifier || "none"} → ${newIdentifier}`,
  );
  log(`[Change] Detection source: ${detected.source}`);

  resetEpisodeState();

  state.showId = detected.showId;
  state.episodeId = detected.episodeId;
  state.currentMediaIdentifier = newIdentifier;

  state.listenersAttached = false;

  findVideoElement();

  hideSkipButton();
  state.skipButtonShown = false;

  if (state.videoElement && !state.videoElement.paused) {
    log("[Change] Video is playing, will check for skips once the show starts");
  }
}

function findVideoElement() {
  const video = document.querySelector("video");
  if (video && video !== state.videoElement) {
    state.videoElement = video;
    log("[Video] Found video element");
    attachVideoListeners();

    if (state.videoCheckInterval) {
      clearInterval(state.videoCheckInterval);
      state.videoCheckInterval = null;
      log("[Video] Stopped polling for video element");
    }
  }
}

function attachVideoListeners() {
  if (!state.videoElement || state.listenersAttached) return;

  state.videoElement.removeEventListener("timeupdate", checkSkipTiming);
  state.videoElement.removeEventListener("playing", onVideoPlaying);
  state.videoElement.removeEventListener("waiting", onVideoWaiting);
  state.videoElement.removeEventListener("stalled", onVideoStalled);

  state.videoElement.addEventListener("timeupdate", checkSkipTiming);
  state.videoElement.addEventListener("playing", onVideoPlaying);
  state.videoElement.addEventListener("waiting", onVideoWaiting);
  state.videoElement.addEventListener("stalled", onVideoStalled);

  state.listenersAttached = true;

  log("[Video] Attached listeners");
}

function onVideoWaiting() {
  if (state.isRecordingAudio) {
    log(
      "[Video] Buffering detected during recording - quality may be affected",
    );
  }
}

function onVideoStalled() {
  if (state.isRecordingAudio) {
    log("[Video] Stalling detected during recording - quality may be affected");
  }
}

function onVideoPlaying() {
  log(
    "[Video] Playing event fired, currentTime:",
    state.videoElement?.currentTime,
  );

  if (!state.episodeId || !state.showId) {
    handleEpisodeChange();
  }

  if (!state.hasCheckedForSkips && state.showId && state.episodeId) {
    const currentTime = state.videoElement?.currentTime || 0;
    const MIN_TIME_BEFORE_CHECK = 3;
    
    if (currentTime < MIN_TIME_BEFORE_CHECK) {
      log(`[Video] Video at ${currentTime.toFixed(1)}s, waiting until ${MIN_TIME_BEFORE_CHECK}s before checking for skips...`);
      
      const checkWhenReady = () => {
        if (state.videoElement && state.videoElement.currentTime >= MIN_TIME_BEFORE_CHECK) {
          state.videoElement.removeEventListener("timeupdate", checkWhenReady);
          log("[Video] Show has started, now checking for existing skips");
          checkForExistingSkips();
        }
      };
      
      state.videoElement.addEventListener("timeupdate", checkWhenReady);
      return;
    } else {
      log("[Video] Video already past minimum, checking for existing skips now");
      checkForExistingSkips();
      return;
    }
  }

  if (state.shouldRecord && !state.isRecordingAudio) {
    log("[Video] shouldRecord is true, start recording");
    scheduleRecording();
  }
}

async function checkForExistingSkips() {
  state.hasCheckedForSkips = true;

  const mediaIdentifier = `${state.showId}_${state.episodeId}`;
  log("[Check] Looking for existing skips for:", mediaIdentifier);

  try {
    const response = await fetch(`${SERVER_URL}/api/skip/${mediaIdentifier}`);

    if (!response.ok) {
      log("[Check] API returned error, will record audio");
      state.shouldRecord = true;
      scheduleRecording();
      return;
    }

    const segments = await response.json();
    log("[Check] API response:", segments);

    if (segments && segments.length > 0) {
      log("[Check] ✓ Found", segments.length, "existing skip segment(s)!");
      state.skipSegments = segments;
      state.shouldRecord = false;
      addVoteButton();
    } else {
      log("[Check] No segments found in database, will record audio");
      state.shouldRecord = true;
      scheduleRecording();
    }
  } catch (e) {
    console.error("[Check] Error checking for skips:", e);
    state.shouldRecord = true;
    scheduleRecording();
  }
}

function scheduleRecording() {
  if (!state.videoElement || state.isRecordingAudio) {
    log("[Schedule] Cannot schedule - no video or already recording");
    return;
  }

  const now = Date.now();
  const timeSinceLastAttempt = state.lastRecordingAttempt
    ? now - state.lastRecordingAttempt
    : Infinity;

  if (timeSinceLastAttempt < 300000) {
    log("[Schedule] Too soon since last attempt");
    return;
  }

  const MIN_START_TIME = 3;
  const MAX_START_TIME = 15;

  if (state.videoElement.currentTime >= MAX_START_TIME) {
    log("[Schedule] Video already past", MAX_START_TIME, "s mark, too late to record");
    return;
  }

  const currentTime = state.videoElement.currentTime;
  if (currentTime < MIN_START_TIME) {
    const waitTime = (MIN_START_TIME - currentTime) * 1000 + 1000;
    log(`[Schedule] Video at ${currentTime.toFixed(1)}s, waiting ${(waitTime/1000).toFixed(1)}s until show starts...`);
    
    setTimeout(() => {
      if (
        state.videoElement &&
        !state.videoElement.paused &&
        !state.videoElement.seeking &&
        state.videoElement.currentTime >= MIN_START_TIME &&
        state.videoElement.currentTime < MAX_START_TIME
      ) {
        log("[Schedule] Show has started, beginning recording now");
        captureAudioForAnalysis();
      } else {
        log("[Schedule] Recording cancelled - video state not ready or too late");
      }
    }, waitTime);
  } else {
    log("[Schedule] Video already past minimum, will start recording in 1 second...");
    setTimeout(() => {
      if (
        state.videoElement &&
        !state.videoElement.paused &&
        !state.videoElement.seeking &&
        state.videoElement.currentTime >= MIN_START_TIME &&
        state.videoElement.currentTime < MAX_START_TIME
      ) {
        log("[Schedule] Starting recording now");
        captureAudioForAnalysis();
      } else {
        log("[Schedule] Recording cancelled - video state not ready");
      }
    }, 1000);
  }
}

async function captureAudioForAnalysis() {
  if (state.isRecordingAudio || !state.videoElement) return;

  if (
    state.videoElement.paused ||
    state.videoElement.seeking ||
    state.videoElement.readyState < 3
  ) {
    log("[Audio] Video not ready for recording, skipping");
    return;
  }

  state.isRecordingAudio = true;
  state.recordingStartTime = Date.now();
  state.videoTimeAtRecordingStart = Math.floor(state.videoElement.currentTime);
  state.lastRecordingAttempt = Date.now();

  log("[Audio] Starting capture for fingerprinting...");

  try {
    if (!state.audioContext || state.audioContext.state === "closed") {
      state.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      log("[Audio] Created new AudioContext");
    }

    const audioContext = state.audioContext;

    let source;
    try {
      source = audioContext.createMediaElementSource(state.videoElement);
    } catch (e) {
      log("[Audio] MediaElementSource already exists (this is normal)");
      state.isRecordingAudio = false;
      return;
    }

    const dest = audioContext.createMediaStreamDestination();
    source.connect(dest);
    source.connect(audioContext.destination);

    const mediaRecorder = new MediaRecorder(dest.stream, {
      mimeType: "audio/webm;codecs=opus",
    });

    log("[Audio] MediaRecorder created");

    const audioChunks = [];
    let chunkCount = 0;
    let goodChunkCount = 0;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        chunkCount++;

        const chunkSizeKB = (event.data.size / 1024).toFixed(2);
        log("[Audio] Chunk received:", chunkSizeKB, "KB");

        if (event.data.size > 100000) {
          goodChunkCount++;
        }

        if (event.data.size < 10000 && chunkCount > 2) {
          console.error("[Audio] ⚠️ Tiny chunk detected - buffering detected!");

          if (goodChunkCount >= 3) {
            log("[Audio] Have", goodChunkCount, "good chunks, stopping");
            if (mediaRecorder.state === "recording") {
              mediaRecorder.stop();
            }
          } else {
            log("[Audio] Only", goodChunkCount, "good chunks, discarding");
            if (mediaRecorder.state === "recording") {
              mediaRecorder.stop();
            }
          }
        }
      }
    };

    mediaRecorder.onstop = async () => {
      const recordingDuration = Date.now() - state.recordingStartTime;
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

      log(
        "[Audio] Recording complete:",
        (audioBlob.size / 1024).toFixed(2),
        "KB",
        `(${chunkCount} chunks, ${goodChunkCount} good chunks)`,
      );

      if (goodChunkCount < 3) {
        console.error("[Audio] ✗ Too few good chunks, discarding");
        state.isRecordingAudio = false;
        state.lastRecordingAttempt = Date.now() - 240000;
        return;
      }

      const minSize = 300000;
      if (audioBlob.size < minSize) {
        console.error(
          "[Audio] Recording too small!",
          (audioBlob.size / 1024).toFixed(2),
          "KB",
        );
        state.isRecordingAudio = false;
        state.lastRecordingAttempt = Date.now() - 240000;
        return;
      }

      log("[Audio] ✓ Recording quality acceptable, sending for analysis");
      await sendAudioForAnalysis(audioBlob);

      state.isRecordingAudio = false;
    };

    mediaRecorder.start(10000);
    log("[Audio] Recording started (90s capture)");

    const healthCheck = setInterval(() => {
      if (!state.isRecordingAudio) {
        clearInterval(healthCheck);
        return;
      }

      const elapsed = Date.now() - state.recordingStartTime;
      log(
        `[Audio] Progress: ${(elapsed / 1000).toFixed(1)}s / 90s, chunks: ${chunkCount}`,
      );

      if (elapsed > 30000 && chunkCount === 0) {
        console.error("[Audio] No audio data, stopping");
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
        clearInterval(healthCheck);
      }
    }, 10000);

    setTimeout(() => {
      clearInterval(healthCheck);
      if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        log("[Audio] Recording stopped (90s)");
      }
    }, 90000);
  } catch (e) {
    console.error("[Audio] Capture failed:", e);
    state.isRecordingAudio = false;
  }
}

async function sendAudioForAnalysis(audioBlob) {
  if (!state.showId || !state.episodeId) {
    log("[Audio] No show/episode ID, skipping analysis");
    return;
  }

  const mediaIdentifier = `${state.showId}_${state.episodeId}`;

  const videoTimeAtStart = state.videoTimeAtRecordingStart ?? 0;

  log("[Audio] Sending to server for fingerprint analysis");
  log(`[Audio] Recording started at video time: ${videoTimeAtStart}s`);

  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.webm");
  formData.append("media_id", mediaIdentifier);
  formData.append("start_time", videoTimeAtStart.toString());

  try {
    const response = await fetch(`${SERVER_URL}/api/skip/analyze-audio`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();
    log("[Audio] Analysis result:", result);

    if (result.segments && result.segments.length > 0) {
      log("[Skip] ✓ Detected segments:", result.segments);
      state.skipSegments = result.segments;
      addVoteButton();
    } else {
      log("[Skip] Fingerprint stored for future matching");
    }
  } catch (e) {
    console.error("[Audio] Analysis failed:", e);
  }
}

function checkSkipTiming() {
  if (!state.videoElement || state.skipSegments.length === 0) {
    if (state.skipButtonShown) {
      hideSkipButton();
      state.skipButtonShown = false;
    }
    return;
  }

  if (!document.contains(state.videoElement)) {
    hideSkipButton();
    state.skipButtonShown = false;
    return;
  }

  const currentTime = state.videoElement.currentTime;

  for (const segment of state.skipSegments) {
    const bufferStart = Math.max(0, segment.start_sec - 2);
    const bufferEnd = segment.end_sec;

    if (currentTime >= bufferStart && currentTime <= bufferEnd) {
      if (!state.skipButtonShown) {
        showSkipButton(segment);
        state.skipButtonShown = true;
      }
      return;
    }
  }

  if (state.skipButtonShown) {
    hideSkipButton();
    state.skipButtonShown = false;
  }
}

function showSkipButton(segment) {
  if (!state.videoElement || !document.contains(state.videoElement)) {
    log("[Skip] Not in video player, not showing button");
    return;
  }

  const existing = document.getElementById("autoskip-button");
  if (existing) existing.remove();

  const skipButton = document.createElement("button");
  skipButton.id = "autoskip-button";
  skipButton.textContent = `Skip →`;

  skipButton.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (state.videoElement) {
      state.videoElement.currentTime = segment.end_sec + 1;
      log("[Skip] Jumped to", segment.end_sec + 1);
    }
  };

  document.body.appendChild(skipButton);
  log("[Skip] Button shown in video player");
}

function hideSkipButton() {
  const button = document.getElementById("autoskip-button");
  if (button) button.remove();
}

function addVoteButton() {
  const buttonsContainer = document.querySelector(
    '[class*="control-bar-buttons"]',
  );
  if (!buttonsContainer) {
    log("[UI] Could not find buttons container");
    return;
  }

  if (document.getElementById("autoskip-vote-btn")) return;

  const voteBtn = document.createElement("div");
  voteBtn.id = "autoskip-vote-btn";
  voteBtn.tabIndex = -1;
  voteBtn.className = "control-bar-button-FQUsj button-container-zVLH6";
  voteBtn.innerHTML = `
    <svg class="icon-qy6I6" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
      <path d="M720-120v-240l200 120-200 120Zm-200 0v-240l200 120-200 120Zm-40-360ZM370-80l-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v33.5q0 10-2 20h-82q2-10 3-20t1-20q-1-19-3-33.5t-6-27.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q24 25 54 42t65 22v184h-70Zm70-266v-91q-8-8-13-19t-5-24q0-25 17.5-42.5T482-540q25 0 42.5 17.5T542-480q0 11-3.5 21.5T527-440h89q3-10 4.5-19.5T622-480q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 48 27.5 84t70.5 50Z"/>
    </svg>
  `;
  voteBtn.title = "Adjust skip timing";

  voteBtn.onclick = () => showVoteModal();

  buttonsContainer.insertAdjacentElement("afterbegin", voteBtn);
  log("[UI] Added vote button");
}

function hideVoteButton() {
  const button = document.getElementById("autoskip-vote-btn");
  if (button) button.remove();
}

function showVoteModal() {
  if (state.skipSegments.length === 0) {
    alert("No skip segments detected for this episode.");
    return;
  }

  const existing = document.getElementById("autoskip-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "autoskip-modal";
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(30, 30, 30, 0.98);
    padding: 24px;
    border-radius: 12px;
    z-index: 10000;
    min-width: 400px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    color: white;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  let segmentsHtml = "";
  state.skipSegments.forEach((segment, idx) => {
    const verifiedBadge = segment.verified
      ? '<span style="background: #10b981; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">✓ Verified</span>'
      : "";

    const votes = segment.votes || 1;
    const voteDisplay = `<span style="color: #9ca3af; font-size: 12px;">${votes} vote${votes !== 1 ? "s" : ""}</span>`;

    segmentsHtml += `
      <div style="margin-bottom: 20px; padding: 16px; background: rgba(50, 50, 50, 0.5); border-radius: 8px;">
        <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <label style="font-size: 14px; font-weight: 600;">
            ${segment.type.charAt(0).toUpperCase() + segment.type.slice(1)}
            ${verifiedBadge}
          </label>
          ${voteDisplay}
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-size: 14px;">Start Time (seconds)</label>
          <input type="number" id="skip-start-${idx}" value="${segment.start_sec}"
            ${segment.verified ? "disabled" : ""}
            style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #555; background: #1a1a1a; color: white; font-size: 14px;" />
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-size: 14px;">End Time (seconds)</label>
          <input type="number" id="skip-end-${idx}" value="${segment.end_sec}"
            ${segment.verified ? "disabled" : ""}
            style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #555; background: #1a1a1a; color: white; font-size: 14px;" />
        </div>
        ${
          segment.verified
            ? '<p style="color: #9ca3af; font-size: 12px; margin: 0;">This segment is verified and cannot be edited.</p>'
            : `<button id="save-feedback-${idx}" style="width: 100%; padding: 10px; background: #8b5cf6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
            Save Changes
          </button>`
        }
      </div>
    `;
  });

  modal.innerHTML = `
    <h3 style="margin: 0 0 16px 0; font-size: 18px;">Skip Segments</h3>
    ${segmentsHtml}
    <div style="display: flex; gap: 8px; margin-top: 20px;">
      <button id="cancel-feedback" style="flex: 1; padding: 10px; background: #555; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
        Close
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  state.skipSegments.forEach((segment, idx) => {
    if (!segment.verified) {
      const saveBtn = document.getElementById(`save-feedback-${idx}`);
      if (saveBtn) {
        saveBtn.onclick = async () => {
          const newStart = parseInt(
            document.getElementById(`skip-start-${idx}`).value,
          );
          const newEnd = parseInt(
            document.getElementById(`skip-end-${idx}`).value,
          );

          if (newStart >= newEnd) {
            alert("Start time must be before end time!");
            return;
          }

          if (newStart < 0 || newEnd < 0) {
            alert("Times must be positive!");
            return;
          }

          await updateSkipTiming(segment.id, newStart, newEnd, idx);
        };
      }
    }
  });

  document.getElementById("cancel-feedback").onclick = () => {
    modal.remove();
  };
}

async function updateSkipTiming(id, start_sec, end_sec, idx) {
  try {
    const res = await fetch(`${SERVER_URL}/api/skip/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_sec, end_sec }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update");
    }

    const updated = await res.json();
    log("[Feedback] Updated segment:", updated);

    state.skipSegments[idx] = updated;

    alert("Skip timing updated successfully");
  } catch (e) {
    console.error("[Feedback] Error:", e);
    alert(e.message || "Failed to update timing. Please try again.");
  }
}

async function initializeConnection() {
  try {
    const res = await fetch(`${SERVER_URL}/api/ping`);
    const json = await res.json();
    state.hasPinged = json?.message === "pong";
    log("[Server] Ping:", state.hasPinged ? "OK" : "FAIL");
  } catch (e) {
    console.error("[Server] Ping failed:", e);
  }
}

async function main() {
  toast("Initialized");

  await initializeConnection();

  handleEpisodeChange();

  watchForEpisodeChanges();

  state.videoCheckInterval = setInterval(findVideoElement, 1000);
}

main();
