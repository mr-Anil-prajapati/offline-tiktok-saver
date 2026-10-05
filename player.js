/**
 * Offline TikTok-style Video Player
 * - 1. One-click / tap instant Play-Pause like Instagram (with center paused icon & header button)
 * - 2. All Playback Speeds: 1.0x, 1.5x, 1.75x, 2.0x, 2.5x, 3.0x, 3.5x, 4.0x
 * - 3. Always Load Folder: Loads all videos inside folder automatically
 * - 4. Auto-Framing in Fullscreen Mode
 * - 5. 2-Finger Pinch Zoom In / Out + Pan
 * - 6. Auto-hiding Minimalist Controls
 * - 100% Offline & Private
 */

(function () {
  'use strict';

  // Available Playback Speeds
  const SPEED_LEVELS = [1.0, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5, 4.0];

  // Application State
  const state = {
    videos: [],          // Array of { id, name, size, type, url, file, duration, width, height, isDemo }
    currentIndex: 0,
    isPlaying: false,
    isMuted: false,
    isFullscreen: false,
    isScrubbing: false,
    wheelCooldown: false,
    playbackRate: 1.0,
    loopMode: 'auto-next', // 'auto-next' or 'single-loop'
    rotation: 0,           // 0, 90, 180, 270

    // Pinch Zoom & Pan state
    currentScale: 1.0,
    panX: 0,
    panY: 0
  };

  // DOM Elements
  const appContainer = document.getElementById('app-container');
  const feedContainer = document.getElementById('feed-container');
  const blankScreen = document.getElementById('blank-screen');
  const controlsLayer = document.getElementById('controls-layer');
  const scrubContainer = document.getElementById('scrub-container');
  const scrubTrack = document.getElementById('scrub-track');
  const scrubProgress = document.getElementById('scrub-progress');
  const scrubBuffered = document.getElementById('scrub-buffered');
  const scrubHandle = document.getElementById('scrub-handle');
  const scrubTooltip = document.getElementById('scrub-tooltip');

  // Top Bar elements
  const btnPlaylistToggle = document.getElementById('btn-playlist-toggle');
  const btnHeaderPlayPause = document.getElementById('btn-header-playpause');
  const iconHeaderPause = document.getElementById('icon-header-pause');
  const iconHeaderPlay = document.getElementById('icon-header-play');
  const counterCurrent = document.getElementById('counter-current');
  const counterTotal = document.getElementById('counter-total');

  // Auto-Next & Loop elements
  const btnLoopMode = document.getElementById('btn-loop-mode');
  const iconModeAutonext = document.getElementById('icon-mode-autonext');
  const iconModeLoop = document.getElementById('icon-mode-loop');
  const loopModeLabel = document.getElementById('loop-mode-label');

  const btnOpenFolder = document.getElementById('btn-open-folder');
  const btnMute = document.getElementById('btn-mute');
  const iconSoundOn = document.getElementById('icon-sound-on');
  const iconSoundOff = document.getElementById('icon-sound-off');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const iconFsEnter = document.getElementById('icon-fs-enter');
  const iconFsExit = document.getElementById('icon-fs-exit');

  // Speed controls
  const btnSpeed = document.getElementById('btn-speed');
  const speedLabel = document.getElementById('speed-label');
  const speedDropdown = document.getElementById('speed-dropdown');

  // Instagram-style paused center indicator
  const pausedCenterIndicator = document.getElementById('paused-center-indicator');

  // Folder & File Inputs
  const folderInput = document.getElementById('folder-input');
  const fileInputMultiple = document.getElementById('file-input-multiple');
  const btnBlankLoadFolder = document.getElementById('btn-blank-load-folder');
  const btnDemoMode = document.getElementById('btn-demo-mode');

  // Feedback & Overlay
  const playPauseBadge = document.getElementById('play-pause-badge');
  const badgePlayIcon = document.getElementById('badge-play-icon');
  const badgePauseIcon = document.getElementById('badge-pause-icon');
  const zoomBadge = document.getElementById('zoom-badge');
  const dragDropOverlay = document.getElementById('drag-drop-overlay');
  const toastContainer = document.getElementById('toast-container');
  const ambientBackdrop = document.getElementById('ambient-backdrop');

  // Playlist Drawer
  const playlistDrawer = document.getElementById('playlist-drawer');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const btnDrawerClose = document.getElementById('btn-drawer-close');
  const playlistItemsList = document.getElementById('playlist-items-list');
  const drawerVideoCount = document.getElementById('drawer-video-count');
  const btnDrawerAddFolder = document.getElementById('btn-drawer-add-folder');
  const btnClearAll = document.getElementById('btn-clear-all');

  // Auto-hide controls timer
  let autoHideControlsTimeout = null;

  // Initialize App
  function init() {
    setupFolderLoading();
    setupPinchZoomAndGestures();
    setupScrubber();
    setupControlsLayer();
    setupSpeedControls();
    setupLoopMode();
    setupModals();
    setupDragAndDrop();
    setupKeyboardNavigation();
    setupOrientationAndFullscreenListeners();
    updateAmbientGlow();
  }

  /* ==========================================================================
     1. SPEED CONTROLS: 1.0x, 1.5x, 1.75x, 2.0x, 2.5x, 3.0x, 3.5x, 4.0x
     ========================================================================== */
  function setupSpeedControls() {
    if (!btnSpeed || !speedDropdown) return;

    btnSpeed.addEventListener('click', (e) => {
      e.stopPropagation();
      showControls();
      speedDropdown.classList.toggle('hidden');
    });

    // Close speed dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!speedDropdown.contains(e.target) && e.target !== btnSpeed) {
        speedDropdown.classList.add('hidden');
      }
    });

    const speedButtons = speedDropdown.querySelectorAll('.speed-option');
    speedButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chosenSpeed = parseFloat(btn.dataset.speed);
        setPlaybackSpeed(chosenSpeed);
        speedDropdown.classList.add('hidden');
      });
    });
  }

  function setPlaybackSpeed(rate) {
    state.playbackRate = rate;
    if (speedLabel) speedLabel.textContent = `${rate}x`;

    // Update active highlight in dropdown
    const speedButtons = speedDropdown.querySelectorAll('.speed-option');
    speedButtons.forEach(b => {
      const sp = parseFloat(b.dataset.speed);
      if (sp === rate) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    // Apply immediately to current active video
    const currentSlide = feedContainer.querySelector(`.video-slide[data-index="${state.currentIndex}"]`);
    if (currentSlide) {
      const videoEl = currentSlide.querySelector('video');
      if (videoEl) videoEl.playbackRate = rate;
    }

    showToast(`Speed: ${rate}x`);
    showControls();
  }

  function cyclePlaybackSpeed() {
    const curIdx = SPEED_LEVELS.indexOf(state.playbackRate);
    const nextIdx = (curIdx + 1) % SPEED_LEVELS.length;
    setPlaybackSpeed(SPEED_LEVELS[nextIdx]);
  }

  /* ==========================================================================
     Auto-Next & Loop Toggle
     ========================================================================== */
  function setupLoopMode() {
    if (btnLoopMode) {
      btnLoopMode.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLoopMode();
      });
    }
  }

  function toggleLoopMode() {
    state.loopMode = state.loopMode === 'auto-next' ? 'single-loop' : 'auto-next';
    applyLoopModeUI();
    showToast(state.loopMode === 'auto-next' ? 'Mode: Auto-Next (Advances to next video)' : 'Mode: Loop 1 (Repeats current video)');
    showControls();
  }

  function applyLoopModeUI() {
    const isSingleLoop = state.loopMode === 'single-loop';
    if (btnLoopMode) {
      if (isSingleLoop) {
        btnLoopMode.classList.add('is-looping');
        if (iconModeAutonext) iconModeAutonext.classList.add('hidden');
        if (iconModeLoop) iconModeLoop.classList.remove('hidden');
        if (loopModeLabel) loopModeLabel.textContent = 'Loop 1';
      } else {
        btnLoopMode.classList.remove('is-looping');
        if (iconModeAutonext) iconModeAutonext.classList.remove('hidden');
        if (iconModeLoop) iconModeLoop.classList.add('hidden');
        if (loopModeLabel) loopModeLabel.textContent = 'Auto-Next';
      }
    }

    const currentSlide = feedContainer.querySelector(`.video-slide[data-index="${state.currentIndex}"]`);
    if (currentSlide) {
      const videoEl = currentSlide.querySelector('video');
      if (videoEl) videoEl.loop = isSingleLoop;
    }
  }

  /* ==========================================================================
     2. ALWAYS LOAD FOLDER (Loads all videos in folder)
     ========================================================================== */
  function setupFolderLoading() {
    if (btnOpenFolder) btnOpenFolder.addEventListener('click', triggerFolderPicker);
    if (btnBlankLoadFolder) btnBlankLoadFolder.addEventListener('click', triggerFolderPicker);
    if (btnDrawerAddFolder) btnDrawerAddFolder.addEventListener('click', triggerFolderPicker);

    if (folderInput) {
      folderInput.addEventListener('change', (e) => {
        handleFolderFiles(e.target.files);
        folderInput.value = '';
      });
    }

    if (fileInputMultiple) {
      fileInputMultiple.addEventListener('change', (e) => {
        handleFolderFiles(e.target.files);
        fileInputMultiple.value = '';
      });
    }

    if (btnDemoMode) {
      btnDemoMode.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        generateDemoVideos();
      });
    }
  }

  function triggerFolderPicker() {
    if (folderInput) folderInput.click();
  }

  function handleFolderFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    const newVideos = [];
    const validVideoExtensions = /\.(mp4|webm|ogg|mov|m4v|mkv|avi|flv|ts|3gp)$/i;
    const filesArray = Array.from(fileList);

    // Natural sort
    filesArray.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    let folderName = '';

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];

      if (!folderName && file.webkitRelativePath) {
        folderName = file.webkitRelativePath.split('/')[0];
      }

      if (file.name.toLowerCase().endsWith('.zip')) {
        handleZipFile(file);
        continue;
      }

      if (file.type.startsWith('video/') || validVideoExtensions.test(file.name)) {
        const url = URL.createObjectURL(file);
        newVideos.push({
          id: 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          name: file.name,
          size: formatBytes(file.size),
          type: file.type || 'video/mp4',
          file: file,
          url: url,
          duration: 0,
          width: 0,
          height: 0,
          isDemo: false
        });
      }
    }

    if (newVideos.length === 0) {
      showToast('No video files found in selected folder');
      return;
    }

    const wasEmpty = state.videos.length === 0;
    const startIndex = state.videos.length;
    state.videos.push(...newVideos);

    renderSlides(wasEmpty ? 0 : startIndex);
    updatePlaylistDrawer();

    const title = folderName ? `"${folderName}"` : 'folder';
    showToast(`Loaded ${newVideos.length} video${newVideos.length > 1 ? 's' : ''} from ${title}`);
    showControls();
  }

  function handleZipFile(zipFile) {
    showToast('Reading ZIP file...');
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const buffer = e.target.result;
        const view = new DataView(buffer);
        let offset = 0;
        const extractedFiles = [];

        while (offset < buffer.byteLength - 30) {
          if (view.getUint32(offset, true) === 0x04034b50) {
            const compression = view.getUint16(offset + 8, true);
            const compressedSize = view.getUint32(offset + 18, true);
            const uncompressedSize = view.getUint32(offset + 22, true);
            const fileNameLen = view.getUint16(offset + 26, true);
            const extraLen = view.getUint16(offset + 28, true);

            const nameBuffer = new Uint8Array(buffer, offset + 30, fileNameLen);
            const fileName = new TextDecoder().decode(nameBuffer);
            const dataOffset = offset + 30 + fileNameLen + extraLen;

            if (/\.(mp4|webm|ogg|mov|m4v|mkv)$/i.test(fileName) && compression === 0) {
              const fileData = buffer.slice(dataOffset, dataOffset + uncompressedSize);
              const blob = new Blob([fileData], { type: 'video/mp4' });
              const url = URL.createObjectURL(blob);
              extractedFiles.push({
                id: 'v_zip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                name: fileName.split('/').pop(),
                size: formatBytes(uncompressedSize),
                type: 'video/mp4',
                file: null,
                url: url,
                duration: 0,
                width: 0,
                height: 0,
                isDemo: false
              });
            }

            offset = dataOffset + compressedSize;
          } else {
            offset++;
          }
        }

        if (extractedFiles.length > 0) {
          const wasEmpty = state.videos.length === 0;
          state.videos.push(...extractedFiles);
          renderSlides(wasEmpty ? 0 : state.currentIndex);
          updatePlaylistDrawer();
          showToast(`Extracted ${extractedFiles.length} video(s) from ZIP!`);
        }
      } catch (err) {
        showToast('Could not extract ZIP.');
      }
    };
    reader.readAsArrayBuffer(zipFile);
  }

  function generateDemoVideos() {
    showToast('Creating sample demo videos...');

    const demoThemes = [
      { title: 'Cyber Pulse #1 (Portrait 9:16)', color1: '#FE2C55', color2: '#25F4EE', text: 'OFFLINE TIKTOK PLAYER', w: 720, h: 1280 },
      { title: 'Horizon Glow #2 (Landscape 16:9)', color1: '#FF8A00', color2: '#E52E71', text: 'AUTO FRAMING FULLSCREEN', w: 1280, h: 720 },
      { title: 'Neon Waves #3 (Square 1:1)', color1: '#7F00FF', color2: '#00D2FF', text: 'INSTANT TAP PLAY-PAUSE', w: 720, h: 720 }
    ];

    const generated = [];

    demoThemes.forEach((theme, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = theme.w;
      canvas.height = theme.h;
      const ctx = canvas.getContext('2d');

      const stream = canvas.captureStream(30);
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      } catch(e) {
        mediaRecorder = new MediaRecorder(stream);
      }

      const chunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        generated.push({
          id: 'demo_' + index + '_' + Date.now(),
          name: theme.title + '.webm',
          size: formatBytes(blob.size),
          type: 'video/webm',
          file: null,
          url: url,
          duration: 4,
          width: theme.w,
          height: theme.h,
          isDemo: true
        });

        if (generated.length === demoThemes.length) {
          const wasEmpty = state.videos.length === 0;
          state.videos.push(...generated);
          renderSlides(wasEmpty ? 0 : state.currentIndex);
          updatePlaylistDrawer();
          showToast('Loaded 3 Demo Videos!');
          showControls();
        }
      };

      mediaRecorder.start();

      let frame = 0;
      const totalFrames = 120; // 4s

      function drawFrame() {
        frame++;
        const progress = frame / totalFrames;

        const grad = ctx.createLinearGradient(0, 0, theme.w, theme.h);
        grad.addColorStop(0, theme.color1);
        grad.addColorStop(1, theme.color2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, theme.w, theme.h);

        for (let i = 0; i < 4; i++) {
          const angle = progress * Math.PI * 2 + (i * Math.PI / 2);
          const cx = (theme.w / 2) + Math.cos(angle) * (theme.w * 0.25);
          const cy = (theme.h / 2) + Math.sin(angle) * (theme.h * 0.25);
          ctx.beginPath();
          ctx.arc(cx, cy, 60 + Math.sin(progress * 6 + i) * 20, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + (i * 0.05)})`;
          ctx.fill();
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        const cardW = Math.min(theme.w * 0.85, 540);
        const cardH = 220;
        const cardX = (theme.w - cardW) / 2;
        const cardY = (theme.h - cardH) / 2;
        ctx.roundRect ? ctx.roundRect(cardX, cardY, cardW, cardH, 20) : ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(theme.text, theme.w / 2, cardY + 80);

        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(`Sample Video #${index + 1} (${theme.w}x${theme.h})`, theme.w / 2, cardY + 130);

        const remaining = ((totalFrames - frame) / 30).toFixed(1);
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#25F4EE';
        ctx.fillText(`00:0${remaining}s`, theme.w / 2, cardY + 180);

        if (frame < totalFrames) {
          requestAnimationFrame(drawFrame);
        } else {
          mediaRecorder.stop();
        }
      }

      drawFrame();
    });
  }

  /* ==========================================================================
     Feed & Slides Rendering
     ========================================================================== */
  function renderSlides(targetIndex = 0) {
    if (state.videos.length === 0) {
      blankScreen.classList.remove('hidden');
      feedContainer.classList.add('hidden');
      pausedCenterIndicator.classList.add('hidden');
      updateCounters();
      return;
    }

    blankScreen.classList.add('hidden');
    feedContainer.classList.remove('hidden');

    feedContainer.innerHTML = '';

    state.videos.forEach((video, index) => {
      const slide = document.createElement('div');
      slide.className = 'video-slide';
      slide.dataset.index = index;

      const zoomWrapper = document.createElement('div');
      zoomWrapper.className = 'video-zoom-wrapper';

      const videoEl = document.createElement('video');
      videoEl.className = 'video-element';
      videoEl.playsInline = true;
      videoEl.webkitPlaysinline = true;
      videoEl.muted = state.isMuted;
      videoEl.preload = Math.abs(index - targetIndex) <= 1 ? 'auto' : 'none';
      videoEl.src = video.url;
      videoEl.loop = (state.loopMode === 'single-loop');
      videoEl.playbackRate = state.playbackRate;

      const spinner = document.createElement('div');
      spinner.className = 'video-loading-spinner';

      zoomWrapper.appendChild(videoEl);
      slide.appendChild(zoomWrapper);
      slide.appendChild(spinner);
      feedContainer.appendChild(slide);

      attachVideoListeners(videoEl, slide, index);
    });

    updateCounters();
    scrollToVideo(targetIndex, false);
  }

  function attachVideoListeners(videoEl, slide, index) {
    videoEl.addEventListener('loadedmetadata', () => {
      const w = videoEl.videoWidth || 720;
      const h = videoEl.videoHeight || 1280;

      if (state.videos[index]) {
        state.videos[index].duration = videoEl.duration;
        state.videos[index].width = w;
        state.videos[index].height = h;
      }

      applyVideoFraming(slide, w, h);
    });

    videoEl.addEventListener('waiting', () => {
      slide.classList.add('is-buffering');
    });

    videoEl.addEventListener('playing', () => {
      slide.classList.remove('is-buffering');
      if (index === state.currentIndex) {
        setPlayPauseUIState(true);
      }
    });

    videoEl.addEventListener('pause', () => {
      if (index === state.currentIndex) {
        setPlayPauseUIState(false);
      }
    });

    videoEl.addEventListener('timeupdate', () => {
      if (index === state.currentIndex && !state.isScrubbing) {
        updateScrubberUI(videoEl.currentTime, videoEl.duration);
      }
    });

    // Video ended event: adhere to Auto-Next vs Single-Loop
    videoEl.addEventListener('ended', () => {
      if (state.loopMode === 'auto-next') {
        if (state.currentIndex < state.videos.length - 1) {
          scrollToVideo(state.currentIndex + 1);
        } else {
          scrollToVideo(0);
        }
      }
    });

    // 1. INSTAGRAM-STYLE INSTANT TAP/CLICK PLAY-PAUSE
    // Only used on PC (mouse click). Touch tap handled via touchend on feedContainer.
    videoEl.addEventListener('click', (e) => {
      // On touch devices, touchend fires before click — we skip click if already handled
      if (state.currentScale > 1.05) return;
      if (e.detail === 0) return; // fired by touch, skip (touchend already handled it)
      togglePlayPauseCurrent();
      showControls();
    });
  }

  /* ==========================================================================
     AUTO-FRAMING IN FULLSCREEN & NORMAL MODES
     ========================================================================== */
  function applyVideoFraming(slide, width, height) {
    const ratio = width / height;
    slide.classList.remove('frame-portrait', 'frame-landscape', 'frame-square');

    if (ratio < 0.8) {
      slide.classList.add('frame-portrait');
    } else if (ratio > 1.25) {
      slide.classList.add('frame-landscape');
    } else {
      slide.classList.add('frame-square');
    }

    if (state.isFullscreen) {
      const screenRatio = window.innerWidth / window.innerHeight;
      const videoEl = slide.querySelector('video');
      if (videoEl) {
        if (ratio > 1.1 && screenRatio < 1.0) {
          videoEl.style.objectFit = 'contain';
        } else if (ratio <= 1.0 && screenRatio < 1.0) {
          videoEl.style.objectFit = 'cover';
        } else if (ratio > 1.1 && screenRatio >= 1.0) {
          videoEl.style.objectFit = 'contain';
        }
      }
    }
  }

  function setupOrientationAndFullscreenListeners() {
    window.addEventListener('resize', recalculateAllVideoFrames);
    window.addEventListener('orientationchange', () => {
      setTimeout(recalculateAllVideoFrames, 200);
    });
  }

  function recalculateAllVideoFrames() {
    const slides = feedContainer.querySelectorAll('.video-slide');
    slides.forEach((slide, idx) => {
      const v = state.videos[idx];
      if (v && v.width && v.height) {
        applyVideoFraming(slide, v.width, v.height);
      }
    });
  }

  /* ==========================================================================
     Navigation & Playback Control
     ========================================================================== */
  function scrollToVideo(index, smooth = true) {
    if (index < 0 || index >= state.videos.length) return;

    resetActiveZoom();
    state.currentIndex = index;

    const slides = feedContainer.querySelectorAll('.video-slide');
    const targetSlide = slides[index];

    if (targetSlide) {
      targetSlide.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }

    updateActiveVideoState();
  }

  function updateActiveVideoState() {
    const slides = feedContainer.querySelectorAll('.video-slide');
    const currentVideo = state.videos[state.currentIndex];
    if (!currentVideo) return;

    slides.forEach((slide, idx) => {
      const videoEl = slide.querySelector('video');
      if (!videoEl) return;

      if (idx === state.currentIndex) {
        if (!videoEl.src) videoEl.src = state.videos[idx].url;
        videoEl.muted = state.isMuted;
        videoEl.playbackRate = state.playbackRate;
        videoEl.loop = (state.loopMode === 'single-loop');

        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setPlayPauseUIState(true);
          }).catch(() => {
            setPlayPauseUIState(false);
          });
        }
      } else {
        videoEl.pause();
        if (Math.abs(idx - state.currentIndex) > 2) {
          videoEl.removeAttribute('src');
          videoEl.load();
        } else if (!videoEl.src) {
          videoEl.src = state.videos[idx].url;
        }
      }
    });

    updateCounters();
    updateAmbientGlow();
  }

  /* ==========================================================================
     1. INSTAGRAM-STYLE ONE-TAP PLAY / PAUSE
     ========================================================================== */
  function togglePlayPauseCurrent() {
    const activeSlide = feedContainer.querySelector(`.video-slide[data-index="${state.currentIndex}"]`);
    if (!activeSlide) return;
    const videoEl = activeSlide.querySelector('video');
    if (!videoEl) return;

    if (videoEl.paused) {
      videoEl.playbackRate = state.playbackRate;
      videoEl.play().then(() => {
        setPlayPauseUIState(true);
        showPlayPauseAnimation('play');
      }).catch(err => {
        console.warn('Playback blocked', err);
      });
    } else {
      videoEl.pause();
      setPlayPauseUIState(false);
      showPlayPauseAnimation('pause');
    }
  }

  function setPlayPauseUIState(isPlaying) {
    state.isPlaying = isPlaying;

    if (isPlaying) {
      if (iconHeaderPlay) iconHeaderPlay.classList.add('hidden');
      if (iconHeaderPause) iconHeaderPause.classList.remove('hidden');
      if (btnHeaderPlayPause) btnHeaderPlayPause.title = 'Pause Video (Space or Tap)';
      if (pausedCenterIndicator) pausedCenterIndicator.classList.add('hidden');
    } else {
      if (iconHeaderPlay) iconHeaderPlay.classList.remove('hidden');
      if (iconHeaderPause) iconHeaderPause.classList.add('hidden');
      if (btnHeaderPlayPause) btnHeaderPlayPause.title = 'Play Video (Space or Tap)';
      if (pausedCenterIndicator && state.videos.length > 0) pausedCenterIndicator.classList.remove('hidden');
      showControls(); // Keep controls visible when paused
    }
  }

  function showPlayPauseAnimation(type) {
    if (type === 'play') {
      badgePlayIcon.classList.remove('hidden');
      badgePauseIcon.classList.add('hidden');
    } else {
      badgePlayIcon.classList.add('hidden');
      badgePauseIcon.classList.remove('hidden');
    }

    playPauseBadge.classList.add('show');
    clearTimeout(playPauseBadge._timer);
    playPauseBadge._timer = setTimeout(() => {
      playPauseBadge.classList.remove('show');
    }, 400);
  }

  function toggleMute() {
    state.isMuted = !state.isMuted;
    if (state.isMuted) {
      iconSoundOn.classList.add('hidden');
      iconSoundOff.classList.remove('hidden');
    } else {
      iconSoundOn.classList.remove('hidden');
      iconSoundOff.classList.add('hidden');
    }

    const currentSlide = feedContainer.querySelector(`.video-slide[data-index="${state.currentIndex}"]`);
    if (currentSlide) {
      const videoEl = currentSlide.querySelector('video');
      if (videoEl) videoEl.muted = state.isMuted;
    }

    showToast(state.isMuted ? 'Muted' : 'Sound On');
    showControls();
  }

  /* ==========================================================================
     2-Finger Pinch Zoom In / Out + Touch Gestures
     ========================================================================== */
  function setupPinchZoomAndGestures() {
    let startDistance = 0;
    let initialScale = 1.0;
    let isPinching = false;

    let touchStartY = 0;
    let touchStartX = 0;
    let touchStartTime = 0;
    let startPanX = 0;
    let startPanY = 0;
    let touchMovedDistance = 0;

    // Instagram paused center indicator tap
    if (pausedCenterIndicator) {
      pausedCenterIndicator.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlayPauseCurrent();
        showControls();
      });
    }

    feedContainer.addEventListener('touchstart', (e) => {
      showControls();

      if (e.touches.length === 2) {
        isPinching = true;
        startDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScale = state.currentScale;
        feedContainer.classList.add('is-zoomed');
      } else if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        startPanX = state.panX;
        startPanY = state.panY;
        touchMovedDistance = 0;
      }
    }, { passive: false });

    feedContainer.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );

        if (startDistance > 0) {
          const factor = currentDistance / startDistance;
          state.currentScale = Math.min(Math.max(1.0, initialScale * factor), 4.0);
          applyActiveZoomTransform();
          showZoomBadge(state.currentScale);
        }
      } else if (e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;
        touchMovedDistance = Math.hypot(deltaX, deltaY);

        if (state.currentScale > 1.08) {
          e.preventDefault();
          const maxPanX = (feedContainer.clientWidth * (state.currentScale - 1)) / 2;
          const maxPanY = (feedContainer.clientHeight * (state.currentScale - 1)) / 2;

          state.panX = Math.min(maxPanX, Math.max(-maxPanX, startPanX + deltaX));
          state.panY = Math.min(maxPanY, Math.max(-maxPanY, startPanY + deltaY));
          applyActiveZoomTransform();
        }
      }
    }, { passive: false });

    feedContainer.addEventListener('touchend', (e) => {
      if (isPinching && e.touches.length < 2) {
        isPinching = false;
        if (state.currentScale <= 1.08) {
          resetActiveZoom();
        }
      }

      if (e.touches.length === 0) {
        const touchEndY = e.changedTouches[0].clientY;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaY = touchEndY - touchStartY;
        const deltaX = touchEndX - touchStartX;
        const deltaTime = Date.now() - touchStartTime;
        const movedDist = Math.hypot(deltaX, deltaY);

        // Instagram instant tap: short time, barely moved, not zoomed
        if (movedDist < 12 && deltaTime < 300 && state.currentScale <= 1.05) {
          togglePlayPauseCurrent();
          showControls();
          return;
        }

        // Vertical swipe between videos (not zoomed)
        if (state.currentScale <= 1.08) {
          if (Math.abs(deltaY) > 40 || (Math.abs(deltaY) > 20 && deltaTime < 250)) {
            if (deltaY < 0) {
              if (state.currentIndex < state.videos.length - 1) scrollToVideo(state.currentIndex + 1);
            } else {
              if (state.currentIndex > 0) scrollToVideo(state.currentIndex - 1);
            }
          }
        }
      }
    }, { passive: true });

    // PC Support: Mouse wheel
    feedContainer.addEventListener('wheel', (e) => {
      showControls();

      if (e.ctrlKey) {
        e.preventDefault();
        const zoomDelta = e.deltaY < 0 ? 0.2 : -0.2;
        state.currentScale = Math.min(Math.max(1.0, state.currentScale + zoomDelta), 4.0);

        if (state.currentScale <= 1.05) {
          resetActiveZoom();
        } else {
          feedContainer.classList.add('is-zoomed');
          applyActiveZoomTransform();
          showZoomBadge(state.currentScale);
        }
        return;
      }

      if (state.currentScale > 1.08) {
        e.preventDefault();
        const maxPanY = (feedContainer.clientHeight * (state.currentScale - 1)) / 2;
        state.panY = Math.min(maxPanY, Math.max(-maxPanY, state.panY - e.deltaY));
        applyActiveZoomTransform();
        return;
      }

      e.preventDefault();
      if (state.wheelCooldown) return;

      if (e.deltaY > 20) {
        if (state.currentIndex < state.videos.length - 1) {
          state.wheelCooldown = true;
          scrollToVideo(state.currentIndex + 1);
          setTimeout(() => { state.wheelCooldown = false; }, 380);
        }
      } else if (e.deltaY < -20) {
        if (state.currentIndex > 0) {
          state.wheelCooldown = true;
          scrollToVideo(state.currentIndex - 1);
          setTimeout(() => { state.wheelCooldown = false; }, 380);
        }
      }
    }, { passive: false });

    // Double click to toggle 1x and 2x zoom on PC
    feedContainer.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (state.currentScale > 1.1) {
        resetActiveZoom();
      } else {
        state.currentScale = 2.0;
        state.panX = 0;
        state.panY = 0;
        feedContainer.classList.add('is-zoomed');
        applyActiveZoomTransform();
        showZoomBadge(2.0);
      }
    });

    let scrollTimeout;
    feedContainer.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (state.currentScale > 1.05) return;
        const slideHeight = feedContainer.clientHeight;
        if (slideHeight > 0) {
          const newIdx = Math.round(feedContainer.scrollTop / slideHeight);
          if (newIdx !== state.currentIndex && newIdx >= 0 && newIdx < state.videos.length) {
            state.currentIndex = newIdx;
            updateActiveVideoState();
          }
        }
      }, 90);
    });
  }

  function rotateVideo() {
    state.rotation = (state.rotation + 90) % 360;
    applyActiveZoomTransform();
    showToast(`Rotated: ${state.rotation}°`);
    showControls();
  }

  function applyActiveZoomTransform() {
    const currentSlide = feedContainer.querySelector(`.video-slide[data-index="${state.currentIndex}"]`);
    if (!currentSlide) return;
    const wrapper = currentSlide.querySelector('.video-zoom-wrapper');
    if (!wrapper) return;

    wrapper.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.currentScale}) rotate(${state.rotation}deg)`;
  }

  function resetActiveZoom() {
    state.currentScale = 1.0;
    state.panX = 0;
    state.panY = 0;
    state.rotation = 0;
    feedContainer.classList.remove('is-zoomed');

    const slides = feedContainer.querySelectorAll('.video-slide');
    slides.forEach(slide => {
      const wrapper = slide.querySelector('.video-zoom-wrapper');
      if (wrapper) wrapper.style.transform = 'translate(0px, 0px) scale(1) rotate(0deg)';
    });
  }

  function showZoomBadge(scale) {
    zoomBadge.textContent = scale.toFixed(1) + 'x';
    zoomBadge.classList.add('show');
    clearTimeout(zoomBadge._timer);
    zoomBadge._timer = setTimeout(() => {
      zoomBadge.classList.remove('show');
    }, 1200);
  }

  /* ==========================================================================
     Auto-Hiding Controls Layer
     ========================================================================== */
  function setupControlsLayer() {
    function triggerUserActivity() {
      showControls();
    }

    window.addEventListener('mousemove', triggerUserActivity, { passive: true });
    window.addEventListener('pointerdown', triggerUserActivity, { passive: true });
    window.addEventListener('touchstart', triggerUserActivity, { passive: true });
    window.addEventListener('keydown', triggerUserActivity, { passive: true });

    if (btnHeaderPlayPause) {
      btnHeaderPlayPause.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlayPauseCurrent();
        showControls();
      });
    }
    if (btnMute) btnMute.addEventListener('click', toggleMute);
    if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);

    resetAutoHideTimer();
  }

  function showControls() {
    controlsLayer.classList.add('visible');
    resetAutoHideTimer();
  }

  function resetAutoHideTimer() {
    clearTimeout(autoHideControlsTimeout);
    autoHideControlsTimeout = setTimeout(() => {
      // Don't auto-hide if playlist drawer or speed dropdown is open or user is scrubbing
      if (
        playlistDrawer.classList.contains('is-open') ||
        (speedDropdown && !speedDropdown.classList.contains('hidden')) ||
        state.isScrubbing
      ) {
        return;
      }
      if (state.videos.length > 0 && state.isPlaying) {
        controlsLayer.classList.remove('visible');
      }
    }, 2800);
  }

  /* ==========================================================================
     Scrubber
     ========================================================================== */
  function setupScrubber() {
    function handleScrub(e) {
      showControls();
      const currentSlide = feedContainer.querySelector(`.video-slide[data-index="${state.currentIndex}"]`);
      if (!currentSlide) return;
      const videoEl = currentSlide.querySelector('video');
      if (!videoEl || !videoEl.duration) return;

      const rect = scrubTrack.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetTime = pos * videoEl.duration;

      updateScrubberUI(targetTime, videoEl.duration);

      scrubTooltip.style.left = `${pos * 100}%`;
      scrubTooltip.textContent = formatTime(targetTime);

      if (!state.isScrubbing) {
        state.isScrubbing = true;
        scrubContainer.classList.add('is-scrubbing');
      }

      videoEl.currentTime = targetTime;
    }

    function stopScrub() {
      if (state.isScrubbing) {
        state.isScrubbing = false;
        scrubContainer.classList.remove('is-scrubbing');
        resetAutoHideTimer();
      }
      window.removeEventListener('mousemove', handleScrub);
      window.removeEventListener('mouseup', stopScrub);
      window.removeEventListener('touchmove', handleScrub);
      window.removeEventListener('touchend', stopScrub);
    }

    scrubTrack.addEventListener('mousedown', (e) => {
      handleScrub(e);
      window.addEventListener('mousemove', handleScrub);
      window.addEventListener('mouseup', stopScrub);
    });

    scrubTrack.addEventListener('touchstart', (e) => {
      handleScrub(e);
      window.addEventListener('touchmove', handleScrub, { passive: false });
      window.addEventListener('touchend', stopScrub);
    }, { passive: false });
  }

  function updateScrubberUI(currentTime, duration) {
    if (!duration || duration <= 0) return;
    const pct = Math.min(100, Math.max(0, (currentTime / duration) * 100));
    scrubProgress.style.width = `${pct}%`;
    scrubHandle.style.left = `${pct}%`;

    // Update buffered range
    const currentSlide = feedContainer.querySelector(`.video-slide[data-index="${state.currentIndex}"]`);
    if (currentSlide) {
      const videoEl = currentSlide.querySelector('video');
      if (videoEl && videoEl.buffered.length > 0) {
        const bufferedEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
        const bufferedPct = Math.min(100, (bufferedEnd / duration) * 100);
        if (scrubBuffered) scrubBuffered.style.width = `${bufferedPct}%`;
      }
    }
  }

  /* ==========================================================================
     Fullscreen API
     ========================================================================== */
  function toggleFullscreen() {
    showControls();
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const req = appContainer.requestFullscreen || appContainer.webkitRequestFullscreen || appContainer.mozRequestFullScreen;
      if (req) {
        req.call(appContainer).then(() => {
          setFullscreenUI(true);
        }).catch(err => {
          console.warn('Fullscreen blocked', err);
        });
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
      if (exit) {
        exit.call(document).then(() => {
          setFullscreenUI(false);
        });
      }
    }
  }

  function setFullscreenUI(isFs) {
    state.isFullscreen = isFs;
    if (isFs) {
      document.body.classList.add('is-fullscreen');
      if (iconFsEnter) iconFsEnter.classList.add('hidden');
      if (iconFsExit) iconFsExit.classList.remove('hidden');
    } else {
      document.body.classList.remove('is-fullscreen');
      if (iconFsEnter) iconFsEnter.classList.remove('hidden');
      if (iconFsExit) iconFsExit.classList.add('hidden');
    }
    recalculateAllVideoFrames();
  }

  document.addEventListener('fullscreenchange', () => setFullscreenUI(!!document.fullscreenElement));
  document.addEventListener('webkitfullscreenchange', () => setFullscreenUI(!!document.webkitFullscreenElement));

  /* ==========================================================================
     Keyboard Shortcuts
     ========================================================================== */
  function setupKeyboardNavigation() {
    window.addEventListener('keydown', (e) => {
      showControls();

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
        case 'J':
          e.preventDefault();
          if (state.currentIndex < state.videos.length - 1) scrollToVideo(state.currentIndex + 1);
          break;
        case 'ArrowUp':
        case 'k':
        case 'K':
          e.preventDefault();
          if (state.currentIndex > 0) scrollToVideo(state.currentIndex - 1);
          break;
        case ' ':
          e.preventDefault();
          togglePlayPauseCurrent();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          cyclePlaybackSpeed();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          toggleLoopMode();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          rotateVideo();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case '0':
          e.preventDefault();
          resetActiveZoom();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekDelta(5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekDelta(-5);
          break;
      }
    });
  }

  function seekDelta(seconds) {
    const currentSlide = feedContainer.querySelector(`.video-slide[data-index="${state.currentIndex}"]`);
    if (!currentSlide) return;
    const videoEl = currentSlide.querySelector('video');
    if (videoEl && videoEl.duration) {
      videoEl.currentTime = Math.max(0, Math.min(videoEl.duration, videoEl.currentTime + seconds));
    }
  }

  /* ==========================================================================
     Playlist Drawer & Modals
     ========================================================================== */
  function setupModals() {
    btnPlaylistToggle.addEventListener('click', openPlaylistDrawer);
    btnDrawerClose.addEventListener('click', closePlaylistDrawer);
    drawerBackdrop.addEventListener('click', closePlaylistDrawer);

    btnClearAll.addEventListener('click', () => {
      if (confirm('Clear all loaded videos?')) {
        state.videos.forEach(v => {
          if (v.url && v.url.startsWith('blob:')) URL.revokeObjectURL(v.url);
        });
        state.videos = [];
        state.currentIndex = 0;
        resetActiveZoom();
        renderSlides(0);
        closePlaylistDrawer();
        showToast('All videos cleared');
      }
    });
  }

  function openPlaylistDrawer() {
    showControls();
    updatePlaylistDrawer();
    playlistDrawer.classList.add('is-open');
  }

  function closePlaylistDrawer() {
    playlistDrawer.classList.remove('is-open');
    resetAutoHideTimer();
  }

  function updatePlaylistDrawer() {
    playlistItemsList.innerHTML = '';

    if (state.videos.length === 0) {
      const li = document.createElement('li');
      li.style.padding = '20px';
      li.style.textAlign = 'center';
      li.style.color = 'rgba(255, 255, 255, 0.4)';
      li.textContent = 'No videos loaded yet.';
      playlistItemsList.appendChild(li);
      return;
    }

    state.videos.forEach((video, index) => {
      const item = document.createElement('li');
      item.className = `playlist-item ${index === state.currentIndex ? 'is-active' : ''}`;
      item.innerHTML = `
        <div class="playlist-thumb">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </div>
        <div class="playlist-details">
          <div class="playlist-name">${escapeHtml(video.name)}</div>
          <div class="playlist-meta">#${index + 1} • ${video.size || 'Local File'}</div>
        </div>
      `;

      item.addEventListener('click', () => {
        closePlaylistDrawer();
        scrollToVideo(index);
      });

      playlistItemsList.appendChild(item);
    });
  }

  function updateCounters() {
    const total = state.videos.length;
    const current = total > 0 ? state.currentIndex + 1 : 0;
    if (counterCurrent && counterTotal) {
      counterCurrent.textContent = current;
      counterTotal.textContent = total;
    }
    if (drawerVideoCount) drawerVideoCount.textContent = `${total} loaded`;
  }

  function updateAmbientGlow() {
    if (!ambientBackdrop) return;
    const hue1 = (state.currentIndex * 75) % 360;
    const hue2 = (hue1 + 130) % 360;
    ambientBackdrop.style.background = `radial-gradient(circle at 50% 50%, hsla(${hue1}, 80%, 55%, 0.14) 0%, hsla(${hue2}, 75%, 45%, 0.08) 40%, #000 80%)`;
  }

  /* ==========================================================================
     Drag & Drop
     ========================================================================== */
  function setupDragAndDrop() {
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      dragDropOverlay.classList.add('is-active');
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dragDropOverlay.classList.remove('is-active');
      }
    });

    window.addEventListener('dragover', (e) => e.preventDefault());

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      dragDropOverlay.classList.remove('is-active');

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFolderFiles(e.dataTransfer.files);
      }
    });
  }

  /* ==========================================================================
     Utilities
     ========================================================================== */
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.remove(), 2400);
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[m]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
