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

    weight_lineclears: 200,
    weight_holes: 300,
    scaled_holes: true,
    exp_holes: 0.66,
    weight_boardheight: 1,
    scaled_boardheight: true,
    exp_boardheight: 2,
    weight_placementheight: 5,
    scaled_placementheight: true,
    exp_placementheight: 2,
    weight_avgheightdiff: 75
};

function toggleAI() {
    CONFIG.aienabled ^= 1;
    // console.info('AI toggled; now ' + CONFIG.aienabled);
    // Toggle other AI inputs
    if (CONFIG.aienabled) {
        document.getElementById('ai-delay-input').removeAttribute('disabled');
    } else {
        document.getElementById('ai-delay-input').setAttribute('disabled', '');
    }
}

function toggleShowHint() {
    CONFIG.showhint ^= 1
    // console.info('Show hint toggled; now ' + CONFIG.showhint);
}

const MINSETTINGS = {
    aidelay: -1,
    framerate: 10,
    dropframes: 0,
    weight_lineclears: 0,
    weight_holes: 0,
    weight_boardheight: 0,
    weight_placementheight: 0,
    weight_avgheightdiff: 0,
    exp_holes: 0,
    exp_boardheight: 0,
    exp_placementheight: 0
};

function changeSetting(el, setting) {
    if (isNaN(el.value)) {
        el.value = CONFIG[setting];
        return;
    }
    if (el.value < MINSETTINGS[setting]) {
        el.value = MINSETTINGS[setting];
    }
    CONFIG[setting] = Number(el.value);
    if (setting === 'framerate') frameRate(CONFIG.framerate);
    // console.info(setting + ' set to: ' + el.value);
    // Update statistics
    if (CONFIG.aienabled && ai.toexecute) {
        displayScore(ai.toexecute);
    } else {
        displayScore(ai.getpotential(board.curtetromino));
    }
}

function toggleScaled(setting) {
    CONFIG['scaled_' + setting.replace('-', '')] ^= 1;
    if (CONFIG['scaled_' + setting.replace('-', '')]) {
        if (setting === 'holes') document.getElementById('stats-holes-label').innerText = 'Holes (scaled)';
        document.getElementById('exp-' + setting).removeAttribute('disabled');
    } else {
        if (setting === 'holes') document.getElementById('stats-holes-label').innerText = 'Holes';
        document.getElementById('exp-' + setting).setAttribute('disabled', '');
    }
}
