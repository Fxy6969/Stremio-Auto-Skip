/**
 * @name AutoSkip
 * @description Adds the ability to skip the intro/credit of a movie/series.
 * @version 1.0.1
 * @author Fxy
 * @updateUrl https://raw.githubusercontent.com/YourUsername/YourRepo/main/ReloadOnShortcut.plugin.js
 */
let videoPlayer, controlPlayer, skipButton, currentTimeStamp;
let loggedMovieInfo = {};

function addButton() {
  videoPlayer = document.querySelector("#videoPlayer");
  controlPlayer = document.querySelector("#player");

  if (!isInVideoPlayer()) {
    console.log(`one of the elements not found. Retrying...`);
    setTimeout(() => addButton(), 500);
    videoPlayer = null;
    controlPlayer = null;
    return;
  }

  videoPlayer.setAttribute("style", "z-index: -1");
  skipButton = document.createElement("div");
  skipButton.innerHTML = `<span>Skip Intro</span>`;

  skipButton.setAttribute(
    "style",
    `
    backdrop-filter: blur(60px) saturate(210%);
    -webkit-backdrop-filter: blur(60px) saturate(210%);
    background-color: var(--bg-color);
    border-radius: 6px;
    border: 0.5px solid rgba(0, 0, 0, 0.2);
    box-shadow: var(--box-shadow);
    display: inline-flex;
    padding: 0.5rem 0.5rem;
    justify-content: center;
    position: fixed;
    bottom: 15vh;
    align-content: flex-start;
    flex-wrap: nowrap;
    flex-direction: row;
    right: 3vw;
    cursor: pointer;
    `,
  );

  getMovieInfo();
  skipButton.addEventListener("click", handleSkipIntro);
  controlPlayer.appendChild(skipButton);
}

function getMovieInfo() {
  if (!isInVideoPlayer()) return;
  const title = document.querySelector(
    "#player > div.binge-group.ng-hide > div.title.ng-binding > span",
  )?.textContent;
  if (!title) {
    console.log(`Title not found. Retrying...`);
    setTimeout(() => getMovieInfo(), 200);
    return;
  }
  console.log("Title: " + title);

  // Check if we already have the movie info logged
  if (loggedMovieInfo[title]) {
    console.log("Using logged movie info for:", title);
    return Promise.resolve(loggedMovieInfo[title]);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "http://127.0.0.1:5000/" + title.toLowerCase());
    xhr.responseType = "json";
    xhr.onload = () => {
      if (xhr.readyState == 4 && xhr.status == 200) {
        console.log("Fetched movie info:", xhr.response);
        // Log the movie info
        loggedMovieInfo[title] = xhr.response;
        resolve(xhr.response);
      } else {
        reject(`Error: ${xhr.status}`);
      }
    };
    xhr.onerror = () => {
      reject("Network error");
    };
    xhr.send();
  });
}

function handleSkipIntro() {
  const title = document.querySelector(
    "#player > div.binge-group.ng-hide > div.title.ng-binding > span",
  )?.textContent;
  if (!title) {
    console.log("Title not found");
    return;
  }

  const movieInfo = loggedMovieInfo[title];
  if (movieInfo && movieInfo.end_intro) {
    videoPlayer.currentTime = movieInfo.end_intro;
  } else {
    console.log("Intro end time not available");
    // If we don't have the info, try to fetch it
    getMovieInfo()
      .then((info) => {
        if (info && info.end_intro) {
          videoPlayer.currentTime = info.end_intro;
        } else {
          console.log("Intro end time not available even after fetching");
        }
      })
      .catch((error) => {
        console.error("Error fetching movie info:", error);
      });
  }
}

function resetElements() {
  videoPlayer = null;
  controlPlayer = null;
  skipButton = null;
  currentTimeStamp = null;
  loggedMovieInfo = {};
}

function tickTime() {
  if (!isInVideoPlayer()) {
    console.log("Not in video player");
    resetElements();
    return;
  }

  currentTimeStamp = document.querySelector("#play-progress-text")?.textContent;
  if (!currentTimeStamp || !skipButton) {
    console.log(`one of the elements not found. Retrying...`);
    setTimeout(() => tickTime(), 500);
    currentTimeStamp = null;
    return;
  }

  let timeParts = currentTimeStamp.split(":");
  let timeStamp = parseFloat(timeParts[0]) * 60 + parseFloat(timeParts[1]);
  if (timeStamp >= 0 && timeStamp < 60) {
    skipButton.style.display = "inline-flex";
  } else {
    skipButton.style.display = "none";
  }
}

function isInVideoPlayer() {
  return (
    document.querySelector("#videoPlayer") && document.querySelector("#player")
  );
}

setInterval(tickTime, 200);
addButton();
