enum Rotation {
  SPAWN = 0,
  CLOCKWISE = 1,
  FLIP = 2,
  COUNTERCLOCKWISE = 3
}

const rotateFromState = (state: Rotation, rotation: Rotation): Rotation => {
  return (state + rotation) % 4 as Rotation;
};

class Tetromino {
  kind: keyof typeof TetrominoType;
  rotation: Rotation;
  r: number;
  c: number;

  /**
   * Creates a tetromino object in arr coordinates
   * @param kind     Tetronimno name
   * @param r        Topleft row relative to arr
   * @param c        Topleft col relative to arr
   * @param rotation current rotation value relative to spawn
   */
  constructor(kind: keyof typeof TetrominoType, r: number, c: number, rotation: Rotation) {
    this.kind = kind;
    this.r = r;
    this.c = c;
    this.rotation = rotation;
  }

  draw(alpha?: number): void {
    this.drawat(this.r, this.c, 1, alpha);
  }

  drawat(r: number, c: number, scale: number, alpha?: number): void {
    const tetColor = TetrominoType[this.kind].color;
    stroke(CONFIG.tetromino_stroke);
    if (alpha) {
      const colorWithAlpha = color(tetColor);
      colorWithAlpha.setAlpha(alpha);
      fill(colorWithAlpha);
    } else {
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

  getShape(): number[][] {
    return this.getRotation(Rotation.SPAWN);
  }

  getRotation(direction: Rotation): number[][] {
    // copy shape
    const shape = TetrominoType[this.kind].shape as unknown as number[][];
    return this.getRotationFromShape(shape, rotateFromState(this.rotation, direction));
  }

  private getRotationFromShape(shape: number[][], direction: Rotation) {
    if (direction === Rotation.SPAWN) {
      return shape;
    }

    const newShape: number[][] = shape.map(row => row.slice());
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

  copy(): Tetromino {
    return new Tetromino(this.kind, this.r, this.c, this.rotation);
  }

  reset(): void {
    this.rotation = Rotation.SPAWN;
    this.r = -2;
    this.c = this.kind === "O" ? 4 : 3;
  }

  toString() {
    return `${this.kind}/${this.r}/${this.c}/${this.rotation}`;
  }

  rotate(direction: Rotation) {
    this.rotation = rotateFromState(this.rotation, direction);
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