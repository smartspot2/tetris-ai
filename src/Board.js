class Board {
    /** @type {(number | string)[][]} */
    arr;
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     */
    constructor(x, y, w, h) {
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

        this.framesUntilDrop = CONFIG.framedelay;
        this.lineclears = 0;
    }

    refillBag() {
        this.curbag = [new Tetromino('O', -2, 4)];
        for (let kind of ['I', 'J', 'L', 'S', 'T', 'Z']) {
            this.curbag.push(new Tetromino(kind, -2, 3));
        }
        this.curbag = shuffle(this.curbag);
    }

    draw() {
        this.drawBoard();

        if (ai.enabled && ai.toexecute) {
            let aitarget = ai.toexecute.tet;
            aitarget.draw('11');
        } else if (!ai.enabled && CONFIG.showhint) {
            let possible = ai.getbestlist();
            for (let pos of possible) {
                pos.tet.draw('11');
            }
        }

        this.curtetromino.draw();
        this.nexttetromino.drawat(1.5, CONFIG.cols + 2, 0.75);
        if (this.heldtetromino) {
            this.heldtetromino.drawat(1.5, -2 - 3*0.75, 0.75);
        }
        this.getGhost(this.curtetromino).draw('33');

        if (!this.framesUntilDrop--) {
            this.framesUntilDrop = CONFIG.framedelay;

            if (this.isValid(this.curtetromino, 1, 0)) {
                this.curtetromino.moveDown();
            } else {
                this.placeCurTetromino();
            }
        }
        ai.aistep();
    }

    drawBoard() {
        fill(230);
        noStroke();
        rect(this.x, this.y, this.w, this.h);

        noFill();
        stroke(190);
        for (let r = 0; r < CONFIG.rows; r++) {
            for (let c = 0; c < CONFIG.cols; c++) {
                if (this.arr[r][c]) {
                    fill(this.arr[r][c]);
                } else {
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
        rect(this.x + this.w + CONFIG.tilesize*(1.5 - 0.25), this.y + CONFIG.tilesize, CONFIG.tilesize*5*0.75, CONFIG.tilesize*2.75);
        rect(this.x - CONFIG.tilesize*(1.5 + 5*0.75 - 0.25), this.y + CONFIG.tilesize, CONFIG.tilesize*5*0.75, CONFIG.tilesize*2.75);
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
     * @param {Tetromino} tetromino
     * @param {number} direction     (1 = clockwise, -1 = counterclockwise) maybe change if something else is more convenient
     */
    rotate(tetromino, direction) {
        let origshape = tetromino.shape.slice();
        tetromino.shape = tetromino.getRotation(direction);
        if (!this.isValid(tetromino, 0, 0)) {
            tetromino.shape = origshape;
        }
    }

    hold() {
        if (this.heldtetromino) {
            let heldtype = this.heldtetromino.kind;
            this.heldtetromino.kind = this.curtetromino.kind;
            this.heldtetromino.reset();
            this.curtetromino.kind = heldtype;
            this.curtetromino.reset();
        } else {
            this.heldtetromino = this.curtetromino;
            this.heldtetromino.reset();
            this.curtetromino = this.nexttetromino;
            this.nexttetromino = this.curbag.pop();
            if (!this.curbag.length) {
                this.refillBag();
            }
        }
        this.framesUntilDrop = Math.floor(CONFIG.framedelay * 0.25);
    }

    isValid(tetromino, dr, dc) {
        for (let tet_r = 0; tet_r < tetromino.shape.length; tet_r++) {
            for (let tet_c = 0; tet_c < tetromino.shape[tet_r].length; tet_c++) {
                if (!tetromino.shape[tet_r][tet_c]) continue;
                let board_r = tetromino.r + tet_r + dr; let board_c = tetromino.c + tet_c + dc;
                // No part of shape can be out of bounds
                if (board_r >= CONFIG.rows || board_c < 0 || board_c >= CONFIG.cols) return false;
                if (board_r < 0) continue;
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
        this.curtetromino = this.nexttetromino
        this.nexttetromino = this.curbag.pop();
        if (!this.curbag.length) {
            this.refillBag();
        }
        this.framesUntilDrop = Math.floor(CONFIG.framedelay * 0.25);
    }

    /**
     * Place on board, with no checks
     * @param {Tetromino} tetromino
     */
    place(tetromino) {
        for (let tet_r = 0; tet_r < tetromino.shape.length; tet_r++) {
            for (let tet_c = 0; tet_c < tetromino.shape[tet_r].length; tet_c++) {
                if (!tetromino.shape[tet_r][tet_c]) continue;
                if (tetromino.r + tet_r >= CONFIG.rows || tetromino.r + tet_r < 0 ||
                    tetromino.c + tet_c < 0 || tetromino.c + tet_c >= CONFIG.cols) continue;

                if (!this.arr[tetromino.r + tet_r][tetromino.c + tet_c]) {
                    this.arr[tetromino.r + tet_r][tetromino.c + tet_c] = COLORS[tetromino.kind];
                } else {
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
