"use strict";
class AI {
    constructor(board) {
        this.board = board;
        this.toexecute = null;
        this.framesuntilnext = CONFIG.aidelay;
    }
    getHint() {
        return this.selectdest().tet;
    }
    aistep() {
        if (!CONFIG.aienabled) {
            this.toexecute = null;
            return;
        }
        if (!this.toexecute) {
            this.toexecute = this.selectdest();
            displayScore(this.toexecute);
        }
        if (this.framesuntilnext-- > 0) {
            return;
        }
        this.framesuntilnext = CONFIG.aidelay;
        // only execute subsections <= current row position (+1 to account for above the board)
        let curstepnumber = (CONFIG.aidelay < 0) ? 99 : this.board.curtetromino.r + 1;
        let nextstep = null;
        let nextstepnumber = -1;
        for (let [idx, step] of this.toexecute.steps.entries()) {
            if (step.length > 0 && Number(idx) <= curstepnumber) {
                nextstep = step;
                nextstepnumber = idx;
                break;
            }
        }
        if (nextstep == null || nextstepnumber == -1)
            return;
        let cmd = nextstep.shift();
        switch (cmd) {
            case "R":
                this.board.move(this.board.curtetromino, 0, 1);
                break;
            case "L":
                this.board.move(this.board.curtetromino, 0, -1);
                break;
            case "d":
                this.board.moveDrop(this.board.curtetromino);
                break;
            case "C":
                this.board.rotate(this.board.curtetromino, Rotation.CLOCKWISE);
                break;
            case "c":
                this.board.rotate(this.board.curtetromino, Rotation.COUNTERCLOCKWISE);
                break;
            case "H":
                this.board.hold();
                break;
        }
        if (nextstep.length === 0) {
            this.toexecute.steps.delete(nextstepnumber);
        }
        if (this.toexecute.steps.size === 0) {
            this.toexecute = null;
        }
        // Recurse to do all steps if aidelay = -1
        if (this.toexecute && CONFIG.aidelay === -1)
            this.aistep();
    }
    getbestlist() {
        let poslist = this.getendpositions();
        let scorelist = poslist.map(pos => this.getscore(pos));
        let maxScore = Math.max(...scorelist);
        return poslist.filter((pos, idx) => scorelist[idx] === maxScore);
    }
    selectdest() {
        let bestlist = this.getbestlist();
        let toexecute;
        if (bestlist.length === 1) {
            toexecute = bestlist[0];
        }
        else {
            // For now, randomly select out of best
            let randindex = Math.floor(Math.random() * Math.floor(bestlist.length));
            toexecute = bestlist[randindex];
        }
        return toexecute;
    }
    /**
     * Drop tetromino from all rotations and columns to get all final positions
     */
    getendpositions() {
        let poslist = [];
        let tetlist = [this.board.curtetromino.copy()];
        if (!this.board.heldtetromino) {
            tetlist.push(this.board.nexttetromino.copy());
        }
        else {
            tetlist.push(this.board.heldtetromino.copy());
        }
        for (let temptetidx of [0, 1]) {
            let temptet = tetlist[temptetidx];
            if (temptet) {
                temptet = temptet.copy();
            }
            else {
                continue;
            }
            let orig_c = temptet.c;
            for (let currot = 0; currot < 4; currot++) {
                for (let c = -2; c < CONFIG.cols; c++) {
                    temptet.r = -1;
                    temptet.c = c;
                    if (this.board.isValid(temptet, 0, 0)) {
                        let potential = this.getpotential(temptet);
                        let stepsequence = [];
                        // Hold
                        if (temptetidx === 1) {
                            stepsequence.push("H");
                        }
                        // Rotations
                        if (currot <= 2) {
                            for (let _rot = 0; _rot < currot; _rot++) {
                                stepsequence.push("C");
                            }
                        }
                        else {
                            stepsequence.push("c");
                        }
                        // Movement
                        let total_dc = potential.tet.c - orig_c;
                        let dc_dir = Math.sign(total_dc);
                        for (let dc = 0; Math.abs(dc) < Math.abs(total_dc); dc += dc_dir) {
                            if (dc_dir === -1) {
                                stepsequence.push("L");
                            }
                            else if (dc_dir === 1) {
                                stepsequence.push("R");
                            }
                        }
                        potential.steps.set(0, stepsequence);
                        potential.steps.get(0).push("d");
                        poslist.push(potential);
                    }
                }
                temptet.shape = temptet.getRotation(Rotation.CLOCKWISE);
            }
        }
        return poslist;
    }
    getpotential(tet) {
        let prevarr = this.board.arr.map(a => a.slice());
        let finaltet = this.board.getGhost(tet);
        this.board.place(finaltet);
        let curarr = this.board.arr.map(a => a.slice());
        this.board.arr = prevarr;
        return {
            steps: new Map(),
            row: finaltet.r,
            col: finaltet.c,
            arr: curarr,
            tet: finaltet
        };
    }
    /**
     * Scores a potential end position
     */
    getscore(potential) {
        let score = 0;
        let stats = this.getstatistics(potential);
        // check line clears
        score += CONFIG.weight_lineclears * stats.lineclears;
        // penalize holes
        if (CONFIG.scaled_holes) {
            score -= CONFIG.weight_holes * stats.scaledholes;
        }
        else {
            score -= CONFIG.weight_holes * stats.totalholes;
        }
        // penalize height
        if (CONFIG.scaled_boardheight) {
            score -= CONFIG.weight_boardheight * stats.scaledboardheight;
        }
        else {
            score -= CONFIG.weight_boardheight * stats.boardheight;
        }
        // penalize placement height
        if (CONFIG.scaled_placementheight) {
            score -= CONFIG.weight_placementheight * stats.scaledplacementheight;
        }
        else {
            score -= CONFIG.weight_placementheight * stats.placementheight;
        }
        // penalize wells
        score -= CONFIG.weight_avgheightdiff * stats.avgheightdiff;
        return score;
    }
    getstatistics(potential) {
        let stats = {};
        let arr = potential.arr;
        // line clears
        stats.lineclears = 0;
        for (let r = 0; r < CONFIG.rows; r++) {
            if (!arr[r].includes(0)) {
                stats.lineclears += 1;
            }
        }
        // holes
        stats.totalholes = stats.scaledholes = 0;
        for (let c = 0; c < CONFIG.cols; c++) {
            let firsttile = arr.findIndex(row => row[c] !== 0);
            if (firsttile === -1)
                continue;
            let numholes = 0;
            for (let r = firsttile; r < CONFIG.rows; r++) {
                if (arr[r][c] === 0) {
                    numholes++;
                    stats.totalholes++;
                }
            }
            stats.scaledholes += Math.pow(numholes, CONFIG.exp_holes);
        }
        // board height
        let firstrowwithtile = arr.findIndex(row => !row.every(item => item === 0));
        stats.boardheight = CONFIG.rows - firstrowwithtile;
        stats.scaledboardheight = Math.pow(stats.boardheight, CONFIG.exp_boardheight);
        // placement height
        stats.placementheight = CONFIG.rows - potential.row;
        stats.scaledplacementheight = Math.pow(CONFIG.rows - potential.row, CONFIG.exp_placementheight);
        // height distribution
        let heights = [];
        for (let c = 0; c < CONFIG.cols; c++) {
            let ht = arr.findIndex(row => row[c] !== 0);
            if (ht === -1) {
                heights.push(0);
            }
            else {
                heights.push(CONFIG.rows - ht);
            }
        }
        let sumheightdiffs = 0;
        for (let c = 1; c < CONFIG.cols; c++) {
            sumheightdiffs += Math.abs(heights[c] - heights[c - 1]);
        }
        stats.avgheightdiff = sumheightdiffs / (CONFIG.cols - 1);
        return stats;
    }
}
function displayScore(potential) {
    let HTMLscore = document.getElementById("stats-current-score");
    let HTMLlineclears = document.getElementById("stats-line-clears");
    let HTMLlineclearscalc = document.getElementById("stats-line-clears-calc");
    let HTMLholes = document.getElementById("stats-holes");
    let HTMLholescalc = document.getElementById("stats-holes-calc");
    let HTMLboardheight = document.getElementById("stats-board-height");
    let HTMLboardheightcalc = document.getElementById("stats-board-height-calc");
    let HTMLplacementheight = document.getElementById("stats-placement-height");
    let HTMLplacementheightcalc = document.getElementById("stats-placement-height-calc");
    let HTMLavgheightdiff = document.getElementById("stats-avg-height-diff");
    let HTMLavgheightdiffcalc = document.getElementById("stats-avg-height-diff-calc");
    let score = ai.getscore(potential);
    let stats = ai.getstatistics(potential);
    HTMLscore.innerHTML = ((score < 0) ? "" : "&nbsp;") + (Math.round(score * 100) / 100);
    HTMLlineclears.innerHTML = String(stats.lineclears);
    HTMLlineclearscalc.innerHTML = String(Math.round(CONFIG.weight_lineclears * stats.lineclears * 100) / 100);
    HTMLholes.innerHTML = String(Math.round((CONFIG.scaled_holes ? stats.scaledholes : stats.totalholes) * 100) / 100);
    HTMLholescalc.innerHTML = String(Math.round(-CONFIG.weight_holes *
        (CONFIG.scaled_holes ? stats.scaledholes : stats.totalholes) * 100) / 100);
    HTMLboardheight.innerHTML = String(Math.round(stats.boardheight * 100) / 100);
    HTMLboardheightcalc.innerHTML = String(Math.round(-CONFIG.weight_boardheight *
        (CONFIG.scaled_boardheight ? stats.scaledboardheight : stats.boardheight) * 100) / 100);
    HTMLplacementheight.innerHTML = String(Math.round(stats.placementheight * 100) / 100);
    HTMLplacementheightcalc.innerHTML = String(Math.round(-CONFIG.weight_placementheight *
        (CONFIG.scaled_placementheight ? stats.scaledplacementheight : stats.placementheight) * 100) / 100);
    HTMLavgheightdiff.innerHTML = String(Math.round(stats.avgheightdiff * 100) / 100);
    HTMLavgheightdiffcalc.innerHTML = String(Math.round(-CONFIG.weight_avgheightdiff * stats.avgheightdiff * 100) / 100);
}
class Board {
    constructor(x, y, w, h) {
        this.curbag = [];
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.tilesize = this.w / 10;
        this.arr = Array(CONFIG.rows).fill(0).map(() => Array(CONFIG.cols).fill(0));
        // Tetromino bag
        this.refillBag();
        this.curtetromino = this.curbag.pop();
        this.nexttetromino = this.curbag.pop();
        this.heldtetromino = null;
        this.framesUntilDrop = CONFIG.dropframes;
        this.hasheld = false;
        this.lineclears = 0;
        this.gameover = false;
    }
    refillBag() {
        this.curbag = [new Tetromino("O", -2, 4)];
        for (let kind of ["I", "J", "L", "S", "T", "Z"]) {
            this.curbag.push(new Tetromino(kind, -2, 3));
        }
        this.curbag = shuffle(this.curbag);
    }
    draw() {
        this.drawBoard();
        if (CONFIG.aienabled && ai.toexecute) {
            let aitarget = ai.toexecute.tet;
            aitarget.draw(17);
        }
        else if (!CONFIG.aienabled && CONFIG.showhint) {
            let possible = ai.getbestlist();
            for (let pos of possible) {
                pos.tet.draw(17);
            }
        }
        this.curtetromino.draw();
        this.nexttetromino.drawat(1.5, CONFIG.cols + 2, 0.75);
        if (this.heldtetromino) {
            this.heldtetromino.drawat(1.5, -2 - 3 * 0.75, 0.75);
        }
        if (!this.gameover) {
            this.getGhost(this.curtetromino).draw(51);
            if (!this.framesUntilDrop--) {
                this.framesUntilDrop = CONFIG.dropframes;
                if (this.isValid(this.curtetromino, 1, 0)) {
                    this.curtetromino.moveDown();
                }
                else {
                    this.placeCurTetromino();
                }
            }
            ai.aistep();
        }
    }
    drawBoard() {
        fill(230);
        noStroke();
        rect(this.x, this.y, this.w, this.h);
        noFill();
        stroke(190);
        for (let r = 0; r < CONFIG.rows; r++) {
            for (let c = 0; c < CONFIG.cols; c++) {
                const arrVal = this.arr[r][c];
                if (arrVal) {
                    fill(arrVal);
                }
                else {
                    noFill();
                }
                rect(this.x + this.tilesize * c, this.y + this.tilesize * r, this.tilesize, this.tilesize);
            }
        }
        noFill();
        stroke(0);
        strokeWeight(2);
        rect(this.x, this.y, this.w, this.h);
        strokeWeight(1);
        fill(230);
        stroke(0);
        strokeWeight(2);
        rect(this.x + this.w + CONFIG.tilesize * (1.5 - 0.25), this.y + CONFIG.tilesize, CONFIG.tilesize * 5 * 0.75, CONFIG.tilesize * 2.75);
        rect(this.x - CONFIG.tilesize * (1.5 + 5 * 0.75 - 0.25), this.y + CONFIG.tilesize, CONFIG.tilesize * 5 * 0.75, CONFIG.tilesize * 2.75);
        strokeWeight(1);
    }
    move(tetromino, dr, dc) {
        if (this.isValid(tetromino, dr, dc)) {
            tetromino.r += dr;
            tetromino.c += dc;
        }
    }
    moveDrop(tetromino) {
        let ghosttet = this.getGhost(tetromino);
        this.curtetromino.r = ghosttet.r;
        this.placeCurTetromino();
    }
    /**
     * Rotate tetromino if valid
     */
    rotate(tetromino, direction) {
        let origshape = tetromino.shape.slice();
        tetromino.shape = tetromino.getRotation(direction);
        if (!this.isValid(tetromino, 0, 0)) {
            tetromino.shape = origshape;
        }
    }
    hold() {
        if (this.hasheld)
            return; // can't hold more than once
        if (this.heldtetromino) {
            let heldtype = this.heldtetromino.kind;
            this.heldtetromino.kind = this.curtetromino.kind;
            this.heldtetromino.reset();
            this.curtetromino.kind = heldtype;
            this.curtetromino.reset();
        }
        else {
            this.heldtetromino = this.curtetromino;
            this.heldtetromino.reset();
            this.curtetromino = this.nexttetromino;
            this.nexttetromino = this.curbag.pop();
            if (!this.curbag.length) {
                this.refillBag();
            }
        }
        this.framesUntilDrop = 1;
        this.hasheld = true;
    }
    isValid(tetromino, dr, dc) {
        for (let tet_r = 0; tet_r < tetromino.shape.length; tet_r++) {
            for (let tet_c = 0; tet_c < tetromino.shape[tet_r].length; tet_c++) {
                if (!tetromino.shape[tet_r][tet_c])
                    continue;
                let board_r = tetromino.r + tet_r + dr;
                let board_c = tetromino.c + tet_c + dc;
                // No part of shape can be out of bounds
                if (board_r >= CONFIG.rows || board_c < 0 || board_c >= CONFIG.cols)
                    return false;
                if (board_r < 0)
                    continue;
                if (this.arr[board_r][board_c]) {
                    return false;
                }
            }
        }
        return true;
    }
    placeCurTetromino() {
        this.place(this.curtetromino);
        this.checklineclears();
        this.curtetromino = this.nexttetromino;
        this.nexttetromino = this.curbag.pop();
        if (!this.curbag.length) {
            this.refillBag();
        }
        this.framesUntilDrop = 1;
        this.hasheld = false; // can hold again
        // Check validity of new tetromino/check for gameover
        if (this.getGhost(this.curtetromino).r === this.curtetromino.r) {
            this.gameover = true;
        }
    }
    /**
     * Place on board, with no checks
     */
    place(tetromino) {
        for (let tet_r = 0; tet_r < tetromino.shape.length; tet_r++) {
            for (let tet_c = 0; tet_c < tetromino.shape[tet_r].length; tet_c++) {
                if (!tetromino.shape[tet_r][tet_c])
                    continue;
                if (tetromino.r + tet_r >= CONFIG.rows || tetromino.r + tet_r < 0 ||
                    tetromino.c + tet_c < 0 || tetromino.c + tet_c >= CONFIG.cols)
                    continue;
                if (!this.arr[tetromino.r + tet_r][tetromino.c + tet_c]) {
                    this.arr[tetromino.r + tet_r][tetromino.c + tet_c] = color(TetrominoType[tetromino.kind].color);
                }
                else {
                    throw Error("Invalid tetromino placement");
                }
            }
        }
    }
    checklineclears() {
        for (let r = 0; r < CONFIG.rows; r++) {
            if (!this.arr[r].includes(0)) {
                this.lineclears += 1;
                this.arr.splice(r, 1);
                this.arr.splice(0, 0, Array(CONFIG.cols).fill(0));
            }
        }
    }
    getGhost(tetromino) {
        let dr = 1;
        while (tetromino.r + dr < this.arr.length && this.isValid(tetromino, dr, 0)) {
            dr++;
        }
        let tetcopy = tetromino.copy();
        tetcopy.r += dr - 1;
        return tetcopy;
    }
}
var Rotation;
(function (Rotation) {
    Rotation[Rotation["CLOCKWISE"] = 0] = "CLOCKWISE";
    Rotation[Rotation["COUNTERCLOCKWISE"] = 1] = "COUNTERCLOCKWISE";
})(Rotation || (Rotation = {}));
class Tetromino {
    /**
     * Creates a tetromino object in arr coordinates
     * @param kind Tetronimno name
     * @param r    Topleft row relative to arr
     * @param c    Topleft col relative to arr
     */
    constructor(kind, r, c) {
        this.kind = kind;
        this.shape = TetrominoType[kind].shape;
        this.r = r;
        this.c = c;
    }
    draw(alpha) {
        this.drawat(this.r, this.c, 1, alpha);
    }
    drawat(r, c, scale, alpha) {
        let tetColor = TetrominoType[this.kind].color;
        stroke(CONFIG.tetromino_stroke);
        if (alpha) {
            const colorWithAlpha = color(tetColor);
            colorWithAlpha.setAlpha(alpha);
            fill(colorWithAlpha);
        }
        else {
            fill(tetColor);
        }
        if (scale === 0.75) {
            if (this.kind === "I")
                c -= 0.375;
            if (this.kind === "O")
                c += 0.375;
        }
        for (let shape_r = 0; shape_r < this.shape.length; shape_r++) {
            for (let shape_c = 0; shape_c < this.shape[shape_r].length; shape_c++) {
                if (this.shape[shape_r][shape_c] && r + shape_r >= 0) {
                    rect(CONFIG.board_tl.x + CONFIG.tilesize * c + CONFIG.tilesize * shape_c * scale, CONFIG.board_tl.y + CONFIG.tilesize * r + CONFIG.tilesize * shape_r * scale, CONFIG.tilesize * scale, CONFIG.tilesize * scale);
                }
            }
        }
    }
    moveDown() {
        this.r += 1;
    }
    getRotation(direction) {
        let newshape = Array(this.shape.length).fill(0).map(() => Array(this.shape[0].length).fill(0));
        for (let r = 0; r < this.shape.length; r++) {
            for (let c = 0; c < this.shape[r].length; c++) {
                if (direction === Rotation.COUNTERCLOCKWISE) {
                    newshape[r][c] = this.shape[c][this.shape[r].length - r - 1];
                }
                else if (direction === Rotation.CLOCKWISE) {
                    newshape[r][c] = this.shape[this.shape.length - c - 1][r];
                }
            }
        }
        return newshape;
    }
    copy() {
        let tetcopy = new Tetromino(this.kind, this.r, this.c);
        tetcopy.shape = this.shape;
        return tetcopy;
    }
    reset() {
        this.shape = TetrominoType[this.kind].shape;
        this.r = -2;
        this.c = this.kind === "O" ? 4 : 3;
    }
}
/**
 * All possible tetromino types, along with their corresponding shapes and colors.
 */
const TetrominoType = {
    I: {
        shape: [[0, 0, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0]],
        color: "#31C7EF"
    },
    J: {
        shape: [[1, 0, 0],
            [1, 1, 1],
            [0, 0, 0]
        ],
        color: "#5A65AD"
    },
    L: {
        shape: [[0, 0, 1],
            [1, 1, 1],
            [0, 0, 0]],
        color: "#EF7921"
    },
    O: {
        shape: [[1, 1],
            [1, 1]],
        color: "#F7D308"
    },
    S: {
        shape: [[0, 1, 1],
            [1, 1, 0],
            [0, 0, 0]],
        color: "#42B642"
    },
    T: {
        shape: [[0, 1, 0],
            [1, 1, 1],
            [0, 0, 0]],
        color: "#AD4D9C"
    },
    Z: {
        shape: [[1, 1, 0],
            [0, 1, 1],
            [0, 0, 0]],
        color: "#EF2029"
    }
};
const CONFIG = {
    board_tl: { x: 0, y: 0 },
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
    var _a, _b;
    CONFIG.aienabled = !CONFIG.aienabled;
    // console.info('AI toggled; now ' + CONFIG.aienabled);
    // Toggle other AI inputs
    if (CONFIG.aienabled) {
        (_a = document.getElementById("ai-delay-input")) === null || _a === void 0 ? void 0 : _a.removeAttribute("disabled");
    }
    else {
        (_b = document.getElementById("ai-delay-input")) === null || _b === void 0 ? void 0 : _b.setAttribute("disabled", "");
    }
}
function toggleShowHint() {
    CONFIG.showhint = !CONFIG.showhint;
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
    let val = Number(el.value);
    if (isNaN(val)) {
        el.value = String(CONFIG[setting]);
        return;
    }
    if (val < MINSETTINGS[setting]) {
        el.value = String(MINSETTINGS[setting]);
    }
    CONFIG[setting] = Number(val);
    if (setting === "framerate")
        frameRate(CONFIG.framerate);
    // console.info(setting + ' set to: ' + el.value);
    // Update statistics
    if (CONFIG.aienabled && ai.toexecute) {
        displayScore(ai.toexecute);
    }
    else {
        displayScore(ai.getpotential(board.curtetromino));
    }
}
function toggleScaled(setting) {
    // coerce types
    const formattedSetting = setting.replace("-", "");
    const scaledSetting = "scaled_" + formattedSetting;
    CONFIG[scaledSetting] = !CONFIG[scaledSetting];
    if (CONFIG[scaledSetting]) {
        if (setting === "holes") {
            document.getElementById("stats-holes-label").innerText = "Holes (scaled)";
        }
        document.getElementById("exp-" + setting).removeAttribute("disabled");
    }
    else {
        if (setting === "holes") {
            document.getElementById("stats-holes-label").innerText = "Holes";
        }
        document.getElementById("exp-" + setting).setAttribute("disabled", "");
    }
}
/* Initialize HTML config settings */
if (CONFIG.aienabled) {
    document.getElementById("enable-ai-input").setAttribute("checked", "");
    document.getElementById("ai-delay-input").removeAttribute("disabled");
}
if (CONFIG.showhint)
    document.getElementById("show-hint-input").setAttribute("checked", "");
document.getElementById("ai-delay-input").value = String(CONFIG.aidelay);
document.getElementById("frame-rate-input").value = String(CONFIG.framerate);
document.getElementById("drop-frames-input").value = String(CONFIG.dropframes);
document.getElementById("weight-line-clears").value = String(CONFIG.weight_lineclears);
document.getElementById("weight-holes").value = String(CONFIG.weight_holes);
document.getElementById("weight-board-height").value = String(CONFIG.weight_boardheight);
document.getElementById("weight-placement-height").value = String(CONFIG.weight_placementheight);
document.getElementById("weight-avg-height-diff").value = String(CONFIG.weight_avgheightdiff);
if (CONFIG.scaled_holes) {
    document.getElementById("scaled-holes").setAttribute("checked", "");
    document.getElementById("exp-holes").removeAttribute("disabled");
}
if (CONFIG.scaled_boardheight) {
    document.getElementById("scaled-board-height").setAttribute("checked", "");
    document.getElementById("exp-board-height").removeAttribute("disabled");
}
if (CONFIG.scaled_placementheight) {
    document.getElementById("scaled-placement-height").setAttribute("checked", "");
    document.getElementById("exp-placement-height").removeAttribute("disabled");
}
document.getElementById("exp-holes").value = String(CONFIG.exp_holes);
document.getElementById("exp-board-height").value = String(CONFIG.exp_boardheight);
document.getElementById("exp-placement-height").value = String(CONFIG.exp_placementheight);
// Disable default keyboard scrolling
window.addEventListener("keydown", function (e) {
    var _a;
    if (!((_a = document.activeElement) === null || _a === void 0 ? void 0 : _a.className.includes("settings-number")) && [32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
    }
}, false);
function toggleSettings(el) {
    if (el.innerText.includes("Advanced")) {
        document.getElementById("basic-settings").classList.add("collapsed");
        document.getElementById("advanced-settings").classList.remove("collapsed");
        document.getElementById("settings-content").classList.remove("collapsed");
        el.innerText = "Basic";
    }
    else {
        document.getElementById("basic-settings").classList.remove("collapsed");
        document.getElementById("advanced-settings").classList.add("collapsed");
        document.getElementById("settings-content").classList.add("collapsed");
        el.innerText = "Advanced";
    }
}
let board;
let ai;
function setup() {
    let canvas = createCanvas(800, 800);
    canvas.parent("sketch");
    frameRate(CONFIG.framerate);
    CONFIG.board_tl = { x: 0.5 * (width - CONFIG.board_w), y: 0.5 * (height - CONFIG.board_h) };
    resetBoard();
}
function draw() {
    background(250);
    fill(0);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(24);
    text(`Lines cleared: ${board.lineclears}`, width / 2, 50);
    textSize(20);
    text("Next", width / 2 + 242, 110);
    text("Hold", width / 2 - 241, 110);
    if (board.gameover) {
        textSize(28);
        text("Game Over", width / 2, height - 60);
        document.getElementById("replay-btn").style.visibility = "visible";
        noLoop();
    }
    board.draw();
}
function keyPressed() {
    var _a;
    // Disabled if focused on settings
    if ((_a = document.activeElement) === null || _a === void 0 ? void 0 : _a.classList.contains("settings-number"))
        return;
    if (keyCode === LEFT_ARROW) {
        board.move(board.curtetromino, 0, -1);
    }
    else if (keyCode === RIGHT_ARROW) {
        board.move(board.curtetromino, 0, 1);
    }
    else if (key === " ") {
        board.moveDrop(board.curtetromino);
    }
    else if (keyCode === DOWN_ARROW) {
        board.move(board.curtetromino, 1, 0);
    }
    else if (keyCode === UP_ARROW) {
        board.rotate(board.curtetromino, Rotation.CLOCKWISE);
    }
    else if (key === "z") {
        board.rotate(board.curtetromino, Rotation.COUNTERCLOCKWISE);
    }
    else if (keyCode === SHIFT) {
        board.hold();
    }
    if (!CONFIG.aienabled) {
        displayScore(ai.getpotential(board.curtetromino));
    }
}
function resetBoard() {
    board = new Board(0.5 * (width - CONFIG.board_w), 0.5 * (height - CONFIG.board_h), CONFIG.board_w, CONFIG.board_h);
    ai = new AI(board);
    document.getElementById("replay-btn").style.visibility = "hidden";
    loop();
}
