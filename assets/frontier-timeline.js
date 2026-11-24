/* A scrub-friendly, one-frame-per-year version of the regional 2012–2026 GIF.
   The archival-styled sequence is illustrative. The existing 2026 Leaflet
   mining contours are the mapped geospatial evidence, not dated yearly shapes. */
(() => {
  const firstYear = 2012;
  const lastYear = 2026;
  const wrap = document.querySelector('.map-wrap');
  if (!wrap) return;

  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = './assets/frontier-timeline.css?v=20261124e';
  document.head.append(sheet);

  const timeline = document.createElement('section');
  timeline.className = 'frontier-timelapse';
  timeline.hidden = true;
  timeline.setAttribute('aria-label', 'The mining frontier, 2012 to 2026');
  timeline.innerHTML = `
    <div class="frontier-stage">
      <div class="frontier-image-window">
        <img src="./assets/mining-frontier/2012.webp"
          alt="Illustrative regional satellite sequence of Madre de Dios in 2012, showing the mining frontier from Huepetuhe and Delta Uno to La Pampa and Puerto Maldonado">
        <span class="frontier-puerto-label-blink" aria-hidden="true"></span>
        <span class="frontier-puerto-marker-blink" aria-hidden="true"></span>
      </div>
      <span class="frontier-loading" aria-hidden="true">ILLUSTRATIVE SEQUENCE · SAME REGION</span>
    </div>
    <div class="frontier-controls">
      <div class="frontier-controls-top">
        <span class="frontier-heading">THE MINING FRONTIER · 2012–2026</span>
        <output class="frontier-year" for="frontier-scrubber">2012</output>
        <button class="frontier-play" type="button" aria-label="Pause the yearly sequence">PAUSE Ⅱ</button>
      </div>
      <input class="frontier-scrubber" id="frontier-scrubber" type="range"
        min="2012" max="2026" step="1" value="2012"
        aria-label="Select satellite sequence year">
      <div class="frontier-ticks"><span>2012</span><span>DRAG THROUGH THE YEARS</span><span>2026 · LIVE MAP</span></div>
      <p class="frontier-note">Illustrative Landsat-based sequence; intermediate yearly changes are not verified annual disturbance measurements.
        <a href="https://source.coop/earthgenome/amazon-mining-watch" target="_blank" rel="noopener">2026 map outlines: Amazon Mining Watch</a>.</p>
    </div>`;
  wrap.insertBefore(timeline, document.querySelector('#connection-caption'));

  const image = timeline.querySelector('img');
  const scrubber = timeline.querySelector('input');
  const yearOutput = timeline.querySelector('output');
  const playButton = timeline.querySelector('button');
  let year = firstYear;
  let playing = false;
  let advanceTimer = null;
  let revealTimer = null;
  let frameEpoch = 0;
  let playEpoch = 0;

  // Retain the preload images until ready; this also avoids the year label
  // advancing before a new image has finished downloading on slow connections.
  const frameCache = new Map();
  for (let y = firstYear; y <= lastYear; y++) {
    const preload = new Image();
    preload.src = `./assets/mining-frontier/${y}.webp`;
    frameCache.set(y, preload);
  }
  const framesReady = Promise.all([...frameCache.values()].map(img => img.decode().catch(() => {})));

  function cancelTimers() {
    clearTimeout(advanceTimer);
    clearTimeout(revealTimer);
    advanceTimer = null;
    revealTimer = null;
  }
  function updateButton() {
    playButton.textContent = playing ? 'PAUSE Ⅱ' : 'PLAY ▶';
    playButton.setAttribute('aria-label', playing ? 'Pause the yearly sequence' : 'Play the yearly sequence');
  }
  function pause() {
    playEpoch++;
    playing = false;
    clearTimeout(advanceTimer);
    advanceTimer = null;
    updateButton();
  }
  function showYear(next, revealDelay = 1000) {
    year = Math.max(firstYear, Math.min(lastYear, Number(next)));
    scrubber.value = String(year);
    scrubber.style.setProperty('--frontier-progress', ((year-firstYear)/(lastYear-firstYear)*100)+'%');
    yearOutput.textContent = String(year);
    const epoch = ++frameEpoch;
    wrap.classList.remove('frontier-map-ready');
    clearTimeout(revealTimer);
    image.src = `./assets/mining-frontier/${year}.webp`;
    image.alt = year === lastYear
      ? 'Illustrative 2026 regional satellite view with model-detected mining disturbance highlighted in yellow before the interactive map appears'
      : `Illustrative regional satellite view of the Madre de Dios mining frontier for ${year}`;
    if (year === lastYear) {
      revealTimer = setTimeout(() => {
        if (epoch === frameEpoch && !timeline.hidden && current === 1) {
          wrap.classList.add('frontier-map-ready');
          // Leaflet is already underneath, with every interactive record intact.
          map.invalidateSize({pan: false});
        }
      }, revealDelay);
    }
  }
  function advance() {
    if (!playing || timeline.hidden || current !== 1) return;
    advanceTimer = setTimeout(() => {
      if (year < lastYear) {
        showYear(year + 1, 1600);
        advance();
      } else {
        pause();
      }
    }, 850);
  }
  function play() {
    cancelTimers();
    if (year === lastYear) showYear(firstYear);
    playing = true;
    updateButton();
    const epoch = ++playEpoch;
    framesReady.then(() => { if (playing && epoch === playEpoch) advance(); });
  }
  function revealMapImmediately() {
    if (timeline.hidden || current !== 1) return;
    pause();
    showYear(lastYear, 0);
  }
  function sync(chapter, resetView = false) {
    const active = chapter === 1;
    const wasActive = !timeline.hidden;
    const enteringFrontier = active && (resetView || !wasActive);
    timeline.hidden = !active;
    wrap.classList.toggle('frontier-active', active);
    // Pulse Puerto Maldonado's label and town marker only on the chapter's
    // opening satellite sequence, not during scrubbing or on other chapters.
    timeline.classList.remove('frontier-puerto-intro');
    if (enteringFrontier) {
      void timeline.offsetWidth; // restart the brief blink when revisiting
      timeline.classList.add('frontier-puerto-intro');
    }
    // Restore Leaflet's full-height viewport before the next chapter fits
    // its map bounds. Otherwise Chapter 3 retains half the timeline height
    // as a vertical offset until another chapter is selected.
    if (!active && wasActive) map.invalidateSize({pan: false});
    if (!active) {
      pause();
      cancelTimers();
      wrap.classList.remove('frontier-map-ready');
    } else if (resetView || !wasActive) {
      cancelTimers();
      showYear(firstYear);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        pause();
      } else {
        play();
      }
    }
    requestAnimationFrame(() => {
      map.invalidateSize({pan: false});
      // Chapter 2's shorter live-map viewport needs a little more room below
      // the southern mining sites. Move the map image up without changing zoom.
      if (enteringFrontier && current === 1) map.panBy([0, 83], {animate: false});
    });
  }
  scrubber.addEventListener('input', () => {
    pause();
    showYear(scrubber.value, 1000);
  });
  playButton.addEventListener('click', () => playing ? pause() : play());
  // Chapter 2 contains links that zoom the live map to a cited place. Reveal
  // that map when clicked, so their destination is not hidden by the sequence.
  document.querySelector('article').addEventListener('click', (event) => {
    if (event.target.closest('.place-map-link, .evidence-item, .oversight-map-jump, .map-actions button')) {
      revealMapImmediately();
    }
  }, true);
  window.frontierTimeline = { sync, revealMapImmediately };
  sync(current, true);
})();
