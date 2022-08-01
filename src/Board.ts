class Board {
  public arr: (0 | p5.Color)[][];
  curTetromino: Tetromino;
  gameOver: boolean;
  nextTetromino: Tetromino;
  heldTetromino: Tetromino | null;
  lineClears: number;
  private readonly x: number;
  private readonly y: number;
  private readonly w: number;
  private readonly h: number;
  private readonly tileSize: number;
  private curBag: Tetromino[] = [];
  private framesUntilDrop: number;
  private hasHeld: boolean;

  constructor(x: number, y: number, w: number, h: number) {
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
    this.hasHeld = false;
    this.lineClears = 0;
    this.gameOver = false;
  }

  refillBag(): void {
    this.curBag = [new Tetromino("O", -2, 4, Rotation.SPAWN)];
    for (const kind of ["I", "J", "L", "S", "T", "Z"] as (keyof typeof TetrominoType)[]) {
      this.curBag.push(new Tetromino(kind, -2, 3, Rotation.SPAWN));
    }
    this.curBag = shuffle(this.curBag);
  }

  draw(): void {
    this.drawBoard();

    if (CONFIG.aienabled && ai.toExecute) {
      const aitarget = ai.toExecute.tet;
      aitarget.draw(CONFIG.aitarget_alpha);
    } else if (!CONFIG.aienabled && CONFIG.showhint) {
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

      if (!this.framesUntilDrop--) {
        this.framesUntilDrop = CONFIG.dropframes;

        if (this.isValid(this.curTetromino, 1, 0)) {
          this.curTetromino.moveDown();
        } else {
          this.placeCurTetromino();
        }
      }
      ai.aistep();
    }
  }

  drawBoard(): void {
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
        } else {
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

  move(tetromino: Tetromino, dr: number, dc: number): void {
    if (this.isValid(tetromino, dr, dc)) {
      tetromino.r += dr;
      tetromino.c += dc;
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
  rotate(tetromino: Tetromino, direction: Rotation): void {
    const origRotation = tetromino.rotation;
    tetromino.rotate(direction);
    if (!this.isValid(tetromino, 0, 0)) {
      tetromino.rotation = origRotation;
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

  isValid(tetromino: Tetromino, dr: number, dc: number): boolean {
    const shape = tetromino.getShape();
    for (let tet_r = 0; tet_r < shape.length; tet_r++) {
      for (let tet_c = 0; tet_c < shape[tet_r].length; tet_c++) {
        if (!shape[tet_r][tet_c]) {
          continue;
        }
        const board_r = tetromino.r + tet_r + dr;
        const board_c = tetromino.c + tet_c + dc;
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

  placeCurTetromino(): void {
    ai.toExecute = null;
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
          this.arr[tetromino.r + tet_r][tetromino.c + tet_c] = color(TetrominoType[tetromino.kind].color);
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
    while (tetromino.r + dr < this.arr.length && this.isValid(tetromino, dr, 0)) {
      dr++;
    }
    const tetCopy = tetromino.copy();
    tetCopy.r += dr - 1;
    return tetCopy;
  }
}
