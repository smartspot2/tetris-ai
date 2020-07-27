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
        }
        if (this.framesuntilnext--) {
            return;
        }
        this.framesuntilnext = CONFIG.aidelay;

        // only execute subsections <= current row position (+1 to account for above the board)
        let curstepnumber = this.board.curtetromino.r + 1;
        let nextstep = Object.keys(this.toexecute.steps).find(k => this.toexecute.steps[k].length > 0 && Number(k) <= curstepnumber);
        if (!nextstep) return;
        let cmd = this.toexecute.steps[nextstep].shift();
        switch (cmd) {
            case 'R':
                this.board.move(this.board.curtetromino, 0, 1);
                break;
            case 'L':
                this.board.move(this.board.curtetromino, 0, -1);
                break;
            case 'd':
                this.board.moveDrop(this.board.curtetromino);
                break;
            case 'C':
                this.board.rotate(this.board.curtetromino, 1);
                break;
            case 'c':
                this.board.rotate(this.board.curtetromino, -1);
                break;
            case 'H':
                this.board.hold();
                break;
        }
        if (this.toexecute.steps[nextstep].length === 0) delete this.toexecute.steps[nextstep];
        if (Object.keys(this.toexecute.steps).length === 0) {
            this.toexecute = null;
        }
    }

    getbestlist() {
        let poslist = this.getendpositions();
        let scorelist = poslist.map(pos => this.getscore(pos));
        let maxScore = Math.max(...scorelist);
        return poslist.filter((pos, idx) => scorelist[idx] === maxScore);
    }

    /**
     * @returns {{steps: string[][], tet: Tetromino, row: number, col: number, arr: (number | string)[][]}}
     */
    selectdest() {
        let bestlist = this.getbestlist();
        let toexecute;
        if (bestlist.length === 1) {
            toexecute = bestlist[0];
        } else {
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
        } else {
            tetlist.push(this.board.heldtetromino.copy());
        }
        for (let temptetidx of [0, 1]) {
            let temptet = tetlist[temptetidx];
            if (temptet) {
                temptet = temptet.copy();
            } else {
                continue;
            }
            let orig_c = temptet.c;
            for (let currot = 0; currot < 4; currot++) {
                for (let c = -2; c < CONFIG.cols; c++) {
                    temptet.r = -1;
                    temptet.c = c;
                    if (this.board.isValid(temptet, 0, 0)) {
                        let prevarr = this.board.arr.map(a => a.slice());
                        let finaltet = this.board.getGhost(temptet);
                        this.board.place(finaltet);
                        let curarr = this.board.arr.map(a => a.slice());
                        // console.log({prevarr, curarr});
                        this.board.arr = prevarr;
                        let potential = {
                            steps: {},
                            row: finaltet.r,
                            col: finaltet.c,
                            arr: curarr,
                            tet: finaltet
                        }
                        let stepsequence = [];
                        // Hold
                        if (temptetidx === 1) {
                            stepsequence.push('H');
                        }
                        // Rotations
                        if (currot <= 2) {
                            for (let _rot = 0; _rot < currot; _rot++) {
                                stepsequence.push('C');
                            }
                        } else {
                            stepsequence.push('c');
                        }
                        // Movement
                        let total_dc = finaltet.c - orig_c;
                        let dc_dir = Math.sign(total_dc);
                        for (let dc = 0; Math.abs(dc) < Math.abs(total_dc); dc += dc_dir) {
                            if (dc_dir === -1) {
                                stepsequence.push('L');
                            } else if (dc_dir === 1) {
                                stepsequence.push('R');
                            }
                        }
                        potential.steps[0] = stepsequence;
                        potential.steps[0].push('d');
                        poslist.push(potential);
                    }
                }
                temptet.shape = temptet.getRotation(1);
            }
        }
        return poslist;
    }

    /**
     * Scores a potential end position
     * @param potential
     * @returns {number}
     */
    getscore(potential) {
        let score = 0;
        let arr = potential.arr;
        // check line clears
        for (let r = 0; r < CONFIG.rows; r++) {
            if (!arr[r].includes(0)) {
                score += 200;
            }
        }
        // penalize holes
        for (let c = 0; c < CONFIG.cols; c++) {
            let firsttile = arr.findIndex(row => row[c] !== 0);
            if (firsttile === -1) continue;
            let numholes = 0;
            for (let r = firsttile; r < CONFIG.rows; r++) {
                if (arr[r][c] === 0) {
                    numholes++;
                }
            }
            score -= 300 * Math.sqrt(numholes);
        }
        // penalize height
        let firstrowwithtile = arr.findIndex(row => !row.every(item => item === 0));
        score -= Math.pow((CONFIG.rows - firstrowwithtile), 2);
        // penalize placement height
        score -= Math.pow(CONFIG.rows - potential.row, 2) * 5;

        // penalize wells
        let heights = [];
        for (let c = 0; c < CONFIG.cols; c++) {
            let ht = arr.findIndex(row => row[c] !== 0);
            if (ht === -1) {
                heights.push(0);
            } else {
                heights.push(CONFIG.rows - ht);
            }
        }
        let sumheightdiffs = 0;
        for (let c = 1; c < CONFIG.cols; c++) {
            sumheightdiffs += Math.abs(heights[c] - heights[c - 1]);
        }
        score -= sumheightdiffs * 75 / (CONFIG.cols - 1);
        return score;
    }
}

/**
 *
 * @type {{r: number, steps: [string, string]}}
 */
const OBJ = {
    steps: ['a', 'b'],
    r: 2
}
