import p5 from "p5";

import Tetromino from "./Tetromino";
import { CONFIG } from "./config";
import { Rotation, TETROMINO_TYPE, WALLKICK_TESTS, WALLKICK_TESTS_I } from "./TetrominoConstants";
import AI from "./AI";

export default class Board {
  public arr: (0 | p5.Color)[][];
  public ai: AI;
  curTetromino: Tetromino;
  gameOver: boolean;
  nextTetromino: Tetromino;
  heldTetromino: Tetromino | null;
  lineClears: number;

  private readonly _p: p5;
  private readonly x: number;
  private readonly y: number;
  private readonly w: number;
  private readonly h: number;
  private readonly tileSize: number;
  private curBag: Tetromino[] = [];
  private framesUntilDrop: number;
  private framesUntilLock: number | null;
  private hasHeld: boolean;

  constructor(p: p5, x: number, y: number, w: number, h: number) {
    this._p = p;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;

    this.tileSize = this.w / 10;

    this.arr = Array(CONFIG.rows).fill(0).map(() => Array(CONFIG.cols).fill(0));

    // Tetromino bag
    this.refillBag();

    this.curTetromino = this.curBag.pop()!;
    this.nextTetromino = this.curBag.pop()!;
    this.heldTetromino = null;

    this.framesUntilDrop = CONFIG.dropframes;
    this.framesUntilLock = -1;
    this.hasHeld = false;
    this.lineClears = 0;
    this.gameOver = false;

    this.ai = new AI(p, this);
  }

  refillBag(): void {
    this.curBag = [new Tetromino(this._p, "O", -2, 4, Rotation.SPAWN)];
    for (const kind of ["I", "J", "L", "S", "T", "Z"] as (keyof typeof TETROMINO_TYPE)[]) {
      this.curBag.push(new Tetromino(this._p, kind, -2, 3, Rotation.SPAWN));
    }
    this.curBag = this._p.shuffle(this.curBag);
  }

  draw(): void {
    this.drawBoard();

    if (CONFIG.aienabled && this.ai.toExecute) {
      const aitarget = this.ai.toExecute.tet;
      aitarget.draw(CONFIG.aitarget_alpha);
    } else if (!CONFIG.aienabled && CONFIG.showhint) {
      if (this.ai.toExecute == null) {
        this.ai.toExecute = this.ai.selectDest();
      }
      this.ai.toExecute.tet.draw(CONFIG.hint_alpha);
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
        } else if (this.framesUntilLock === 0) {
          this.placeCurTetromino();
          // reset timers
          this.framesUntilLock = null;
          this.framesUntilDrop = CONFIG.dropframes;
        }
      } else {
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
          } else {
            this.placeCurTetromino();
          }
        }
      }

      this.ai.aistep();
    }
  }

  drawBoard(): void {
    this._p.fill(230);
    this._p.noStroke();
    this._p.rect(this.x, this.y, this.w, this.h);

    this._p.noFill();
    this._p.stroke(190);
    for (let r = 0; r < CONFIG.rows; r++) {
      for (let c = 0; c < CONFIG.cols; c++) {
        const arrVal = this.arr[r][c];
        if (arrVal) {
          this._p.fill(arrVal);
        } else {
          this._p.noFill();
        }
        this._p.rect(this.x + this.tileSize * c, this.y + this.tileSize * r, this.tileSize, this.tileSize);
      }
    }

    this._p.noFill();
    this._p.stroke(0);
    this._p.strokeWeight(2);
    this._p.rect(this.x, this.y, this.w, this.h);
    this._p.strokeWeight(1);

    this._p.fill(230);
    this._p.stroke(0);
    this._p.strokeWeight(2);
    this._p.rect(this.x + this.w + CONFIG.tilesize * (1.5 - 0.25), this.y + CONFIG.tilesize, CONFIG.tilesize * 5 * 0.75, CONFIG.tilesize * 2.75);
    this._p.rect(this.x - CONFIG.tilesize * (1.5 + 5 * 0.75 - 0.25), this.y + CONFIG.tilesize, CONFIG.tilesize * 5 * 0.75, CONFIG.tilesize * 2.75);
    this._p.strokeWeight(1);
  }

  move(tetromino: Tetromino, dr: number, dc: number): void {
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

  moveDrop(tetromino: Tetromino): void {
    const ghostTet = this.getGhost(tetromino);
    this.curTetromino.r = ghostTet.r;
    this.placeCurTetromino();
  }

  /**
   * Rotate tetromino if valid
   */
  rotate(tetromino: Tetromino, direction: Rotation.CLOCKWISE | Rotation.COUNTERCLOCKWISE): void {
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

  hold(): void {
    if (this.hasHeld) {
      return;  // can't hold more than once
    }
    if (this.heldTetromino) {
      const heldtype = this.heldTetromino.kind;
      this.heldTetromino.kind = this.curTetromino.kind;
      this.heldTetromino.reset();
      this.curTetromino.kind = heldtype;
      this.curTetromino.reset();
    } else {
      this.heldTetromino = this.curTetromino;
      this.heldTetromino.reset();
      this.curTetromino = this.nextTetromino;
      this.nextTetromino = this.curBag.pop()!;
      if (!this.curBag.length) {
        this.refillBag();
      }
    }
    this.framesUntilDrop = 1;
    this.hasHeld = true;
  }

  isValidMovement(tetromino: Tetromino, dr: number, dc: number): boolean {
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
  isValidRotation(tetromino: Tetromino, rotation: Rotation.CLOCKWISE | Rotation.COUNTERCLOCKWISE): [boolean, [number, number]] {
    const shape = tetromino.getRotation(rotation);
    const row = tetromino.r;
    const col = tetromino.c;

    let tests: number[][];
    if (tetromino.kind === "I") {
      tests = WALLKICK_TESTS_I[tetromino.rotation][rotation];
    } else {
      tests = WALLKICK_TESTS[tetromino.rotation][rotation];
    }

    for (const [dr, dc] of tests) {
      if (this.isValid(row + dr, col + dc, shape)) {
        return [true, [dr, dc]];
      }
    }
    return [false, [0, 0]];
  }

  placeCurTetromino(): void {
    this.ai.toExecute = null;
    this.place(this.curTetromino);
    this.checkLineClears();
    this.curTetromino = this.nextTetromino;
    this.nextTetromino = this.curBag.pop()!;
    if (!this.curBag.length) {
      this.refillBag();
    }
    this.framesUntilDrop = 1;
    this.hasHeld = false;  // can hold again

    // Check validity of new tetromino/check for gameover
    if (this.getGhost(this.curTetromino).r === this.curTetromino.r) {
      this.gameOver = true;
    }
  }

  /**
   * Place on board, with no checks
   */
  place(tetromino: Tetromino): void {
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
          this.arr[tetromino.r + tet_r][tetromino.c + tet_c] = this._p.color(TETROMINO_TYPE[tetromino.kind].color);
        } else {
          throw Error(
            `Invalid tetromino (${tetromino.kind}) placement:`
            + `is ${this.arr[tetromino.r + tet_r][tetromino.c + tet_c]}`
            + `(${tetromino.r + tet_r}, ${tetromino.c + tet_c})`
          );
        }
      }
    }
  }

  checkLineClears(updateStat: boolean = true): void {
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

  getGhost(tetromino: Tetromino): Tetromino {
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
  private isValid(row: number, col: number, shape: number[][]): boolean {
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
        } else if (board_r < 0) {
          // do nothing
        } else if (this.arr[board_r][board_c]) {
          return false;
        }
      }
    }
    return true;
  }
}
