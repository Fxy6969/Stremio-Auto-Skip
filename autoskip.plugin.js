/**
 * @name AutoSkip
 * @description Adds the ability to skip the intro/credit of a movie/series.
 * @version 1.0.0
 * @author Fxy
 * @updateUrl https://raw.githubusercontent.com/fxy6969/Stremio-Skip/main/autoskip.plugin.js
 */
let isButtonAdded = false;
let skipButton, currentTimeStamp;
let loggedMovieInfo = {};

let videoPlayer = document.querySelector("#videoPlayer");
let controlPlayer = document.querySelector("#player");
const titleElement = document.querySelector(
  "#player > div.binge-group.ng-hide > div.title.ng-binding > span",
);
const episodeTitleElement = document.querySelector("head > title");

function addButton() {
  if (!isInVideoPlayer()) {
    console.log(`one of the elements not found. Retrying...`);
    setTimeout(() => addButton(), 500);
    videoPlayer = null;
    controlPlayer = null;
    return;
  }

  if (isButtonAdded) {
    console.log("Button already added, skipping...");
    return;
  }

  videoPlayer.setAttribute("style", "z-index: -1");
  skipButton = document.createElement("div");
  skipButton.innerHTML = `<span>Skip ${loggedMovieInfo.has_recap ? "Recap" : "Intro"}</span>`;

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
  skipButton.addEventListener("click", handleSkip);
  controlPlayer.appendChild(skipButton);
  isButtonAdded = true;
}

function getMovieInfo() {
  if (!isInVideoPlayer()) return;

  let title = titleElement.textContent;
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

function handleSkip() {
  if (!titleElement || !episodeTitleElement) {
    console.log("Title or episode title not found");
    return;
  }

  const title = titleElement.textContent;
  const episodeTitle = episodeTitleElement?.textContent;
  console.log("episode: " + episodeTitle);

  const episodeInfo = getEpisodeInfo(title, episodeTitle);

  if (episodeInfo) {
    if (episodeInfo.has_recap && isInRecapTime(episodeInfo)) {
      videoPlayer.currentTime = parseFloat(episodeInfo.recap_end);
    } else if (episodeInfo.end_intro) {
      videoPlayer.currentTime = parseFloat(episodeInfo.end_intro);
    } else {
      console.log("Skip time not available");
    }
  } else {
    console.log("Episode info not available");
    // If we don't have the info, try to fetch it
    getMovieInfo()
      .then(() => {
        const updatedEpisodeInfo = getEpisodeInfo(title, episodeTitle);
        if (updatedEpisodeInfo) {
          if (
            updatedEpisodeInfo.has_recap &&
            isInRecapTime(updatedEpisodeInfo)
          ) {
            videoPlayer.currentTime = parseFloat(updatedEpisodeInfo.recap_end);
          } else if (updatedEpisodeInfo.end_intro) {
            videoPlayer.currentTime = parseFloat(updatedEpisodeInfo.end_intro);
          } else {
            console.log("Skip time not available even after fetching");
          }
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
  isButtonAdded = false;
}

function tickTime() {
  if (!isInVideoPlayer()) {
    console.log("Not in video player");
    resetElements();
    return;
  }

  if (!isButtonAdded) {
    console.log("Button not added, adding now...");
    addButton();
  }

  currentTimeStamp = document.querySelector("#play-progress-text")?.textContent;
  if (!currentTimeStamp || !skipButton) {
    console.log(`one of the elements not found. Retrying...`);
    setTimeout(() => tickTime(), 500);
    currentTimeStamp = null;
    return;
  }

  let timeParts = currentTimeStamp.split(":");
  let currentTime = parseFloat(timeParts[0]) * 60 + parseFloat(timeParts[1]);

  if (titleElement && episodeTitleElement) {
    const title = titleElement.textContent;
    const episodeTitle = episodeTitleElement.textContent;

    console.log("Searching for episode:", episodeTitle); // Add this line

    const episodeInfo = getEpisodeInfo(title, episodeTitle);

    if (episodeInfo) {
      const startIntro = parseFloat(episodeInfo.start_intro);
      const endIntro = parseFloat(episodeInfo.end_intro);
      const hasRecap = episodeInfo.has_recap;
      const recapEnd = hasRecap ? parseFloat(episodeInfo.recap_end) : 0;

      console.log(
        startIntro +
          " " +
          endIntro +
          " " +
          hasRecap +
          " " +
          recapEnd +
          " " +
          currentTime,
      );
      if (hasRecap && currentTime >= 0 && currentTime < recapEnd) {
        skipButton.style.display = "inline-flex";
        skipButton.innerHTML = "<span>Skip Recap</span>";
      } else if (currentTime >= startIntro && currentTime < endIntro) {
        skipButton.style.display = "inline-flex";
        skipButton.innerHTML = "<span>Skip Intro</span>";
      } else {
        skipButton.style.display = "none";
      }
    } else {
      console.log("Title or episode title not found");
      skipButton.style.display = "none";
    }
  }
}

function isInRecapTime(episodeInfo) {
  const currentTime = videoPlayer.currentTime;
  return currentTime < parseFloat(episodeInfo.recap_end);
}

function isInVideoPlayer() {
  return videoPlayer && controlPlayer;
}

function getEpisodeInfo(title, episodeTitle) {
  console.log("Getting episode info for:", title, episodeTitle);
  if (!loggedMovieInfo[title] || !loggedMovieInfo[title].episodes) {
    console.log("No episode data found for:", title);
    return null;
  }

  // Function to remove special characters and convert to lowercase
  const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");

  const normalizedEpisodeTitle = normalize(episodeTitle);
  console.log("Normalized episode title:", normalizedEpisodeTitle);

  // Try to find an exact match first
  let episode = loggedMovieInfo[title].episodes.find(
    (ep) => normalize(ep.episode) === normalizedEpisodeTitle,
  );

  if (episode) {
    console.log("Found exact match:", episode.episode);
    return episode;
  }

  // If no exact match, try to find a partial match
  episode = loggedMovieInfo[title].episodes.find(
    (ep) =>
      normalize(ep.episode).includes(normalizedEpisodeTitle) ||
      normalizedEpisodeTitle.includes(normalize(ep.episode)),
  );

  if (episode) {
    console.log("Found partial match:", episode.episode);
    return episode;
  }

  // If still no match, try to match by episode number
  const episodeNumber = episodeTitle.match(/\d+/);
  if (episodeNumber) {
    episode = loggedMovieInfo[title].episodes.find((ep) =>
      ep.episode.includes(episodeNumber[0]),
    );
    if (episode) {
      console.log("Found match by episode number:", episode.episode);
      return episode;
    }
  }

  console.log("No matching episode found");
  return null;
}

setInterval(tickTime, 200);
addButton();

// Observe DOM changes to detect when user enters/leaves video player
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      if (isInVideoPlayer() && !isButtonAdded) {
        console.log("Detected entry into video player, adding button...");
        addButton();
      }
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
