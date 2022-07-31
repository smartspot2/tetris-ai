enum Rotation {
  CLOCKWISE,
  COUNTERCLOCKWISE
}

class Tetromino {
  kind: keyof typeof TetrominoType;
  shape: number[][];
  r: number;
  c: number;

  /**
   * Creates a tetromino object in arr coordinates
   * @param kind Tetronimno name
   * @param r    Topleft row relative to arr
   * @param c    Topleft col relative to arr
   */
  constructor(kind: keyof typeof TetrominoType, r: number, c: number) {
    this.kind = kind;
    this.shape = TetrominoType[kind].shape as unknown as number[][];
    this.r = r;
    this.c = c;
  }

  draw(alpha?: number): void {
    this.drawat(this.r, this.c, 1, alpha);
  }

  drawat(r: number, c: number, scale: number, alpha?: number): void {
    let tetColor = TetrominoType[this.kind].color;
    stroke(CONFIG.tetromino_stroke);
    if (alpha) {
      const colorWithAlpha = color(tetColor);
      colorWithAlpha.setAlpha(alpha);
      fill(colorWithAlpha);
    } else {
      fill(tetColor);
    }
    if (scale === 0.75) {
      if (this.kind === "I") c -= 0.375;
      if (this.kind === "O") c += 0.375;
    }
    for (let shape_r = 0; shape_r < this.shape.length; shape_r++) {
      for (let shape_c = 0; shape_c < this.shape[shape_r].length; shape_c++) {
        if (this.shape[shape_r][shape_c] && r + shape_r >= 0) {
          rect(CONFIG.board_tl.x + CONFIG.tilesize * c + CONFIG.tilesize * shape_c * scale,
            CONFIG.board_tl.y + CONFIG.tilesize * r + CONFIG.tilesize * shape_r * scale,
            CONFIG.tilesize * scale, CONFIG.tilesize * scale);
        }
      }
    }
  }

  moveDown(): void {
    this.r += 1;
  }

  getRotation(direction: Rotation): number[][] {
    let newshape: number[][] = Array(this.shape.length).fill(0).map(() => Array(this.shape[0].length).fill(0));
    for (let r = 0; r < this.shape.length; r++) {
      for (let c = 0; c < this.shape[r].length; c++) {
        if (direction === Rotation.COUNTERCLOCKWISE) {
          newshape[r][c] = this.shape[c][this.shape[r].length - r - 1];
        } else if (direction === Rotation.CLOCKWISE) {
          newshape[r][c] = this.shape[this.shape.length - c - 1][r];
        }
      }
    }
    return newshape;
  }

  copy(): Tetromino {
    let tetcopy = new Tetromino(this.kind, this.r, this.c);
    tetcopy.shape = this.shape;
    return tetcopy;
  }

  reset(): void {
    this.shape = TetrominoType[this.kind].shape as unknown as number[][];
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
} as const;