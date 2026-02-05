/* --- Radio Tuner Logic --- */
const radioChannels = [
    'Productivity',
    'Focus',
    'Daily Flow',
    'Discovery',
    'Entertainment'
];

let tunerItems = [];
const radioBoxWidth = 453; // Matches CSS
const radioItemWidth = radioBoxWidth / 2; // 226.5px
const radioSetRepeats = 5;
const radioCenterSetIndex = 2; // Data centers around this set

let isRadioDragging = false;
let radioStartX = 0;
let radioCurrentX = 0;
let radioDragStartX = 0;
let radioRafId = null;
let currentRadioTheme = 'Productivity';
let isRadioLoading = false;

document.addEventListener('DOMContentLoaded', () => {
    initTuner();
    initVerticalTuner();
});

function initTuner() {
    const track = document.getElementById('radio-track');
    if (!track) return;

    // Build the tick HTML structure
    let ticksHtml = '<div class="tick-mark-wrapper">';
    for (let i = 0; i < 21; i++) {
        if (i === 10) { // Center major tick
            ticksHtml += '<div class="tick-unit"><div class="major-tick"></div></div>';
        } else {
            ticksHtml += '<div class="tick-unit"><div class="minor-tick"></div></div>';
        }
    }
    ticksHtml += '</div>';

    let html = '';
    for (let i = 0; i < radioSetRepeats; i++) {
        radioChannels.forEach((channel, index) => {
            html += `
                <div class="channel-item" data-index="${index}">
                    <div class="text-label">${channel}</div>
                    ${ticksHtml}
                </div>`;
        });
    }
    track.innerHTML = html;
    
    // Force widths
    tunerItems = Array.from(track.querySelectorAll('.channel-item'));
    tunerItems.forEach(item => {
        item.style.width = `${radioItemWidth}px`;
    });

    // Init Drag Logic
    const wrapper = document.querySelector('.radio-tuner-wrapper');
    if (wrapper) {
        wrapper.addEventListener('mousedown', startRadioDrag);
        wrapper.addEventListener('touchstart', startRadioDrag, { passive: false });
    }
    
    // Init Position
    const startItemIndex = radioCenterSetIndex * radioChannels.length; 
    const startPos = -(startItemIndex * radioItemWidth + radioItemWidth / 2);
    
    updateRadioPosition(startPos);
    
    // Set initial theme
    currentRadioTheme = radioChannels[0]; // Productivity
    updateActiveRadioItem(); // Ensure visual active state

    // Play Button Logic
    const btnPlay = document.getElementById('radio-play-btn');
    if (btnPlay) {
        btnPlay.onclick = togglePlay;
    }
    const writePlayBtn = document.getElementById('write-play-btn');
    if (writePlayBtn) {
        writePlayBtn.onclick = togglePlay;
    }
    const recapPlayBtn = document.getElementById('recap-play-btn');
    if (recapPlayBtn) {
        recapPlayBtn.onclick = togglePlay;
    }
}

function startRadioDrag(e) {
    if (isRadioLoading) return;
    isRadioDragging = true;
    radioStartX = (e.type.includes('mouse')) ? e.clientX : e.touches[0].clientX;
    radioDragStartX = radioCurrentX;
    
    cancelAnimationFrame(radioRafId);
    
    document.addEventListener('mousemove', dragRadio);
    document.addEventListener('touchmove', dragRadio, { passive: false });
    document.addEventListener('mouseup', endRadioDrag);
    document.addEventListener('touchend', endRadioDrag);
    
    const wrapper = document.querySelector('.radio-tuner-wrapper');
    wrapper.style.cursor = 'grabbing';
}

function dragRadio(e) {
    if (!isRadioDragging) return;
    e.preventDefault(); 
    
    const currentX = (e.type.includes('mouse')) ? e.clientX : e.touches[0].clientX;
    const diff = currentX - radioStartX;
    
    let newX = radioDragStartX + diff;
    updateRadioPosition(newX);
}

function endRadioDrag(e) {
    if (!isRadioDragging) return;
    isRadioDragging = false;
    
    document.removeEventListener('mousemove', dragRadio);
    document.removeEventListener('touchmove', dragRadio);
    document.removeEventListener('mouseup', endRadioDrag);
    document.removeEventListener('touchend', endRadioDrag);
    
    document.querySelector('.radio-tuner-wrapper').style.cursor = 'grab';

    // Click Detection
    let clientX;
    if (e.type.includes('mouse')) {
        clientX = e.clientX;
    } else {
        // touchend doesn't have touches, use changedTouches
        clientX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : radioStartX;
    }

    const dist = Math.abs(clientX - radioStartX);
    if (dist < 5) {
        handleTunerClick(clientX);
        return;
    }
    
    // Snap to nearest
    let index = Math.round((-radioCurrentX - radioItemWidth/2) / radioItemWidth);
    let targetX = -(index * radioItemWidth + radioItemWidth/2);
    
    radioRafId = requestAnimationFrame(() => animateSnap(targetX));
}

function handleTunerClick(clientX) {
    const wrapper = document.querySelector('.radio-tuner-wrapper');
    const rect = wrapper.getBoundingClientRect();
    const clickXRelativeToWrapper = clientX - rect.left;
    const center = rect.width / 2;
    const offset = clickXRelativeToWrapper - center;
    
    // Determine how many items away we clicked
    // Threshold can be half width, but strictly dividing is better for grid feel
    const itemsToMove = Math.round(offset / radioItemWidth);
    
    let currentIndex = Math.round((-radioCurrentX - radioItemWidth/2) / radioItemWidth);
    let targetIndex = currentIndex + itemsToMove;
    let targetX = -(targetIndex * radioItemWidth + radioItemWidth/2);
    
    radioRafId = requestAnimationFrame(() => animateSnap(targetX));
}

function animateSnap(targetX) {
    if (isRadioDragging) return;
    
    const diff = targetX - radioCurrentX;
    if (Math.abs(diff) < 0.5) {
        radioCurrentX = targetX;
        updateRadioPosition(radioCurrentX);
        
        // Update Channel
        let index = Math.round((-radioCurrentX - radioItemWidth/2) / radioItemWidth);
        const channelIdx = ((index % radioChannels.length) + radioChannels.length) % radioChannels.length;
        const channelName = radioChannels[channelIdx];
        
        if (channelName !== currentRadioTheme) {
            handleRadioChannelChange(channelName);
        }
    } else {
        radioCurrentX += diff * 0.15; // Speed
        updateRadioPosition(radioCurrentX);
        radioRafId = requestAnimationFrame(() => animateSnap(targetX));
    }
}

function updateRadioPosition(x) {
    radioCurrentX = x;
    const track = document.getElementById('radio-track');
    if (track) {
        track.style.transform = `translateX(${x}px)`;
        updateActiveRadioItem();
    }
}

function updateActiveRadioItem() {
    let index = Math.round((-radioCurrentX - radioItemWidth/2) / radioItemWidth);
    
    tunerItems.forEach((item, i) => {
        if (i === index) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function handleRadioChannelChange(channel) {
    currentRadioTheme = channel;
    console.log("Channel changed to:", channel);
}

// --- Playback State Management ---
let isPlaying = localStorage.getItem('daytone_isPlaying') === 'true';

// Init State UI on Load
document.addEventListener('DOMContentLoaded', () => {
    updatePlayUI();
});

// Sync across tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'daytone_isPlaying') {
        isPlaying = (e.newValue === 'true');
        updatePlayUI();
    }
});

function togglePlay() {
    isPlaying = !isPlaying;
    localStorage.setItem('daytone_isPlaying', isPlaying);
    updatePlayUI();
}

function updatePlayUI() {
    // Elements to update
    const radioBtn = document.getElementById('radio-play-btn');
    const writeBtn = document.getElementById('write-play-btn');
    const recapBtn = document.getElementById('recap-play-btn');
    
    const albumArt = document.querySelector('.album-art');
    const liveStatus = document.querySelector('.live-status');
    const liveContent = document.querySelector('.live-content');
    
    // Multiple instances
    const liveStatusSmallContainers = document.querySelectorAll('.live-status-small');
    const miniPlayerFilenames = document.querySelectorAll('.mini-player-filename');
    
    // Marquee Text Elements
    const trackInfo = document.querySelector('.track-info');
    
    if (isPlaying) {
        // --- Play State ---
        
        // 0. Start Marquee
        if(trackInfo) trackInfo.classList.add('playing');
        miniPlayerFilenames.forEach(el => el.classList.add('playing'));
        
        // 1. Radio Play Button -> Pause Icon
        if(radioBtn) {
            radioBtn.innerHTML = '<div class="play-btn-bg"></div><svg width="48" height="48" viewBox="0 0 24 24" fill="white" style="position:relative; z-index:2"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
            radioBtn.classList.add('playing');
        }
        
        // 2. Play Buttons -> Pause Icon
        const pauseIconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        if(writeBtn) writeBtn.innerHTML = pauseIconSvg;
        if(recapBtn) recapBtn.innerHTML = pauseIconSvg;

        // 3. Album Art Animation
        if (albumArt) albumArt.classList.add('playing');

        // 4. Radio View Live Status
        if (liveStatus && liveContent) {
            liveStatus.classList.add('playing');
            liveStatus.classList.remove('paused');
            liveContent.innerHTML = `
                <img src="https://www.figma.com/api/mcp/asset/cda19cdd-6663-47a7-9a39-ada56c437154" class="red-dot" alt="">
                <span class="live-text">Live</span>
            `;
        }
        
        // 5. Small Live Status (Write & Recap)
        liveStatusSmallContainers.forEach(container => {
            container.innerHTML = `
                <div class="red-dot-live"></div>
                <span>Live</span>
            `;
        });

    } else {
        // --- Pause State ---
        
        // 0. Stop Marquee
        if(trackInfo) trackInfo.classList.remove('playing');
        miniPlayerFilenames.forEach(el => el.classList.remove('playing'));
        
        // 1. Radio Play Button -> Play Icon
        if(radioBtn) {
            radioBtn.innerHTML = '<div class="play-btn-bg"></div><svg width="48" height="48" viewBox="0 0 24 24" fill="white" style="position:relative; z-index:2"><path d="M8 5v14l11-7z"/></svg>';
            radioBtn.classList.remove('playing');
        }
        
        // 2. Play Buttons -> Play Icon
        const playIconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
        if(writeBtn) writeBtn.innerHTML = playIconSvg;
        if(recapBtn) recapBtn.innerHTML = playIconSvg;
        
        // 3. Album Art Stop
        if (albumArt) albumArt.classList.remove('playing');

        // 4. Radio View Live Status
        if (liveStatus && liveContent) {
            liveStatus.classList.remove('playing');
            liveStatus.classList.add('paused');
            liveContent.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                <span class="live-text">Paused</span>
            `;
        }
        
        // 5. Small Live Status (Write & Recap)
        liveStatusSmallContainers.forEach(container => {
            container.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                <span>Paused</span>
            `;
        });
    }
}

/* --- Vertical Tuner Logic --- */
const verticalGenres = ['Lo-fi', 'Vaporwave', 'Ambient', 'Post-rock', 'Jazz'];
let verticalItems = [];
const verticalItemHeight = 60;
const verticalSetRepeats = 5;
const verticalCenterSetIndex = 2;

let isVerticalDragging = false;
let verticalStartY = 0;
let verticalCurrentY = 0;
let verticalDragStartY = 0;
let verticalRafId = null;
let currentVerticalGenre = 'Lo-fi';

function initVerticalTuner() {
    const track = document.getElementById('vertical-track');
    if (!track) return;

    let html = '';
    // Repeat the set to allow infinite scroll feeling
    for(let i=0; i<verticalSetRepeats; i++) {
        verticalGenres.forEach((genre, index) => {
            html += `
            <div class="vertical-item" data-genre="${genre}">
                <div class="genre-label">${genre}</div>
            </div>`;
        });
    }
    track.innerHTML = html;
    
    verticalItems = Array.from(track.querySelectorAll('.vertical-item'));
    verticalItems.forEach(item => item.style.height = `${verticalItemHeight}px`);

    // Init Drag
    const wrapper = document.querySelector('.vertical-tuner-wrapper');
    if(wrapper) {
        wrapper.addEventListener('mousedown', startVerticalDrag);
        wrapper.addEventListener('touchstart', startVerticalDrag, {passive: false});
    }

    // Set Initial Position (Center of 3rd set)
    const startItemIndex = verticalCenterSetIndex * verticalGenres.length; 
    const startY = -(startItemIndex * verticalItemHeight + verticalItemHeight/2);
    
    updateVerticalPosition(startY);
    currentVerticalGenre = verticalGenres[0];
}

function startVerticalDrag(e) {
    isVerticalDragging = true;
    verticalStartY = (e.type.includes('mouse')) ? e.clientY : e.touches[0].clientY;
    
    verticalDragStartY = verticalCurrentY;
    cancelAnimationFrame(verticalRafId);
    
    document.addEventListener('mousemove', dragVertical);
    document.addEventListener('touchmove', dragVertical, { passive: false });
    document.addEventListener('mouseup', endVerticalDrag);
    document.addEventListener('touchend', endVerticalDrag);
    
    document.querySelector('.vertical-tuner-wrapper').style.cursor = 'grabbing';
}

function dragVertical(e) {
    if(!isVerticalDragging) return;
    e.preventDefault();
    const currentY = (e.type.includes('mouse')) ? e.clientY : e.touches[0].clientY;
    const diff = currentY - verticalStartY;
    updateVerticalPosition(verticalDragStartY + diff);
}

function endVerticalDrag(e) {
    if(!isVerticalDragging) return;
    isVerticalDragging = false;
    
    document.removeEventListener('mousemove', dragVertical);
    document.removeEventListener('touchmove', dragVertical);
    document.removeEventListener('mouseup', endVerticalDrag);
    document.removeEventListener('touchend', endVerticalDrag);
    
    document.querySelector('.vertical-tuner-wrapper').style.cursor = 'grab';

    // Click Detection (Simple version)
    let clientY;
    if (e.type.includes('mouse')) {
        clientY = e.clientY;
    } else {
        clientY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : verticalStartY;
    }
    const dist = Math.abs(clientY - verticalStartY);
    if (dist < 5) {
        handleVerticalClick(clientY);
        return;
    }
    
    // Snap to nearest
    let index = Math.round((-verticalCurrentY - verticalItemHeight/2) / verticalItemHeight);
    let targetY = -(index * verticalItemHeight + verticalItemHeight/2);
    verticalRafId = requestAnimationFrame(() => animateVerticalSnap(targetY));
}

function handleVerticalClick(clientY) {
    const wrapper = document.querySelector('.vertical-tuner-wrapper');
    const rect = wrapper.getBoundingClientRect();
    const clickYRelativeToWrapper = clientY - rect.top;
    const center = rect.height / 2;
    const offset = clickYRelativeToWrapper - center;
    
    const itemsToMove = Math.round(offset / verticalItemHeight);
    
    let currentIndex = Math.round((-verticalCurrentY - verticalItemHeight/2) / verticalItemHeight);
    let targetIndex = currentIndex + itemsToMove;
    let targetY = -(targetIndex * verticalItemHeight + verticalItemHeight/2);
    
    verticalRafId = requestAnimationFrame(() => animateVerticalSnap(targetY));
}

function animateVerticalSnap(targetY) {
    if(isVerticalDragging) return;
    const diff = targetY - verticalCurrentY;
    if(Math.abs(diff) < 0.5) {
        verticalCurrentY = targetY;
        updateVerticalPosition(verticalCurrentY);
        // Update Genre
        let index = Math.round((-verticalCurrentY - verticalItemHeight/2) / verticalItemHeight);
        const genreIdx = ((index % verticalGenres.length) + verticalGenres.length) % verticalGenres.length;
        currentVerticalGenre = verticalGenres[genreIdx];
        // console.log("Genre:", currentVerticalGenre);
    } else {
        verticalCurrentY += diff * 0.15;
        updateVerticalPosition(verticalCurrentY);
        verticalRafId = requestAnimationFrame(() => animateVerticalSnap(targetY));
    }
}

function updateVerticalPosition(y) {
    verticalCurrentY = y;
    const track = document.getElementById('vertical-track');
    if(track) {
        track.style.transform = `translateY(${y}px)`;
        updateActiveVerticalItem();
    }
}

function updateActiveVerticalItem() {
    let index = Math.round((-verticalCurrentY - verticalItemHeight/2) / verticalItemHeight);
    verticalItems.forEach((item, i) => {
        if(i === index) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}
/* --- View Switching Logic --- */
document.addEventListener('DOMContentLoaded', () => {
    const btnEdit = document.querySelector('.sidebar-btn-edit');
    const btnStar = document.querySelector('.sidebar-btn-star');
    const pillRadio = document.querySelector('.sidebar-pill-vertical');

    // Right Section Views
    const viewWrite = document.getElementById('view-write');
    const viewRadio = document.getElementById('view-radio');
    const viewRecap = document.getElementById('view-recap');
    
    // Left Section Views
    const leftViewWrite = document.getElementById('left-view-write');
    const leftViewRadio = document.getElementById('left-view-radio');
    const leftViewRecap = document.getElementById('left-view-recap');
    
    // Voice Input & Speech Recognition Logic (Robust Restart Version)
    const voiceBtn = document.getElementById('voice-input-btn');
    const writeArea = document.querySelector('.write-area');

    if (voiceBtn && writeArea) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            let recognition = new SpeechRecognition();
            let isUserStopped = false; // Track if user explicitly wanted to stop
            let isRestarting = false;  // Track if we are in restart loop

            // Configuration for better stability
            recognition.continuous = true; 
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            // --- Control Functions ---
            const startRecognition = () => {
                isUserStopped = false;
                try {
                    recognition.start();
                } catch (e) {
                    console.error("Start error (already started?):", e);
                }
                voiceBtn.classList.add('recording');
            };

            const stopRecognition = () => {
                isUserStopped = true;
                recognition.stop();
                voiceBtn.classList.remove('recording');
            };

            // --- Toggle Button ---
            voiceBtn.addEventListener('click', () => {
                if (voiceBtn.classList.contains('recording')) {
                    stopRecognition();
                } else {
                    startRecognition();
                }
            });

            // --- Event Handlers ---
            recognition.onstart = () => {
                console.log('Voice engine active');
                voiceBtn.classList.add('recording');
            };

            recognition.onend = () => {
                console.log('Voice engine disconnected. User stopped?', isUserStopped);
                
                // Cleanup: Merge all interim words into final text
                const interimWords = writeArea.querySelectorAll('.interim-word');
                if (interimWords.length > 0) {
                    let fullInterimText = '';
                    interimWords.forEach(word => {
                        fullInterimText += word.innerText;
                        word.remove();
                    });
                    
                    if (fullInterimText.trim().length > 0) {
                        insertTextAtCursor(fullInterimText); 
                    }
                }

                // Auto-Restart Logic (The "Anti-Cutoff" Fix)
                if (!isUserStopped) {
                    console.log('Auto-restarting speech recognition...');
                    isRestarting = true;
                    setTimeout(() => {
                        try {
                            recognition.start();
                        } catch(e) { console.log('Restart quirk:', e); }
                    }, 100); 
                } else {
                    voiceBtn.classList.remove('recording');
                }
            };

            recognition.onresult = (event) => {
                let finalSegment = '';
                let interimSegment = '';
                
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalSegment += event.results[i][0].transcript;
                    } else {
                        interimSegment += event.results[i][0].transcript;
                    }
                }

                // 1. Handle Final
                if (finalSegment.length > 0) {
                    // Remove all interim words first to make room for final text
                    writeArea.querySelectorAll('.interim-word').forEach(el => el.remove());
                    insertTextAtCursor(finalSegment);
                }

                // 2. Handle Interim (Word-by-Word Visualization)
                if (interimSegment.length > 0) {
                    // Refresh interim view: Clear old interim words and re-render current state split by words
                    writeArea.querySelectorAll('.interim-word').forEach(el => el.remove());
                    
                    // Split by whitespace to respect "Word Unit" request
                    // We interpret "Word Unit" as rendering distinct spans per word
                    const words = interimSegment.split(/(\s+)/); // Split keeping delimiters to preserve spaces
                    
                    const currentText = writeArea.innerText.replace(/\n$/, '');
                    let needsLeadingSpace = currentText.length > 0 && !/\s$/.test(currentText) && !/^\s/.test(interimSegment);

                    words.forEach((chunk, index) => {
                        if (chunk.length === 0) return;

                        const span = document.createElement('span');
                        span.className = 'interim-word';
                        
                        // Apply leading space logic only to the very first chunk if needed
                        if (index === 0 && needsLeadingSpace && !/^\s/.test(chunk)) {
                            span.innerText = ' ' + chunk;
                        } else {
                            span.innerText = chunk;
                        }
                        
                        writeArea.appendChild(span);
                    });
                    
                    // Auto-scroll
                    writeArea.scrollTop = writeArea.scrollHeight;
                    
                    // Trigger Input Event for Drafts Logic
                    writeArea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            };

            recognition.onerror = (event) => {
                console.warn('Speech error:', event.error);
                if (event.error === 'not-allowed') {
                    isUserStopped = true; // Stop retrying if denied
                    alert('Microphone access blocked.');
                    voiceBtn.classList.remove('recording');
                } else if (event.error === 'no-speech') {
                    // Ignore no-speech errors, just letting onend handle restart
                }
            };
            
            // --- Helper: Insert Text Safely ---
            function insertTextAtCursor(text) {
                // Ensure space if appending
                const currentText = writeArea.innerText.replace(/\n$/, '');
                const needsSpace = currentText.length > 0 && !/\s$/.test(currentText) && !/^\s/.test(text);
                const textToInsert = (needsSpace ? ' ' : '') + text;
                
                // Use DOM node insertion to avoid innerHTML resets
                const textNode = document.createTextNode(textToInsert);
                writeArea.appendChild(textNode);
                
                updateCharCount();
                writeArea.scrollTop = writeArea.scrollHeight;
                
                // Trigger Input Event for Drafts Logic
                writeArea.dispatchEvent(new Event('input', { bubbles: true }));
            }

        } else {
            console.warn("Speech API not supported");
            voiceBtn.style.display = 'none';
        }
    }

    // Helper to Reset Views
    function hideAllViews() {
        // Sidebar
        btnEdit.classList.remove('active');
        pillRadio.classList.remove('active');
        if(btnStar) btnStar.classList.remove('active');
        
        // Header
        const globeBtn = document.getElementById('header-globe-btn');
        if(globeBtn) {
            globeBtn.classList.remove('active');
            // Reset Icon to Globe if needed, but we handle that in the toggle logic
            globeBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M21 12C21 16.9706 16.9706 21 12 21M21 12C21 7.02944 16.9706 3 12 3M21 12H3M12 21C7.02944 21 3 16.9706 3 12M12 21C12 21 16 18 16 12C16 6 12 3 12 3M12 21C12 21 8 18 8 12C8 6 12 3 12 3M3 12C3 7.02944 7.02944 3 12 3" stroke="#ffffff" stroke-width="1.5"></path> </g></svg>`;
        }

        // Right
        viewRadio.classList.remove('active');
        viewWrite.classList.remove('active');
        // Check if recap exists before removing class
        if(viewRecap) viewRecap.classList.remove('active');
        const viewDiscovery = document.getElementById('view-discovery');
        if(viewDiscovery) viewDiscovery.classList.remove('active');

        // Left
        leftViewRadio.classList.remove('active');
        leftViewWrite.classList.remove('active');
        if(leftViewRecap) leftViewRecap.classList.remove('active');
        const leftViewDiscovery = document.getElementById('left-view-discovery');
        if(leftViewDiscovery) leftViewDiscovery.classList.remove('active');
    }

    // Globe Button Logic
    const globeBtn = document.getElementById('header-globe-btn');
    const globeIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M21 12C21 16.9706 16.9706 21 12 21M21 12C21 7.02944 16.9706 3 12 3M21 12H3M12 21C7.02944 21 3 16.9706 3 12M12 21C12 21 16 18 16 12C16 6 12 3 12 3M12 21C12 21 8 18 8 12C8 6 12 3 12 3M3 12C3 7.02944 7.02944 3 12 3" stroke="#ffffff" stroke-width="1.5"></path> </g></svg>`;
    const lifeRingIcon = `<svg width="24" height="24" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>life-ring</title> <path d="M26.913 25.144c2.064-2.456 3.318-5.654 3.318-9.144s-1.254-6.687-3.336-9.166l0.018 0.022 1.462-1.462c0.226-0.226 0.366-0.539 0.366-0.884 0-0.691-0.56-1.251-1.251-1.251-0.346 0-0.658 0.14-0.885 0.367l-1.46 1.46c-2.454-2.072-5.652-3.331-9.145-3.331s-6.692 1.26-9.167 3.349l0.021-0.017-1.461-1.461c-0.226-0.226-0.539-0.366-0.884-0.366-0.69 0-1.25 0.56-1.25 1.25 0 0.345 0.14 0.658 0.366 0.884l1.461 1.461c-2.072 2.454-3.332 5.653-3.332 9.146s1.259 6.691 3.349 9.166l-0.017-0.021-1.46 1.46c-0.227 0.226-0.367 0.539-0.367 0.885 0 0.691 0.56 1.251 1.251 1.251 0.345 0 0.658-0.14 0.884-0.366v0l1.463-1.462c2.455 2.069 5.652 3.326 9.144 3.326s6.689-1.257 9.165-3.343l-0.021 0.018 1.462 1.462c0.226 0.225 0.538 0.364 0.882 0.364 0.691 0 1.251-0.56 1.251-1.251 0-0.344-0.139-0.656-0.364-0.882l0 0zM25.101 23.332l-5.003-5.003c0.386-0.67 0.614-1.473 0.614-2.329s-0.228-1.659-0.626-2.351l0.012 0.023 5.002-5.003c1.611 1.986 2.587 4.545 2.587 7.332s-0.975 5.345-2.603 7.352l0.017-0.022zM14.422 17.579c-0.404-0.404-0.654-0.962-0.654-1.579 0-1.233 1-2.232 2.233-2.232s2.233 1 2.233 2.232c0 0.616-0.25 1.175-0.654 1.579v0c-0.402 0.407-0.961 0.66-1.579 0.66s-1.176-0.252-1.578-0.66l-0-0zM16 4.255c0.008-0 0.018-0 0.028-0 2.794 0 5.357 0.983 7.365 2.622l-0.021-0.017-5.053 5.054c-0.671-0.366-1.469-0.582-2.318-0.582s-1.648 0.215-2.345 0.595l0.026-0.013-5.054-5.054c1.986-1.622 4.55-2.605 7.343-2.605 0.010 0 0.020 0 0.031 0h-0.002zM4.255 16c-0-0.009-0-0.019-0-0.029 0-2.793 0.983-5.357 2.622-7.364l-0.017 0.021 5.043 5.043c-0.399 0.667-0.636 1.471-0.636 2.33s0.236 1.663 0.647 2.351l-0.012-0.021-5.042 5.041c-1.622-1.986-2.605-4.55-2.605-7.344 0-0.010 0-0.020 0-0.030v0.002zM8.669 25.1l5.003-5.002c0.666 0.398 1.47 0.633 2.328 0.633s1.662-0.235 2.35-0.645l-0.021 0.012 5.003 5.004c-1.986 1.61-4.544 2.586-7.331 2.586s-5.346-0.976-7.354-2.604l0.022 0.017z" fill="#ffffff"></path> </g></svg>`;

    if(globeBtn) {
        globeBtn.addEventListener('click', () => {
            // Navigate to the web (Explore) page
            window.location.href = 'web.html';
        });
    }

    // --- Leaflet Map Init ---
    let mapInstance = null;
    function initDiscoveryMap() {
        if(mapInstance) {
            // Force resize in case container size changed while hidden
            setTimeout(() => { mapInstance.invalidateSize(); }, 300);
            return;
        }

        const mapContainer = document.getElementById('discovery-map');
        if(!mapContainer) return;

        // Initialize Leaflet
        // Coordinates for Toronto
        mapInstance = L.map('discovery-map', {
            zoomControl: false, // Cleaner look
            attributionControl: false 
        }).setView([43.6532, -79.3832], 13);

        // Dark Theme Tile Layer (CartoDB Dark Matter)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(mapInstance);

        // Dummy Markers
        const stations = [
            { lat: 43.6532, lng: -79.3832, title: "John Doe's Podcast" },
            { lat: 43.6426, lng: -79.3871, title: "Downtown Yappers" },
            { lat: 43.6629, lng: -79.3957, title: "Just Vibing" },
            { lat: 43.6677, lng: -79.3148, title: "Open Talk" }
        ];

        stations.forEach(st => {
            // Custom Icon dot
            const circleIcon = L.divIcon({
                className: 'custom-map-marker',
                html: `<div style="
                    width:12px; height:12px; 
                    background:#61E061; 
                    border-radius:50%; 
                    box-shadow:0 0 10px rgba(97,224,97,0.6);
                    border: 2px solid #121212;"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });

            L.marker([st.lat, st.lng], { icon: circleIcon }).addTo(mapInstance);
        });
        
        // Add zoom control manually if needed, or keeping it minimal
    }

    // Edit Link (Write Mode)
    btnEdit.addEventListener('click', () => {
        if(btnEdit.classList.contains('active')) return;
        hideAllViews();
        
        btnEdit.classList.add('active');
        viewWrite.classList.add('active');
        leftViewWrite.classList.add('active');
    });
    
    // Star Link (Recap Mode)
    if(btnStar) {
        btnStar.addEventListener('click', () => {
            if(btnStar.classList.contains('active')) return;
            hideAllViews();

            btnStar.classList.add('active');
            if(viewRecap) viewRecap.classList.add('active');
            if(leftViewRecap) leftViewRecap.classList.add('active');
        });
    }

    // Radio Link (Radio Mode)
    pillRadio.addEventListener('click', () => {
        if(pillRadio.classList.contains('active')) return;
        hideAllViews();
        
        pillRadio.classList.add('active');
        viewRadio.classList.add('active');
        leftViewRadio.classList.add('active');
    });
});



/* --- Character Counter Logic --- */
const writeArea = document.querySelector('.write-area');
const charCount = document.querySelector('.char-count');

if(writeArea && charCount) {
    // Listen for input events (typing or speech)
    writeArea.addEventListener('input', updateCharCount);
}

function updateCharCount() {
    if (!writeArea || !charCount) return;
    
    // For div contenteditable, use innerText
    const text = writeArea.innerText.trim(); 
    // const wordCount = text ? text.split(/\s+/).length : 0; // Word count
    const charLen = text.length; // Per earlier request 0/2000 usually implies chars, but user code had words. Sticking to words if that was intent, BUT code said 0/2000 which is typically chars. 
    // Let's stick to the previous logic which seemed to be words based on split(/\s+/).
    // Actually, 2000 is a lot for words, usually chars. Let's check the displayed limit. 
    // The previous code had `wordCount`. I will stick to length for safety or wordCount if preferred.
    // "0/2000" usually means characters. "split" logic suggests words. I will use Characters for 2000 limit as it's more standard.
    // WAIT, previous code was `const wordCount = text ? text.split(/\s+/).length : 0;`. I will restore that to be safe.
    
    const wordCount = text ? text.split(/\s+/).length : 0;
    charCount.textContent = `${wordCount}/2000`; // Keeping label for consistency

    // Change color if nearing limit
    if(wordCount >= 2000) {
        charCount.style.color = '#FF453A';
    } else {
        charCount.style.color = '#656565';
    }

    // Toggle Enter Recap Button (Requirement: >= 2 words)
    const enterRecapBtn = document.querySelector('.enter-recap-btn');
    if(enterRecapBtn) {
        if(wordCount >= 2) {
            enterRecapBtn.classList.add('visible');
        } else {
            enterRecapBtn.classList.remove('visible');
        }
    }
}

// Enter Recap Button Click Logic
document.addEventListener('DOMContentLoaded', () => {
    const enterRecapBtn = document.querySelector('.enter-recap-btn');
    const btnStar = document.querySelector('.sidebar-btn-star');

    if(enterRecapBtn && btnStar) {
        enterRecapBtn.addEventListener('click', () => {
            // Trigger the transition via the existing Sidebar Star Button logic
            btnStar.click();
        });
    }
});



/* --- Consolidated Play Button Logic (Robust) --- */
document.addEventListener('DOMContentLoaded', () => {
    const attachToggle = (id) => {
        const btn = document.getElementById(id);
        if(btn) {
            btn.onclick = (e) => {
                e.stopPropagation(); 
                togglePlay();
            };
        }
    };

    attachToggle('write-play-btn');
    attachToggle('recap-play-btn');
});

/* --- Draft Button & Auto-Save Logic --- */
document.addEventListener('DOMContentLoaded', () => {
    const writeArea = document.querySelector('.write-area');
    const draftBtn = document.querySelector('.draft-pill-btn');
    const draftTextSpan = document.querySelector('.draft-pill-btn .draft-text'); // The span inside
    
    // Tooltip Slots
    const slot1 = document.getElementById('draft-slot-1');
    const slot2 = document.getElementById('draft-slot-2');
    const slot3 = document.getElementById('draft-slot-3');

    // State Tracking
    let lastSavedContent = "";
    let currentLoadedDraftId = null; // Track which draft is being edited

    // Navigation items that cause exit from Write Mode
    const pillRadio = document.querySelector('.sidebar-pill-vertical');
    const btnStar = document.querySelector('.sidebar-btn-star');
    const globeBtn = document.getElementById('header-globe-btn'); 
    
    function updateTooltip() {
        let drafts = [];
        try {
            const saved = localStorage.getItem('daytone_drafts');
            if (saved) drafts = JSON.parse(saved);
        } catch(e) {}

        // Helper to set text
        const setSlot = (el, draft, idx) => {
            if (draft) {
                 // Truncate content for display
                 const preview = draft.content.length > 15 ? draft.content.substring(0, 15) + '...' : draft.content;
                 el.innerText = `Draft ${idx + 1}: ${preview}`;
                 el.classList.add('filled');
                 // Store content and ID in dataset for easy loading
                 el.dataset.content = draft.content;
                 el.dataset.id = draft.id;
            } else {
                 el.innerText = `Draft ${idx + 1}: Empty`;
                 el.classList.remove('filled');
                 delete el.dataset.content;
                 delete el.dataset.id;
            }
        };

        setSlot(slot1, drafts[0], 0);
        setSlot(slot2, drafts[1], 1);
        setSlot(slot3, drafts[2], 2);
    }

    // Function to handle saving
    function handleDraftSave() {
        if (!writeArea) return;
        const text = writeArea.innerText.trim();
        
        // Requirement: 2+ chars
        if (text.length >= 2) {
            let drafts = [];
            try {
                const saved = localStorage.getItem('daytone_drafts');
                if (saved) drafts = JSON.parse(saved);
            } catch(e) { console.error('Draft load error', e); }

            // Check if we are updating an existing loaded draft
            let savedDraft = null;
            if (currentLoadedDraftId) {
                const existingIndex = drafts.findIndex(d => d.id == currentLoadedDraftId);
                if (existingIndex !== -1) {
                    // Update content
                    drafts[existingIndex].content = text;
                    drafts[existingIndex].date = new Date().toISOString();
                    savedDraft = drafts[existingIndex];
                    console.log("Updated Existing Draft:", savedDraft);
                } else {
                    // Loaded draft vanished (maybe deleted elsewhere?), create new
                    currentLoadedDraftId = null;
                }
            }

            // If not updated (new draft or ID lost)
            if (!savedDraft) {
                // If max drafts (3) reached, overwrite the OLDER one (last index)
                // instead of creating a 4th one or shifting.
                if (drafts.length >= 3) {
                    const lastIdx = drafts.length - 1;
                    drafts[lastIdx].content = text;
                    drafts[lastIdx].date = new Date().toISOString();
                    drafts[lastIdx].id = Date.now(); // Update ID to effectively be a new draft in that slot
                    savedDraft = drafts[lastIdx];
                    currentLoadedDraftId = savedDraft.id;
                    console.log("Overwrote Oldest Draft:", savedDraft);
                } else {
                    // Normal creation
                    const newDraft = {
                        id: Date.now(),
                        content: text,
                        date: new Date().toISOString()
                    };
                    
                    // Add new to top
                    drafts.unshift(newDraft);
                    currentLoadedDraftId = newDraft.id; 
                    savedDraft = newDraft;
                    
                    console.log("Created New Draft:", newDraft);
                }
            }

            // Save
            localStorage.setItem('daytone_drafts', JSON.stringify(drafts));
            
            // Update State
            lastSavedContent = text;
            updateTooltip();
        }
    }

    // Load Draft Logic
    const loadDraft = (el) => {
        if (el.classList.contains('filled') && el.dataset.content) {
            const content = el.dataset.content;
            const id = el.dataset.id; // Get ID
            
            writeArea.innerText = content;
            lastSavedContent = content; // Sync state
            currentLoadedDraftId = id; // Track this ID
            
            console.log("Loaded Draft ID:", id);

            // Trigger input event to update UI
            writeArea.dispatchEvent(new Event('input'));
        }
    };

    // Attach listeners to slots
    if (slot1) slot1.addEventListener('click', (e) => { e.stopPropagation(); loadDraft(slot1); });
    if (slot2) slot2.addEventListener('click', (e) => { e.stopPropagation(); loadDraft(slot2); });
    if (slot3) slot3.addEventListener('click', (e) => { e.stopPropagation(); loadDraft(slot3); });

    // Input Monitor
    if (writeArea && draftBtn && draftTextSpan) {
        // Init Tooltip
        updateTooltip();

        let tooltipTimeout;
        const tooltip = document.querySelector('.draft-tooltip');

        const showTooltip = () => {
            clearTimeout(tooltipTimeout);
            if(tooltip) tooltip.classList.add('visible');
        };

        const hideTooltip = () => {
            tooltipTimeout = setTimeout(() => {
                if(tooltip) tooltip.classList.remove('visible');
            }, 3000); // 3 seconds delay
        };

        // Attach Tooltip Events
        draftBtn.addEventListener('mouseenter', showTooltip);
        draftBtn.addEventListener('mouseleave', hideTooltip);

        if(tooltip) {
            // Keep open if interacting with tooltip
            // Using mousemove ensures that as long as the user is moving content, we keep it open
            tooltip.addEventListener('mouseenter', showTooltip);
            tooltip.addEventListener('mousemove', showTooltip);
            tooltip.addEventListener('mousedown', showTooltip);
            tooltip.addEventListener('mouseleave', hideTooltip);
        }

        writeArea.addEventListener('input', () => {
            // Use textContent for reliable raw text retrieval
            const text = writeArea.textContent.trim();
            const hasChanged = text !== lastSavedContent;
            
            // Logic:
            // 1. Text must be at least 2 chars long
            // 2. Text must differ from what is already saved
            if (text.length >= 2 && hasChanged) {
                draftTextSpan.textContent = "Save"; 
                draftBtn.classList.add('active');
                
                // Hide tooltip while user is actively writing/ready to save
                clearTimeout(tooltipTimeout);
                if(tooltip) tooltip.classList.remove('visible');
                
            } else {
                // If saved or empty, show Drafts list access
                draftTextSpan.textContent = "Drafts";
                draftBtn.classList.remove('active');
            }
        });

        // Optional Manual Save
        draftBtn.addEventListener('click', (e) => {
            // Only allow click save if active
            if (draftBtn.classList.contains('active')) {
                // Prevent bubbling if needed
                e.preventDefault();
                handleDraftSave();
                
                // Visual Feedback: Immediately switch to Drafts view state
                draftTextSpan.textContent = "Drafts";
                draftBtn.classList.remove('active'); 
            }
        });
    }

    // Auto-Save Trigger on Mode Switch
    const checkAndSaveOnExit = () => {
        const viewWrite = document.getElementById('view-write');
        // If we are currently in Write Mode, save before switching
        if (viewWrite && viewWrite.classList.contains('active')) {
            // Double check length requirement inside handler
             handleDraftSave();
        }
    };

    // Attach listeners to navigation buttons (use mousedown to catch before click logic clears active class)
    if (pillRadio) pillRadio.addEventListener('mousedown', checkAndSaveOnExit);
    if (btnStar) btnStar.addEventListener('mousedown', checkAndSaveOnExit);
    if (globeBtn) globeBtn.addEventListener('mousedown', checkAndSaveOnExit);
});





/* --- Prompt Card Rotation Logic --- */
document.addEventListener('DOMContentLoaded', () => {
    const promptCard = document.querySelector('.prompt-card');
    const promptText = document.querySelector('.prompt-text');
    const promptIconContainer = document.querySelector('.prompt-icon');
    const paginationContainer = document.querySelector('.pagination-dots'); // Parent container
    
    // Check if elements exist
    if (!promptCard || !promptText || !promptIconContainer || !paginationContainer) return;

    // Converted to Let for mutation
    let prompts = [
        'Let’s talk about tomorrow’s schedule',
        'Let\'s talk about what\'s on your mind',
        'Let\'s talk about what you learned today',
        'Let\'s talk about your concerns'
    ];

    const icons = [
        // 1. Schedule
        `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M22 14V12C22 8.22876 22 6.34315 20.8284 5.17157C19.6569 4 17.7712 4 14 4H10C6.22876 4 4.34315 4 3.17157 5.17157C2 6.34315 2 8.22876 2 12V14C2 17.7712 2 19.6569 3.17157 20.8284C4.34315 22 6.22876 22 10 22H14" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M7 4V2.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M17 4V2.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <circle cx="18" cy="18" r="3" stroke="#ffffff" stroke-width="1.5"></circle> <path d="M20.5 20.5L22 22" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M2.5 9H21.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> </g></svg>`,
        
        // 2. Mind
        `<svg fill="#ffffff" viewBox="0 0 256 256" id="Flat" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M248,132a56.1211,56.1211,0,0,0-31.99951-50.61035L216,72a47.98283,47.98283,0,0,0-88-26.49316A47.98283,47.98283,0,0,0,40,71.99951l-.00049,9.39014A56.00268,56.00268,0,0,0,40,182.58569V184a47.98283,47.98283,0,0,0,88,26.49316A47.98283,47.98283,0,0,0,216,184v-1.41431A56.06726,56.06726,0,0,0,248,132ZM88,216a32.0433,32.0433,0,0,1-31.812-28.55664A56.1738,56.1738,0,0,0,64,188h8a8,8,0,0,0,0-16H64A40.00827,40.00827,0,0,1,50.66553,94.27393a7.99958,7.99958,0,0,0,5.33349-7.542L56,72a32,32,0,0,1,64,0v76.26147A47.80252,47.80252,0,0,0,88,136a8,8,0,0,0,0,16,32,32,0,0,1,0,64Zm104-44h-8a8,8,0,0,0,0,16h8a56.1738,56.1738,0,0,0,7.812-.55664A31.999,31.999,0,1,1,168,152a8,8,0,0,0,0-16,47.80252,47.80252,0,0,0-32,12.26147V72a32,32,0,1,1,64,.00049l.001,14.73144a7.99958,7.99958,0,0,0,5.33349,7.542A40.00827,40.00827,0,0,1,192,172ZM60,128a8,8,0,0,1,0-16A20.0226,20.0226,0,0,0,80,92V84a8,8,0,0,1,16,0v8A36.04061,36.04061,0,0,1,60,128Zm144-8a8.00008,8.00008,0,0,1-8,8,36.04061,36.04061,0,0,1-36-36V84a8,8,0,0,1,16,0v8a20.0226,20.0226,0,0,0,20,20A8.00008,8.00008,0,0,1,204,120Z"></path> </g></svg>`,

        // 3. Learned
        `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M4 8C4 5.17157 4 3.75736 4.87868 2.87868C5.75736 2 7.17157 2 10 2H14C16.8284 2 18.2426 2 19.1213 2.87868C20 3.75736 20 5.17157 20 8V16C20 18.8284 20 20.2426 19.1213 21.1213C18.2426 22 16.8284 22 14 22H10C7.17157 22 5.75736 22 4.87868 21.1213C4 20.2426 4 18.8284 4 16V8Z" stroke="#ffffff" stroke-width="1.5"></path> <path d="M19.8978 16H7.89778C6.96781 16 6.50282 16 6.12132 16.1022C5.08604 16.3796 4.2774 17.1883 4 18.2235" stroke="#ffffff" stroke-width="1.5"></path> <path d="M8 7H16" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M8 10.5H13" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> <path d="M19.5 19H8" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"></path> </g></svg>`,

        // 4. Concerns
        `<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.6966 1.00242C29.8451 0.885236 36.4271 5.02586 39.3763 11.5493C40.431 13.893 40.9779 16.393 40.9779 18.9712C40.9779 19.0688 40.9779 19.6157 40.9779 20.4555C41.1146 21.061 41.6419 21.6665 42.1888 22.2134L42.8529 22.8384C44.0638 23.9907 44.6302 24.5571 44.806 24.772C45.1576 25.1821 45.3724 25.5923 45.5091 26.0024C45.9583 27.3696 44.8841 28.0337 44.5326 28.268C44.2005 28.4634 43.8294 28.6587 43.3997 28.854C43.0677 29.0102 42.6966 29.1665 42.3646 29.3227C42.3255 29.3423 42.2669 29.3618 42.2279 29.3813C41.9544 31.1977 40.9193 38.0727 40.8997 38.1313C40.763 39.2837 40.3724 40.1626 39.7279 40.7485C38.5951 41.7837 37.0716 41.7446 35.8412 41.7056C34.9232 41.686 34.1419 41.686 33.3021 41.686C33.2435 42.4087 33.1849 43.4829 33.1263 44.4204C33.0482 45.4555 32.9896 46.5298 32.931 47.3501C32.9115 47.7993 32.6771 48.2095 32.3255 48.5024C32.0521 48.7173 31.7005 48.8345 31.3685 48.8345C31.2708 48.8345 31.1537 48.8149 31.056 48.7954L11.0755 44.8306C10.0013 44.6157 9.22006 43.6587 9.22006 42.5649V38.9321C9.22006 34.6548 8.30209 30.3384 6.46616 26.1196C5.45053 23.7759 4.96225 21.2563 5.00131 18.6587C5.17709 8.89305 12.9701 1.15867 22.6966 1.00242ZM8.18491 25.3579C10.1185 29.811 11.0951 34.3813 11.0951 38.9321V42.5649C11.0951 42.7602 11.2318 42.936 11.4271 42.9751L31.0365 46.8813C31.0951 46.1196 31.1537 45.2016 31.2122 44.3032C31.4466 40.6899 31.4662 40.6509 31.5052 40.4946L31.7005 39.811H32.4232H32.599C33.6927 39.811 34.7083 39.7915 35.8802 39.8305C36.8568 39.8501 37.8724 39.8891 38.4388 39.3813C38.7318 39.1079 38.9271 38.6196 39.0052 37.9165C39.0247 37.7993 40.3919 28.7173 40.3919 28.7173L40.431 28.4438L40.6068 28.229L40.8216 27.9946C41.0365 27.8188 41.2708 27.7407 41.4466 27.6626L41.5638 27.6235C41.8958 27.4868 42.2279 27.3306 42.5794 27.1743C42.9505 26.9985 43.263 26.8423 43.5169 26.686C43.5951 26.647 43.6341 26.6079 43.6732 26.5688C43.6146 26.393 43.4974 26.2173 43.3216 25.9829C43.1654 25.7876 42.1107 24.772 41.5247 24.2251C41.2513 23.9712 41.0169 23.7368 40.8607 23.5805C40.0599 22.7798 39.2787 21.8813 39.1029 20.7095L39.0833 20.6313V20.5532C39.0833 19.6548 39.0833 19.0884 39.0833 18.9907C39.0833 16.6665 38.5951 14.4399 37.6576 12.3501C35.0013 6.51024 29.1029 2.7993 22.7162 2.89696C14.0052 3.03367 7.03256 9.96727 6.87631 18.6782C6.83725 21.0024 7.28647 23.268 8.18491 25.3579Z" fill="white"/><path d="M25.8242 8.61963H21C18.5977 8.61963 16.3516 9.55713 14.6328 11.2563C14.2227 11.686 13.8711 12.0962 13.5781 12.5063C12.543 14.0103 11.9961 15.7681 11.9961 17.604C11.9961 20.2798 13.1875 22.7993 15.2188 24.4985C14.8281 25.2798 14.3398 26.022 13.7539 26.686C13.4023 27.0767 13.3242 27.6431 13.5391 28.1118C13.7539 28.5806 14.2227 28.8931 14.75 28.8931C17.2891 28.8931 19.6719 28.0923 21.7031 26.5884H25.8242C28.2266 26.5884 30.4922 25.6509 32.1914 23.9517C33.8906 22.2524 34.8281 19.9868 34.8281 17.5845C34.8281 12.6626 30.7852 8.61963 25.8242 8.61963ZM30.8437 22.6431C29.4961 23.9907 27.7188 24.7329 25.8047 24.7329H21.0195L20.7656 24.9282C19.3398 26.0415 17.6992 26.7446 15.9414 26.9595C16.4687 26.2173 16.8984 25.4165 17.25 24.5767L17.5234 23.8735L16.918 23.4438C15.0234 22.1157 13.8906 19.9282 13.8906 17.6235C13.8906 16.1782 14.3203 14.772 15.1406 13.5806C15.375 13.2485 15.6484 12.9165 15.9609 12.5845C17.3086 11.2368 19.1055 10.4946 21 10.4946H25.8242C29.75 10.4946 32.9336 13.6782 32.9336 17.604C32.9336 19.5376 32.1914 21.3149 30.8437 22.6431Z" fill="white"/></svg>`
    ];

    let currentPromptIndex = 0;
    
    // Initialize first state
    updatePrompt();

    // Click event to rotate
    promptCard.addEventListener('click', () => {
        if (prompts.length === 0) return;
        currentPromptIndex = (currentPromptIndex + 1) % prompts.length;
        updatePrompt();
    });
    
    // Action Button Logic (Open Edit Overlay)
    const actionBtn = document.querySelector('.prompt-action-btn');
    const editOverlay = document.querySelector('.prompt-edit-overlay');
    const editAddBtn = document.querySelector('.prompt-edit-btn-add'); // Now acts as "Add New"
    const editCloseBtn = document.querySelector('.prompt-edit-btn-close');
    const topicListContainer = document.querySelector('.prompt-topic-list');

    function renderTopicList() {
        if (!topicListContainer) return;
        topicListContainer.innerHTML = '';
        
        prompts.forEach((text, index) => {
            const item = document.createElement('div');
            item.className = 'topic-item';
            
            // Input field
            const input = document.createElement('input');
            input.className = 'topic-input';
            input.value = text;
            input.placeholder = "Enter topic...";
            
            // Live update
            input.addEventListener('input', (e) => {
                prompts[index] = e.target.value;
                // If editing the active one, update text immediately
                if (index === currentPromptIndex) {
                    promptText.textContent = e.target.value;
                }
            });

            // Prevent card rotation when clicking inside input
            input.addEventListener('click', (e) => e.stopPropagation());

            item.appendChild(input);

            // Delete button (show if > 1 items seems reasonable, but user said manage 4. Let's allow deleting)
            const delBtn = document.createElement('div');
            delBtn.className = 'topic-delete-btn';
            delBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`; // X icon for delete
            
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (prompts.length <= 1) return; // Keep at least 1
                
                prompts.splice(index, 1);
                
                // Adjust index if needed
                if (currentPromptIndex >= prompts.length) {
                    currentPromptIndex = prompts.length - 1;
                }
                
                renderTopicList();
                updatePrompt();
            });

            item.appendChild(delBtn);
            topicListContainer.appendChild(item);
        });
    }

    if(actionBtn) {
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop click from triggering promptCard rotation
            if(editOverlay) {
                renderTopicList();
                editOverlay.style.display = 'flex';
            }
        });
    }

    // Edit Overlay close
    if (editCloseBtn) {
        editCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if(editOverlay) editOverlay.style.display = 'none';
        });
    }

    // Add New Topic Logic
    if (editAddBtn) {
        editAddBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Check max 7
            if (prompts.length >= 7) {
                // Maybe shake animation or alert? For now just visual block or ignore
                return; 
            }
            
            prompts.push("New Topic");
            renderTopicList();
            updatePrompt();
            
            // Auto focus the new input?
            setTimeout(() => {
                const inputs = topicListContainer.querySelectorAll('.topic-input');
                if (inputs.length > 0) {
                    inputs[inputs.length - 1].focus();
                }
            }, 50);
        });
    }

    // Prevent propagation from overlay clicks to card (optional but safer)
    if (editOverlay) {
        editOverlay.addEventListener('click', (e) => {
            e.stopPropagation(); 
        });
    }

    function updatePrompt() {
        if (prompts.length === 0) {
            promptText.textContent = "";
            promptIconContainer.innerHTML = "";
            paginationContainer.innerHTML = "";
            return;
        }

        // Update Text
        promptText.style.opacity = '0'; // Simple fade effect start
        
        setTimeout(() => {
            promptText.textContent = prompts[currentPromptIndex];
            promptText.style.opacity = '1';
            
            // Update Icon (Cycle through available icons)
            const iconIndex = currentPromptIndex % icons.length;
            promptIconContainer.innerHTML = icons[iconIndex];
            
        }, 200);

        // Rebuild Dots
        paginationContainer.innerHTML = '';
        prompts.forEach((_, index) => {
            const dot = document.createElement('span');
            dot.className = 'dot';
            if (index === currentPromptIndex) dot.classList.add('active');
            paginationContainer.appendChild(dot);
        });
    }
});



/* --- Pricing Modal Logic --- */
document.addEventListener('DOMContentLoaded', () => {
    const freeBtnWrapper = document.querySelector('.free-btn-wrapper');
    const pricingModal = document.getElementById('pricing-modal');
    const pricingOverlay = document.querySelector('.pricing-overlay');

    if(freeBtnWrapper && pricingModal) {
        // Open Modal
        freeBtnWrapper.addEventListener('click', () => {
            pricingModal.style.display = 'flex';
            // Slight delay for transition
            setTimeout(() => {
                pricingModal.classList.add('visible');
            }, 10);
        });

        // Close Modal (Click Outsde)
        if(pricingOverlay) {
            pricingOverlay.addEventListener('click', () => {
                pricingModal.classList.remove('visible');
                // Wait for transition end
                setTimeout(() => {
                    pricingModal.style.display = 'none';
                }, 300);
            });
        }
    }
});

/* --- Session Name Logic --- */
document.addEventListener('DOMContentLoaded', () => {
    updateSessionName();
});

function updateSessionName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const vo = Math.floor(Math.random() * 24) + 1;
    const sessionName = `Your Session ${year}_${month}_${day}_vo${vo}_mp3`;
    
    document.querySelectorAll('.scrolling-text').forEach(el => {
        el.textContent = sessionName;
    });
}

