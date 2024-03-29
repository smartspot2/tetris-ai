import { Rotation, TETROMINO_TYPE } from "./TetrominoConstants";
import { CONFIG } from "./config";
import p5 from "p5";
import Board from "./Board";

const rotateFromState = (state: Rotation, rotation: Rotation): Rotation => {
  return (state + rotation) % 4 as Rotation;
};

export default class Tetromino {
  private readonly _p: p5;
  kind: keyof typeof TETROMINO_TYPE;
  rotation: Rotation;
  r: number;
  c: number;

  /**
   * Creates a tetromino object in arr coordinates
   * @param p        p5js instance
   * @param kind     Tetronimno name
   * @param r        Topleft row relative to arr
   * @param c        Topleft col relative to arr
   * @param rotation current rotation value relative to spawn
   */
  constructor(p: p5, kind: keyof typeof TETROMINO_TYPE, r: number, c: number, rotation: Rotation) {
    this._p = p;
    this.kind = kind;
    this.r = r;
    this.c = c;
    this.rotation = rotation;
  }

  draw(alpha?: number): void {
    this.drawat(this.r, this.c, 1, alpha);
  }

  drawat(r: number, c: number, scale: number, alpha?: number): void {
    const tetColor = TETROMINO_TYPE[this.kind].color;
    this._p.stroke(CONFIG.tetromino_stroke);
    if (alpha) {
      const colorWithAlpha = this._p.color(tetColor);
      colorWithAlpha.setAlpha(alpha);
      this._p.fill(colorWithAlpha);
    } else {
      this._p.fill(tetColor);
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
          this._p.rect(CONFIG.board_tl.x + CONFIG.tilesize * c + CONFIG.tilesize * shape_c * scale,
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
    const shape = TETROMINO_TYPE[this.kind].shape as unknown as number[][];
    return this.getRotationFromShape(shape, rotateFromState(this.rotation, direction));
  }

  copy(): Tetromino {
    return new Tetromino(this._p, this.kind, this.r, this.c, this.rotation);
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

  /**
   * Rotates this tetromino in the given direction if it is valid.
   *
   * @param board     reference to the board to determine validity
   * @param direction direction to rotate in
   * @return whether the rotation is valid (i.e. whether the rotation was performed)
   */
  rotateValid(board: Board, direction: Rotation.CLOCKWISE | Rotation.COUNTERCLOCKWISE): boolean {
    const [isValid, [dr, dc]] = board.isValidRotation(this, direction);
    if (isValid) {
      this.rotate(direction);
      this.r += dr;
      this.c += dc;
    }
    return isValid;
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
}
