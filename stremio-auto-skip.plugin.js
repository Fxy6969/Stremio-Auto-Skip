/**
 * @name Stremio Auto-Skip
 * @description Shows a "Skip Intro" button using community skip data
 * @author Fxy
 * @version v26.0.0
 */

class AutoSkipPlugin {
  constructor() {
    this.EXTERNAL_API = 'https://mzt4pr8wlkxnv0qsha5g.website/intro';
    this.mediaId = null;
    this.segments = [];
    this._skipPrompt = null;
    this._videoListener = null;
    this.init();
  }

  init() {
    const observer = new MutationObserver(() => {
      this.checkEpisodeChange();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(() => this.checkEpisodeChange(), 2000);
  }

  extractMediaId() {
    const url = window.location.href;

    // Pattern 1: /detail/series/tt0141842/1/4
    let m = url.match(/\/detail\/series\/(tt\d{7,8})\/(\d+)\/(\d+)/);
    if (m) return `${m[1]}_${m[2]}_${m[3]}`;

    // Pattern 2: /detail/series/tt0141842?season=1&episode=4
    m = url.match(/\/detail\/series\/(tt\d{7,8})/);
    if (m) {
      const s = url.match(/[?&]season=(\d+)/);
      const e = url.match(/[?&]episode=(\d+)/);
      if (s && e) return `${m[1]}_${s[1]}_${e[1]}`;
    }

    // Pattern 3: /player/.../series/tt0412142/tt0412142%3A1%3A2
    try {
      const decoded = decodeURIComponent(url);
      m = decoded.match(/\/series\/tt\d{7,8}\/tt(\d{7,8}):(\d+):(\d+)/);
      if (m) return `tt${m[1]}_${m[2]}_${m[3]}`;
    } catch (_) {}

    return null;
  }

  checkEpisodeChange() {
    const id = this.extractMediaId();
    if (!id || id === this.mediaId) return;

    this.mediaId = id;
    this.segments = [];
    this._highlighted = false;
    this.hideSkipButton();
    console.log('[AutoSkip] Episode:', this.mediaId);

    this.loadSegments().then(() => this.attachVideoListener());
  }

  // TODO: find a way to cache the segments (this gets deleted when the app is reloaded)
  // getCache(mediaId) {
  //   try {
  //     const raw = localStorage.getItem('autoskip:' + mediaId);
  //     if (!raw) return null;
  //     const { segments, expires } = JSON.parse(raw);
  //     if (Date.now() > expires) { localStorage.removeItem('autoskip:' + mediaId); return null; }
  //     return segments;
  //   } catch { return null; }
  // }

  // setCache(mediaId, segments) {
  //   try {
  //     localStorage.setItem('autoskip:' + mediaId, JSON.stringify({
  //       segments,
  //       expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  //     }));
  //   } catch (_) {}
  // }

  async loadSegments() {
    // const cached = this.getCache(this.mediaId);
    // if (cached) {
    //   this.segments = cached;
    //   console.log('[AutoSkip] ' + this.segments.length + ' segment(s) from cache');
    //   return;
    // }

    const m = this.mediaId.match(/^(tt\d{7,8})_(\d+)_(\d+)$/);
    if (!m) return;

    try {
      const res = await fetch(this.EXTERNAL_API + '?imdb=' + m[1] + '&season=' + m[2] + '&episode=' + m[3]);
      if (!res.ok) return;
      const json = await res.json();
      if (json.status !== 'success' || !json.data) return;

      const { start_ms, end_ms, confidence } = json.data;
      const segment = {
        type: 'intro',
        start_sec: Math.floor(start_ms / 1000),
        end_sec: Math.ceil(end_ms / 1000),
        confidence: confidence ?? 1.0,
      };

      this.segments = [segment];
      // this.setCache(this.mediaId, this.segments);
      console.log('[AutoSkip] Fetched intro: ' + segment.start_sec + 's - ' + segment.end_sec + 's');
      this.waitAndHighlight();
    } catch (err) {
      console.error('[AutoSkip] API request failed:', err.message);
    }
  }

  waitAndHighlight() {
    if (this._highlighted) return;
    const attempt = (tries) => {
      if (this._highlighted) return;
      const video = document.querySelector('video');
      const thumb = document.querySelector('[class*="thumb-"]');
      const track = thumb ? thumb.parentElement : null;

      if (!video || !track || !video.duration) {
        if (tries > 0) setTimeout(() => attempt(tries - 1), 500);
        return;
      }
      this._highlighted = true;
      this.highlightSegments(video, track);
    };
    attempt(20);
  }

  highlightSegments(video, track) {
    track.querySelectorAll('.autoskip-highlight').forEach(el => el.remove());

    const duration = video.duration;
    if (!duration || !this.segments.length) return;

    for (const seg of this.segments) {
      const left = (seg.start_sec / duration) * 100;
      const width = ((seg.end_sec - seg.start_sec) / duration) * 100;

      const marker = document.createElement('div');
      marker.className = 'autoskip-highlight';
      marker.title = 'Skip ' + seg.type.charAt(0).toUpperCase() + seg.type.slice(1);
      marker.style.cssText = [
        'position:absolute',
        'top:0', 'bottom:0',
        'left:' + left + '%',
        'width:' + width + '%',
        'background:rgba(250,204,21,0.55)',
        'border-radius:2px',
        'pointer-events:none',
        'z-index:10',
        'transition:opacity 0.2s',
      ].join(';');

      track.style.position = 'relative';
      track.appendChild(marker);
    }
  }

  attachVideoListener() {
    const video = document.querySelector('video');
    if (!video) { setTimeout(() => this.attachVideoListener(), 1000); return; }
    if (this._videoListener) video.removeEventListener('timeupdate', this._videoListener);
    this._videoListener = () => this.onTimeUpdate(video);
    video.addEventListener('timeupdate', this._videoListener);
  }

  onTimeUpdate(video) {
    if (!this.segments.length) return;
    const t = video.currentTime;
    const active = this.segments.find(s => t >= s.start_sec && t < s.end_sec);
    active ? this.showSkipButton(active, video) : this.hideSkipButton();
  }

  showSkipButton(seg, video) {
    if (this._skipPrompt && this._skipPrompt._segType === seg.type) return;
    this.hideSkipButton();

    const label = seg.type.charAt(0).toUpperCase() + seg.type.slice(1);
    const btn = document.createElement('div');
    btn._segType = seg.type;
    btn.textContent = 'Skip ' + label;
    btn.id = 'auto-skip-button';
    btn.style.cssText = [
      'position:fixed', 'bottom:115px', 'right:32px', 'z-index:99999', 'color:white',
      'background:rgba(70,70,70,0.22)',
      'box-shadow:0 4px 12px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.25)',
      'backdrop-filter:var(--backdrop-filter)',
      'border:1px solid rgba(255,255,255,0.04)',
      'border-radius:12px',
      'padding:10px 22px', 'font-size:15px', 'font-weight:600',
      'cursor:pointer', 'letter-spacing:0.02em', 'user-select:none',
      'transition:background 0.15s,border-color 0.15s',
    ].join(';');
    btn.onmouseenter = () => { btn.style.background = 'rgba(255,255,255,0.22)'; btn.style.borderColor = 'rgba(255,255,255,0.7)'; };
    btn.onmouseleave = () => { btn.style.background = 'rgba(70,70,70,0.22)'; btn.style.borderColor = 'rgba(255,255,255,0.04)'; };
    btn.onclick = (e) => {
      e.stopPropagation();
      video.currentTime = seg.end_sec;
      this.hideSkipButton();
      console.log('[AutoSkip] Skipped ' + seg.type + ' to ' + seg.end_sec + 's');
    };

    document.body.appendChild(btn);
    this._skipPrompt = btn;
  }

  hideSkipButton() {
    if (this._skipPrompt) { this._skipPrompt.remove(); this._skipPrompt = null; }
  }
}

if (typeof window !== 'undefined') {
  window.autoSkipPlugin = new AutoSkipPlugin();
  console.log('[AutoSkip] v26.0.0 ready');
}