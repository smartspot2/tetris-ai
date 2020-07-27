class Tetromino {
    /**  @type {number[][]} */
    shape;
    /**
     * Creates a tetromino object in arr coordinates
     * @param {string} kind     Tetronimno name
     * @param {number} r        Topleft row relative to arr
     * @param {number} c        Topleft col relative to arr
     */
    constructor(kind, r, c) {
        this.kind = kind;
        this.shape = SHAPES[kind];
        this.r = r;
        this.c = c;
    }

    draw(alpha) {
        this.drawat(this.r, this.c, 1, alpha);
    }

    drawat(r, c, scale, alpha) {
        let color = COLORS[this.kind];
        stroke(CONFIG.tetromino_stroke);
        if (alpha) {
            fill(color + alpha);
        } else {
            fill(color);
        }
        if (scale === 0.75) {
            if (this.kind === 'I') c -= 0.375;
            if (this.kind === 'O') c += 0.375;
        }
        for (let shape_r = 0; shape_r < this.shape.length; shape_r++) {
            for (let shape_c = 0; shape_c < this.shape[shape_r].length; shape_c++) {
                if (this.shape[shape_r][shape_c] && r + shape_r >= 0) {
                    rect(CONFIG.board_tl.x + CONFIG.tilesize * c + CONFIG.tilesize * shape_c * scale,
                        CONFIG.board_tl.y + CONFIG.tilesize * r + CONFIG.tilesize * shape_r * scale,
                        CONFIG.tilesize*scale, CONFIG.tilesize*scale);
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
                if (direction === -1) {  // counterclockwise
                    newshape[r][c] = this.shape[c][this.shape[r].length - r - 1];
                } else if (direction === 1) {  // clockwise
                    newshape[r][c] = this.shape[this.shape.length - c - 1][r];
                }
            }
        }
        return newshape;
    }

    /**
     * @returns {Tetromino}
     */
    copy() {
        let tetcopy = new Tetromino(this.kind, this.r, this.c);
        tetcopy.shape = this.shape;
        return tetcopy;
    }

    reset() {
        this.shape = SHAPES[this.kind];
        this.r = -2;
        this.c = this.kind === 'O' ? 4 : 3;
    }
}

/**
 * Shape array for different tetrominos
 * @type {{S: number[][], T: number[][], I: number[][], J: number[][], Z: number[][], L: number[][], O: number[][]}}
 */
const SHAPES = {
    'I': [[0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]],
    'J': [[1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]],
    'L': [[0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]],
    'O': [[1, 1],
        [1, 1]],
    'S': [[0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]],
    'T': [[0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]],
    'Z': [[1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]]
}

const COLORS = {
    'I': '#31C7EF',
    'J': '#5A65AD',
    'L': '#EF7921',
    'O': '#F7D308',
    'S': '#42B642',
    'T': '#AD4D9C',
    'Z': '#EF2029',
}
