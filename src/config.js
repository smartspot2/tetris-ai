const CONFIG = {
    board_tl: {x: 0, y: 0},
    board_w: 300,
    board_h: 600,
    rows: 20,
    cols: 10,
    tilesize: 30,

    tetromino_stroke: 190,
    dropframes: 30,
    framerate: 30,

    aienabled: false,
    aidelay: 3,
    showhint: false,
};

function toggleAI() {
    CONFIG.aienabled ^= 1;
    console.info('AI toggled; now ' + CONFIG.aienabled);
    // Toggle other AI inputs
    if (CONFIG.aienabled) {
        document.getElementById('ai-delay-input').removeAttribute('disabled');
    } else {
        document.getElementById('ai-delay-input').setAttribute('disabled', '');
    }
}

function toggleShowHint() {
    CONFIG.showhint ^= 1
    console.info('Show hint toggled; now ' + CONFIG.showhint);
}

function changeAIDelay(el) {
    if (isNaN(el.value)) {
        el.value = CONFIG.aidelay;
        return;
    }
    if (el.value < -1) {
        el.value = -1;
    }
    CONFIG.aidelay = Number(el.value);
    console.info('AI Delay set to: ' + el.value);
}

function changeFrameRate(el) {
    if (isNaN(el.value)) {
        el.value = CONFIG.framerate;
        return;
    }
    if (el.value < 10) {
        el.value = 10;
    }
    CONFIG.framerate = Number(el.value);
    frameRate(CONFIG.framerate);
    console.info('Frame rate set to: ' + el.value);
}

function changeDropFrames(el) {
    if (isNaN(el.value)) {
        el.value = CONFIG.dropframes;
        return;
    }
    if (el.value < 0) {
        el.value = 0;
    }
    CONFIG.dropframes = Number(el.value);
    console.info('Drop frames set to: ' + el.value);
}
