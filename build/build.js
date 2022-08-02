"use strict";
var AIStep;
(function (AIStep) {
    AIStep["RIGHT"] = "R";
    AIStep["LEFT"] = "L";
    AIStep["DROP"] = "D";
    AIStep["CLOCKWISE"] = "C";
    AIStep["COUNTERCLOCKWISE"] = "c";
    AIStep["HOLD"] = "H";
    AIStep["DOWN"] = "d"; // either press down, or wait for the tetromino to drop by one
})(AIStep || (AIStep = {}));
class AI {
    constructor(board) {
        this.board = board;
        this.toExecute = null;
        this.framesUntilNext = CONFIG.aidelay;
    }
    aistep() {
        if (!CONFIG.aienabled) {
            return;
        }
        if (!this.toExecute) {
            this.toExecute = this.selectDest();
            displayScore(this.toExecute);
        }
        if (this.framesUntilNext-- > 0) {
            return;
        }
        this.framesUntilNext = CONFIG.aidelay;
        if (this.toExecute.steps.length === 0) {
            this.toExecute = null;
            return;
        }
        // only execute subsections <= current row position
        let nextStepNumber, nextStep;
        if (CONFIG.aidelay < 0) {
            [nextStepNumber, nextStep] = this.toExecute.steps.shift();
        }
        else {
            const curStepNumber = this.board.curTetromino.r;
            do {
                [nextStepNumber, nextStep] = this.toExecute.steps[0];
                if (nextStepNumber > curStepNumber) {
                    return; // don't do anything yet this turn
                }
                else {
                    // execute this step; pop the first element
                    this.toExecute.steps.shift();
                }
                if (this.toExecute.steps.length === 0) {
                    break; // nothing left to loop with, so stop
                }
                // take the next step if it was DOWN and we passed it already
            } while (nextStep === AIStep.DOWN && curStepNumber !== nextStepNumber);
        }
        switch (nextStep) {
            case AIStep.RIGHT:
                this.board.move(this.board.curTetromino, 0, 1);
                break;
            case AIStep.LEFT:
                this.board.move(this.board.curTetromino, 0, -1);
                break;
            case AIStep.DROP:
                this.board.moveDrop(this.board.curTetromino);
                break;
            case AIStep.CLOCKWISE:
                this.board.rotate(this.board.curTetromino, Rotation.CLOCKWISE);
                break;
            case AIStep.COUNTERCLOCKWISE:
                this.board.rotate(this.board.curTetromino, Rotation.COUNTERCLOCKWISE);
                break;
            case AIStep.DOWN:
                // only move down if it's in the position to do so
                if (this.board.curTetromino.r <= nextStepNumber) {
                    this.board.move(this.board.curTetromino, 1, 0);
                }
                break;
            case AIStep.HOLD:
                this.board.hold();
                break;
        }
        if (this.toExecute !== null) {
            if (this.toExecute.steps.length === 0) {
                this.toExecute = null;
            }
            // Recurse to do all steps if aidelay = -1
            if (CONFIG.aidelay === -1) {
                this.aistep();
            }
        }
    }
    getbestlist() {
        // starting values of the current and next tetrominos
        const curTet = this.board.curTetromino.copy();
        let altTet, nextTet;
        if (this.board.heldTetromino != null) {
            altTet = this.board.heldTetromino.copy();
            nextTet = this.board.nextTetromino.copy();
        }
        else {
            altTet = this.board.nextTetromino.copy();
            nextTet = undefined;
        }
        // get all possible end positions
        let posList = this.bfsEndPositions(curTet.copy(), altTet.copy());
        // filter to only the top 25%
        let scoreList = posList.map(pos => this.getScore(pos));
        const sortedScoreList = scoreList.slice();
        sortedScoreList.sort((a, b) => b - a);
        let cutoff = sortedScoreList[Math.floor(scoreList.length / 4)];
        if (cutoff === sortedScoreList[0]) {
            cutoff -= 1; // include the top score if necessary
        }
        posList = posList.filter((_pos, idx) => scoreList[idx] > cutoff);
        scoreList = scoreList.filter(score => score > cutoff);
        // bump previous; need to have a strict improvement to take the next
        scoreList = scoreList.map(score => score + CONFIG.aiturnimprovement);
        // get all possible end positions for the next turn, for each one of the previous
        const prevArr = this.board.arr.map(a => a.slice());
        const nextScores = posList.map(pos => {
            this.board.place(pos.tet); // place the tetromino
            this.board.checkLineClears(false);
            let nextStart, nextAlt;
            if (nextTet === undefined) {
                nextStart = pos.tet.kind === curTet.kind ? altTet.copy() : curTet.copy();
                nextAlt = undefined;
            }
            else if (pos.tet.kind === curTet.kind) {
                nextStart = nextTet.copy();
                nextAlt = altTet.copy();
            }
            else {
                nextStart = altTet.copy();
                nextAlt = nextTet.copy();
            }
            // get all next end positions; no need to store the steps here
            const nextPosList = this.bfsEndPositions(nextStart, nextAlt, false);
            const nextScoreList = nextPosList.map(nextPos => this.getScore(nextPos));
            // restore the board
            this.board.arr = prevArr.map(a => a.slice());
            return Math.max(...nextScoreList);
        });
        const maxScore = Math.max(...nextScores, ...scoreList);
        return posList.filter((_pos, idx) => scoreList[idx] === maxScore || nextScores[idx] === maxScore);
    }
    selectDest() {
        const bestList = this.getbestlist();
        let toExecute;
        if (bestList.length === 1) {
            toExecute = bestList[0];
        }
        else {
            // For now, randomly select out of best
            const randIndex = Math.floor(Math.random() * Math.floor(bestList.length));
            toExecute = bestList[randIndex];
        }
        return toExecute;
    }
    getPotential(tet) {
        const prevArr = this.board.arr.map(a => a.slice());
        const finalTet = this.board.getGhost(tet);
        this.board.place(finalTet);
        const curArr = this.board.arr.map(a => a.slice());
        this.board.arr = prevArr;
        return {
            steps: [],
            row: finalTet.r,
            col: finalTet.c,
            arr: curArr,
            tet: finalTet
        };
    }
    /**
     * Run BFS to find a list of all possible end positions,
     * with the shortest paths to get there.
     */
    bfsEndPositions(curTet, nextTet, storeSteps = true) {
        const possibilities = [];
        const visited = new Set();
        const visited_dropped = new Set();
        const queue = [{ cur: curTet.copy(), prevSteps: [] }];
        // add alternate start
        if (nextTet !== undefined) {
            const holdSteps = [[-999, AIStep.HOLD]];
            queue.push({ cur: nextTet.copy(), prevSteps: storeSteps ? holdSteps : [] });
        }
        // breadth-first search for all possible end positions
        while (queue.length > 0) {
            const { cur, prevSteps } = queue.shift();
            // drop
            const dropped = this.board.getGhost(cur);
            if (!visited_dropped.has(dropped.toString()) && this.board.isValidMovement(dropped, 0, 0)) {
                // haven't already tried dropping the tetromino here
                visited_dropped.add(dropped.toString());
                // place on board and save steps
                const prevArr = this.board.arr.map(a => a.slice());
                this.board.place(dropped);
                const curArr = this.board.arr;
                this.board.arr = prevArr;
                let finalSteps = [];
                if (storeSteps) {
                    finalSteps = prevSteps.slice();
                    finalSteps.push([cur.r, AIStep.DROP]);
                }
                const potential = {
                    arr: curArr,
                    row: dropped.r,
                    col: dropped.c,
                    steps: storeSteps ? finalSteps : [],
                    tet: dropped
                };
                possibilities.push(potential);
            }
            // rotations
            const possibleRotations = [Rotation.CLOCKWISE, Rotation.COUNTERCLOCKWISE];
            for (const rotation of possibleRotations) {
                const step = rotation === Rotation.CLOCKWISE ? AIStep.CLOCKWISE : AIStep.COUNTERCLOCKWISE;
                const rotateTet = cur.copy();
                const [validRotation, [dr, dc]] = this.board.isValidRotation(rotateTet, rotation);
                if (validRotation) {
                    // valid rotation
                    rotateTet.rotate(rotation);
                    rotateTet.r += dr;
                    rotateTet.c += dc;
                    const next = rotateTet.copy();
                    if (!visited.has(next.toString())) {
                        if (storeSteps) {
                            const nextSteps = prevSteps.slice();
                            nextSteps.push([cur.r, step]);
                            queue.push({ cur: next, prevSteps: nextSteps });
                        }
                        else {
                            queue.push({ cur: next, prevSteps: [] });
                        }
                        visited.add(next.toString());
                    }
                }
            }
            // movement
            if (this.board.isValidMovement(cur, 0, -1)) {
                // can move left
                const next = cur.copy();
                next.c -= 1;
                if (!visited.has(next.toString())) {
                    if (storeSteps) {
                        const nextSteps = prevSteps.slice();
                        nextSteps.push([cur.r, AIStep.LEFT]);
                        queue.push({ cur: next, prevSteps: nextSteps });
                    }
                    else {
                        queue.push({ cur: next, prevSteps: [] });
                    }
                    visited.add(next.toString());
                }
            }
            if (this.board.isValidMovement(cur, 0, 1)) {
                // can move right
                const next = cur.copy();
                next.c += 1;
                if (!visited.has(next.toString())) {
                    if (storeSteps) {
                        const nextSteps = prevSteps.slice();
                        nextSteps.push([cur.r, AIStep.RIGHT]);
                        queue.push({ cur: next, prevSteps: nextSteps });
                    }
                    else {
                        queue.push({ cur: next, prevSteps: [] });
                    }
                    visited.add(next.toString());
                }
            }
            if (this.board.isValidMovement(cur, 1, 0)) {
                // can move down
                const next = cur.copy();
                next.r += 1;
                if (!visited.has(next.toString())) {
                    if (storeSteps) {
                        const nextSteps = prevSteps.slice();
                        nextSteps.push([cur.r, AIStep.DOWN]);
                        queue.push({ cur: next, prevSteps: nextSteps });
                    }
                    else {
                        queue.push({ cur: next, prevSteps: [] });
                    }
                    visited.add(next.toString());
                }
            }
        }
        return possibilities;
    }
    /**
     * Scores a potential end position
     */
    getScore(potential) {
        let score = 0;
        const stats = this.getStatistics(potential);
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
    getStatistics(potential) {
        const stats = {};
        const potentialArr = potential.arr;
        // line clears
        stats.lineclears = 0;
        for (let r = 0; r < CONFIG.rows; r++) {
            if (!potentialArr[r].includes(0)) {
                stats.lineclears += 1;
            }
        }
        // make copy of array with lines cleared; use this for rest of stats
        const arr = potentialArr.map(row => row.slice());
        for (let r = 0; r < CONFIG.rows; r++) {
            if (!arr[r].includes(0)) {
                arr.splice(r, 1);
                arr.splice(0, 0, Array(CONFIG.cols).fill(0));
            }
        }
        // holes
        stats.totalholes = 0;
        stats.scaledholes = 0;
        for (let c = 0; c < CONFIG.cols; c++) {
            const firstTile = arr.findIndex(row => row[c] !== 0);
            if (firstTile === -1) {
                continue;
            }
            let numHoles = 0;
            for (let r = firstTile; r < CONFIG.rows; r++) {
                if (arr[r][c] === 0) {
                    numHoles++;
                    stats.totalholes++;
                }
            }
            stats.scaledholes += Math.pow(numHoles, CONFIG.exp_holes);
        }
        // board height
        const firstRowWithTile = arr.findIndex(row => !row.every(item => item === 0));
        stats.boardheight = CONFIG.rows - firstRowWithTile;
        stats.scaledboardheight = Math.pow(stats.boardheight, CONFIG.exp_boardheight);
        // placement height
        stats.placementheight = CONFIG.rows - potential.row;
        stats.scaledplacementheight = Math.pow(CONFIG.rows - potential.row, CONFIG.exp_placementheight);
        // height distribution
        const heights = [];
        for (let c = 0; c < CONFIG.cols; c++) {
            const ht = arr.findIndex(row => row[c] !== 0);
            if (ht === -1) {
                heights.push(0);
            }
            else {
                heights.push(CONFIG.rows - ht);
            }
        }
        let sumHeightDiffs = 0;
        for (let c = 1; c < CONFIG.cols; c++) {
            sumHeightDiffs += Math.abs(heights[c] - heights[c - 1]);
        }
        stats.avgheightdiff = sumHeightDiffs / (CONFIG.cols - 1);
        return stats;
    }
}
function displayScore(potential) {
    const HTMLscore = document.getElementById("stats-current-score");
    const HTMLlineclears = document.getElementById("stats-line-clears");
    const HTMLlineclearscalc = document.getElementById("stats-line-clears-calc");
    const HTMLholes = document.getElementById("stats-holes");
    const HTMLholescalc = document.getElementById("stats-holes-calc");
    const HTMLboardheight = document.getElementById("stats-board-height");
    const HTMLboardheightcalc = document.getElementById("stats-board-height-calc");
    const HTMLplacementheight = document.getElementById("stats-placement-height");
    const HTMLplacementheightcalc = document.getElementById("stats-placement-height-calc");
    const HTMLavgheightdiff = document.getElementById("stats-avg-height-diff");
    const HTMLavgheightdiffcalc = document.getElementById("stats-avg-height-diff-calc");
    const score = ai.getScore(potential);
    const stats = ai.getStatistics(potential);
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
        this.curBag = [];
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.tileSize = this.w / 10;
        this.arr = Array(CONFIG.rows).fill(0).map(() => Array(CONFIG.cols).fill(0));
        // Tetromino bag
        this.refillBag();
        this.curTetromino = this.curBag.pop();
        this.nextTetromino = this.curBag.pop();
        this.heldTetromino = null;
        this.framesUntilDrop = CONFIG.dropframes;
        this.framesUntilLock = -1;
        this.hasHeld = false;
        this.lineClears = 0;
        this.gameOver = false;
    }
    refillBag() {
        this.curBag = [new Tetromino("O", -2, 4, Rotation.SPAWN)];
        for (const kind of ["I", "J", "L", "S", "T", "Z"]) {
            this.curBag.push(new Tetromino(kind, -2, 3, Rotation.SPAWN));
        }
        this.curBag = shuffle(this.curBag);
    }
    draw() {
        this.drawBoard();
        if (CONFIG.aienabled && ai.toExecute) {
            const aitarget = ai.toExecute.tet;
            aitarget.draw(CONFIG.aitarget_alpha);
        }
        else if (!CONFIG.aienabled && CONFIG.showhint) {
            if (ai.toExecute == null) {
                ai.toExecute = ai.selectDest();
            }
            ai.toExecute.tet.draw(CONFIG.hint_alpha);
        }
        this.curTetromino.draw();
        this.nextTetromino.drawat(1.5, CONFIG.cols + 2, 0.75);
        if (this.heldTetromino) {
            this.heldTetromino.drawat(1.5, -2 - 3 * 0.75, 0.75);
        }
        if (!this.gameOver) {
            this.getGhost(this.curTetromino).draw(CONFIG.ghost_alpha);
            const onGround = !this.isValidMovement(this.curTetromino, 1, 0);
            if (this.framesUntilLock !== null && !onGround) {
                this.framesUntilLock = null;
            }
            if (this.framesUntilLock !== null) {
                // currently on the ground; decrease lock timer
                if (this.framesUntilLock > 0) {
                    this.framesUntilLock--;
                }
                else if (this.framesUntilLock === 0) {
                    this.placeCurTetromino();
                    // reset timers
                    this.framesUntilLock = null;
                    this.framesUntilDrop = CONFIG.dropframes;
                }
            }
            else {
                // not currently on the ground; decrease gravity timer
                this.framesUntilDrop--;
                if (this.framesUntilDrop <= 0) {
                    this.framesUntilDrop = CONFIG.dropframes;
                    if (this.isValidMovement(this.curTetromino, 1, 0)) {
                        this.curTetromino.moveDown();
                        // check if it's on the ground; if so, start lock timer
                        if (!this.isValidMovement(this.curTetromino, 1, 0)) {
                            this.framesUntilDrop = CONFIG.dropLockFrames;
                        }
                    }
                    else {
                        this.placeCurTetromino();
                    }
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
                rect(this.x + this.tileSize * c, this.y + this.tileSize * r, this.tileSize, this.tileSize);
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
        if (this.isValidMovement(tetromino, dr, dc)) {
            tetromino.r += dr;
            tetromino.c += dc;
        }
        // check if it's on the ground; if so, start the timer
        const onGround = !this.isValidMovement(tetromino, 1, 0);
        if (this.framesUntilLock === null && onGround) {
            this.framesUntilLock = CONFIG.dropLockFrames;
        }
    }
    moveDrop(tetromino) {
        const ghostTet = this.getGhost(tetromino);
        this.curTetromino.r = ghostTet.r;
        this.placeCurTetromino();
    }
    /**
     * Rotate tetromino if valid
     */
    rotate(tetromino, direction) {
        const [validRotation, [dr, dc]] = this.isValidRotation(tetromino, direction);
        if (validRotation) {
            tetromino.rotate(direction);
            tetromino.r += dr;
            tetromino.c += dc;
        }
        // check if it's on the ground, if so, start the timer
        const onGround = !this.isValidMovement(tetromino, 1, 0);
        if (this.framesUntilLock === null && onGround) {
            this.framesUntilLock = CONFIG.dropLockFrames;
        }
    }
    hold() {
        if (this.hasHeld) {
            return; // can't hold more than once
        }
        if (this.heldTetromino) {
            const heldtype = this.heldTetromino.kind;
            this.heldTetromino.kind = this.curTetromino.kind;
            this.heldTetromino.reset();
            this.curTetromino.kind = heldtype;
            this.curTetromino.reset();
        }
        else {
            this.heldTetromino = this.curTetromino;
            this.heldTetromino.reset();
            this.curTetromino = this.nextTetromino;
            this.nextTetromino = this.curBag.pop();
            if (!this.curBag.length) {
                this.refillBag();
            }
        }
        this.framesUntilDrop = 1;
        this.hasHeld = true;
    }
    isValidMovement(tetromino, dr, dc) {
        const shape = tetromino.getShape();
        const row = tetromino.r + dr;
        const col = tetromino.c + dc;
        return this.isValid(row, col, shape);
    }
    /**
     * Checks whether the given rotation is valid.
     * Performs wall kicks if necessary.
     *
     * Returns the tuple [isValid, [dr, dc]],
     * where the tuple [dr, dc] gives the wall kick translation which made the rotation valid.
     *
     * If invalid, the returned translation defaults to [0, 0].
     */
    isValidRotation(tetromino, rotation) {
        const shape = tetromino.getRotation(rotation);
        const row = tetromino.r;
        const col = tetromino.c;
        let tests;
        if (tetromino.kind === "I") {
            tests = WALLKICK_TESTS_I[tetromino.rotation][rotation];
        }
        else {
            tests = WALLKICK_TESTS[tetromino.rotation][rotation];
        }
        for (const [dr, dc] of tests) {
            if (this.isValid(row + dr, col + dc, shape)) {
                return [true, [dr, dc]];
            }
        }
        return [false, [0, 0]];
    }
    placeCurTetromino() {
        ai.toExecute = null;
        this.place(this.curTetromino);
        this.checkLineClears();
        this.curTetromino = this.nextTetromino;
        this.nextTetromino = this.curBag.pop();
        if (!this.curBag.length) {
            this.refillBag();
        }
        this.framesUntilDrop = 1;
        this.hasHeld = false; // can hold again
        // Check validity of new tetromino/check for gameover
        if (this.getGhost(this.curTetromino).r === this.curTetromino.r) {
            this.gameOver = true;
        }
    }
    /**
     * Place on board, with no checks
     */
    place(tetromino) {
        const shape = tetromino.getShape();
        for (let tet_r = 0; tet_r < shape.length; tet_r++) {
            for (let tet_c = 0; tet_c < shape[tet_r].length; tet_c++) {
                if (!shape[tet_r][tet_c]) {
                    continue;
                }
                if (tetromino.r + tet_r >= CONFIG.rows || tetromino.r + tet_r < 0
                    || tetromino.c + tet_c < 0 || tetromino.c + tet_c >= CONFIG.cols) {
                    continue;
                }
                if (this.arr[tetromino.r + tet_r][tetromino.c + tet_c] === 0) {
                    this.arr[tetromino.r + tet_r][tetromino.c + tet_c] = color(TETROMINO_TYPE[tetromino.kind].color);
                }
                else {
                    throw Error(`Invalid tetromino (${tetromino.kind}) placement:`
                        + `is ${this.arr[tetromino.r + tet_r][tetromino.c + tet_c]}`
                        + `(${tetromino.r + tet_r}, ${tetromino.c + tet_c})`);
                }
            }
        }
    }
    checkLineClears(updateStat = true) {
        for (let r = 0; r < CONFIG.rows; r++) {
            if (!this.arr[r].includes(0)) {
                if (updateStat) {
                    this.lineClears += 1;
                }
                this.arr.splice(r, 1);
                this.arr.splice(0, 0, Array(CONFIG.cols).fill(0));
            }
        }
    }
    getGhost(tetromino) {
        let dr = 1;
        while (tetromino.r + dr < this.arr.length && this.isValidMovement(tetromino, dr, 0)) {
            dr++;
        }
        const tetCopy = tetromino.copy();
        tetCopy.r += dr - 1;
        return tetCopy;
    }
    /**
     * Helper to test validity for a given shape at a specific coordinate.
     */
    isValid(row, col, shape) {
        for (let tet_r = 0; tet_r < shape.length; tet_r++) {
            for (let tet_c = 0; tet_c < shape[tet_r].length; tet_c++) {
                if (!shape[tet_r][tet_c]) {
                    continue;
                }
                const board_r = row + tet_r;
                const board_c = col + tet_c;
                // No part of shape can be out of bounds
                if (board_r >= CONFIG.rows || board_c < 0 || board_c >= CONFIG.cols) {
                    return false;
                }
                else if (board_r < 0) {
                    // do nothing
                }
                else if (this.arr[board_r][board_c]) {
                    return false;
                }
            }
        }
        return true;
    }
}
var Rotation;
(function (Rotation) {
    Rotation[Rotation["SPAWN"] = 0] = "SPAWN";
    Rotation[Rotation["CLOCKWISE"] = 1] = "CLOCKWISE";
    Rotation[Rotation["FLIP"] = 2] = "FLIP";
    Rotation[Rotation["COUNTERCLOCKWISE"] = 3] = "COUNTERCLOCKWISE";
})(Rotation || (Rotation = {}));
const rotateFromState = (state, rotation) => {
    return (state + rotation) % 4;
};
class Tetromino {
    /**
     * Creates a tetromino object in arr coordinates
     * @param kind     Tetronimno name
     * @param r        Topleft row relative to arr
     * @param c        Topleft col relative to arr
     * @param rotation current rotation value relative to spawn
     */
    constructor(kind, r, c, rotation) {
        this.kind = kind;
        this.r = r;
        this.c = c;
        this.rotation = rotation;
    }
    draw(alpha) {
        this.drawat(this.r, this.c, 1, alpha);
    }
    drawat(r, c, scale, alpha) {
        const tetColor = TETROMINO_TYPE[this.kind].color;
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
            if (this.kind === "I") {
                c -= 0.375;
            }
            if (this.kind === "O") {
                c += 0.375;
            }
        }
        const shape = this.getShape();
        for (let shape_r = 0; shape_r < shape.length; shape_r++) {
            for (let shape_c = 0; shape_c < shape[shape_r].length; shape_c++) {
                if (shape[shape_r][shape_c] && r + shape_r >= 0) {
                    rect(CONFIG.board_tl.x + CONFIG.tilesize * c + CONFIG.tilesize * shape_c * scale, CONFIG.board_tl.y + CONFIG.tilesize * r + CONFIG.tilesize * shape_r * scale, CONFIG.tilesize * scale, CONFIG.tilesize * scale);
                }
            }
        }
    }
    moveDown() {
        this.r += 1;
    }
    getShape() {
        return this.getRotation(Rotation.SPAWN);
    }
    getRotation(direction) {
        // copy shape
        const shape = TETROMINO_TYPE[this.kind].shape;
        return this.getRotationFromShape(shape, rotateFromState(this.rotation, direction));
    }
    copy() {
        return new Tetromino(this.kind, this.r, this.c, this.rotation);
    }
    reset() {
        this.rotation = Rotation.SPAWN;
        this.r = -2;
        this.c = this.kind === "O" ? 4 : 3;
    }
    toString() {
        return `${this.kind}/${this.r}/${this.c}/${this.rotation}`;
    }
    rotate(direction) {
        this.rotation = rotateFromState(this.rotation, direction);
    }
    rotateValid(board, direction) {
    }
    getRotationFromShape(shape, direction) {
        if (direction === Rotation.SPAWN) {
            return shape;
        }
        const newShape = shape.map(row => row.slice());
        const size = shape.length;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                switch (direction) {
                    case Rotation.COUNTERCLOCKWISE:
                        newShape[r][c] = shape[c][size - r - 1];
                        break;
                    case Rotation.CLOCKWISE:
                        newShape[r][c] = shape[size - c - 1][r];
                        break;
                    case Rotation.FLIP:
                        newShape[r][c] = shape[size - r - 1][size - c - 1];
                        break;
                }
            }
        }
        return newShape;
    }
}
/**
 * All possible tetromino types, along with their corresponding shapes and colors.
 */
const TETROMINO_TYPE = {
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
/**
 * Translation tests for wall kick implementation.
 *
 * First level is the current rotation state,
 * second level is which direction we're rotating (i.e. CLOCKWISE vs COUNTERCLOCKWISE).
 * The resulting array gives a list of pairs (dr, dc) to translate by, to be tested in order.
 */
const WALLKICK_TESTS = {
    [Rotation.SPAWN]: {
        [Rotation.CLOCKWISE]: [
            [0, 0],
            [0, -1],
            [-1, -1],
            [2, 0],
            [2, -1]
        ],
        [Rotation.COUNTERCLOCKWISE]: [
            [0, 0],
            [0, 1],
            [-1, 1],
            [2, 0],
            [2, 1]
        ]
    },
    [Rotation.CLOCKWISE]: {
        [Rotation.CLOCKWISE]: [
            [0, 0],
            [0, 1],
            [1, 1],
            [-2, 0],
            [-2, 1]
        ],
        [Rotation.COUNTERCLOCKWISE]: [
            [0, 0],
            [0, 1],
            [1, 1],
            [-2, 0],
            [-2, 1]
        ]
    },
    [Rotation.FLIP]: {
        [Rotation.CLOCKWISE]: [
            [0, 0],
            [0, 1],
            [-1, 1],
            [2, 0],
            [2, 1]
        ],
        [Rotation.COUNTERCLOCKWISE]: [
            [0, 0],
            [0, -1],
            [-1, -1],
            [2, 0],
            [2, -1]
        ]
    },
    [Rotation.COUNTERCLOCKWISE]: {
        [Rotation.CLOCKWISE]: [
            [0, 0],
            [0, -1],
            [1, -1],
            [-2, 0],
            [-2, -1]
        ],
        [Rotation.COUNTERCLOCKWISE]: [
            [0, 0],
            [0, -1],
            [1, -1],
            [-2, 0],
            [-2, -1]
        ]
    }
};
const WALLKICK_TESTS_I = {
    [Rotation.SPAWN]: {
        [Rotation.CLOCKWISE]: [
            [0, 0],
            [0, -2],
            [0, 1],
            [1, -2],
            [-2, 1]
        ],
        [Rotation.COUNTERCLOCKWISE]: [
            [0, 0],
            [0, -1],
            [0, 2],
            [-2, -1],
            [1, 2]
        ]
    },
    [Rotation.CLOCKWISE]: {
        [Rotation.CLOCKWISE]: [
            [0, 0],
            [0, -1],
            [0, 2],
            [-2, -1],
            [1, 2]
        ],
        [Rotation.COUNTERCLOCKWISE]: [
            [0, 0],
            [0, 2],
            [0, -1],
            [-1, 2],
            [2, -1]
        ]
    },
    [Rotation.FLIP]: {
        [Rotation.CLOCKWISE]: [
            [0, 0],
            [0, 2],
            [0, -1],
            [-1, 2],
            [2, -1]
        ],
        [Rotation.COUNTERCLOCKWISE]: [
            [0, 0],
            [0, 1],
            [0, -2],
            [2, 1],
            [-1, -2]
        ]
    },
    [Rotation.COUNTERCLOCKWISE]: {
        [Rotation.CLOCKWISE]: [
            [0, 0],
            [0, 1],
            [0, -2],
            [2, 1],
            [-1, -2]
        ],
        [Rotation.COUNTERCLOCKWISE]: [
            [0, 0],
            [0, -2],
            [0, 1],
            [1, -2],
            [-2, 1]
        ]
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
    ghost_alpha: 51,
    aitarget_alpha: 100,
    hint_alpha: 17,
    dropframes: 30,
    dropLockFrames: 30,
    framerate: 30,
    aienabled: false,
    aidelay: 1,
    showhint: false,
    weight_lineclears: 200,
    weight_holes: 300,
    scale_unreachableholes: 1.5,
    scaled_holes: true,
    exp_holes: 0.66,
    weight_boardheight: 1,
    scaled_boardheight: true,
    exp_boardheight: 2,
    weight_placementheight: 5,
    scaled_placementheight: true,
    exp_placementheight: 2,
    weight_avgheightdiff: 75,
    aiturnimprovement: 100
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
    const val = Number(el.value);
    if (isNaN(val)) {
        el.value = String(CONFIG[setting]);
        return;
    }
    if (val < MINSETTINGS[setting]) {
        el.value = String(MINSETTINGS[setting]);
    }
    CONFIG[setting] = Number(val);
    if (setting === "framerate") {
        frameRate(CONFIG.framerate);
    }
    // console.info(setting + ' set to: ' + el.value);
    // Update statistics
    if (CONFIG.aienabled && ai.toExecute) {
        displayScore(ai.toExecute);
    }
    else {
        displayScore(ai.getPotential(board.curTetromino));
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
if (CONFIG.showhint) {
    document.getElementById("show-hint-input").setAttribute("checked", "");
}
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
    const canvas = createCanvas(800, 800);
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
    text(`Lines cleared: ${board.lineClears}`, width / 2, 50);
    textSize(20);
    text("Next", width / 2 + 242, 110);
    text("Hold", width / 2 - 241, 110);
    if (board.gameOver) {
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
    if ((_a = document.activeElement) === null || _a === void 0 ? void 0 : _a.classList.contains("settings-number")) {
        return;
    }
    if (keyCode === LEFT_ARROW) {
        board.move(board.curTetromino, 0, -1);
    }
    else if (keyCode === RIGHT_ARROW) {
        board.move(board.curTetromino, 0, 1);
    }
    else if (key === " ") {
        board.moveDrop(board.curTetromino);
    }
    else if (keyCode === DOWN_ARROW) {
        board.move(board.curTetromino, 1, 0);
    }
    else if (keyCode === UP_ARROW) {
        board.rotate(board.curTetromino, Rotation.CLOCKWISE);
    }
    else if (key === "z") {
        board.rotate(board.curTetromino, Rotation.COUNTERCLOCKWISE);
    }
    else if (keyCode === SHIFT) {
        board.hold();
    }
    if (!CONFIG.aienabled) {
        displayScore(ai.getPotential(board.curTetromino));
    }
}
function resetBoard() {
    board = new Board(0.5 * (width - CONFIG.board_w), 0.5 * (height - CONFIG.board_h), CONFIG.board_w, CONFIG.board_h);
    ai = new AI(board);
    document.getElementById("replay-btn").style.visibility = "hidden";
    loop();
}
