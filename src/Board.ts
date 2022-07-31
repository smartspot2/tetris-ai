class Board {
  public arr: (0 | p5.Color)[][];
  curtetromino: Tetromino;
  gameover: boolean;
  nexttetromino: Tetromino;
  heldtetromino: Tetromino | null;
  lineclears: number;
  private readonly x: number;
  private readonly y: number;
  private readonly w: number;
  private readonly h: number;
  private readonly tilesize: number;
  private curbag: Tetromino[] = [];
  private framesUntilDrop: number;
  private hasheld: boolean;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;

    this.tilesize = this.w / 10;

    this.arr = Array(CONFIG.rows).fill(0).map(() => Array(CONFIG.cols).fill(0));

    // Tetromino bag
    this.refillBag();

    this.curtetromino = this.curbag.pop()!;
    this.nexttetromino = this.curbag.pop()!;
    this.heldtetromino = null;

    this.framesUntilDrop = CONFIG.dropframes;
    this.hasheld = false;
    this.lineclears = 0;
    this.gameover = false;
  }

  refillBag(): void {
    this.curbag = [new Tetromino("O", -2, 4, Rotation.SPAWN)];
    for (let kind of ["I", "J", "L", "S", "T", "Z"] as (keyof typeof TetrominoType)[]) {
      this.curbag.push(new Tetromino(kind, -2, 3, Rotation.SPAWN));
    }
    this.curbag = shuffle(this.curbag);
  }

  draw(): void {
    this.drawBoard();

    if (CONFIG.aienabled && ai.toexecute) {
      let aitarget = ai.toexecute.tet;
      aitarget.draw(CONFIG.aitarget_alpha);
    } else if (!CONFIG.aienabled && CONFIG.showhint) {
      if (ai.toexecute == null) {
        ai.toexecute = ai.selectdest();
      }
      ai.toexecute.tet.draw(CONFIG.hint_alpha);
    }

    this.curtetromino.draw();
    this.nexttetromino.drawat(1.5, CONFIG.cols + 2, 0.75);
    if (this.heldtetromino) {
      this.heldtetromino.drawat(1.5, -2 - 3 * 0.75, 0.75);
    }

    if (!this.gameover) {
      this.getGhost(this.curtetromino).draw(CONFIG.ghost_alpha);

      if (!this.framesUntilDrop--) {
        this.framesUntilDrop = CONFIG.dropframes;

        if (this.isValid(this.curtetromino, 1, 0)) {
          this.curtetromino.moveDown();
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

  move(tetromino: Tetromino, dr: number, dc: number): void {
    if (this.isValid(tetromino, dr, dc)) {
      tetromino.r += dr;
      tetromino.c += dc;
    }
  }

  moveDrop(tetromino: Tetromino): void {
    let ghosttet = this.getGhost(tetromino);
    this.curtetromino.r = ghosttet.r;
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
    if (this.hasheld) return;  // can't hold more than once
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
      this.nexttetromino = this.curbag.pop()!;
      if (!this.curbag.length) {
        this.refillBag();
      }
    }
    this.framesUntilDrop = 1;
    this.hasheld = true;
  }

  isValid(tetromino: Tetromino, dr: number, dc: number): boolean {
    const shape = tetromino.getShape();
    for (let tet_r = 0; tet_r < shape.length; tet_r++) {
      for (let tet_c = 0; tet_c < shape[tet_r].length; tet_c++) {
        if (!shape[tet_r][tet_c]) continue;
        let board_r = tetromino.r + tet_r + dr;
        let board_c = tetromino.c + tet_c + dc;
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

  placeCurTetromino(): void {
    ai.toexecute = null;
    this.place(this.curtetromino);
    this.checklineclears();
    this.curtetromino = this.nexttetromino;
    this.nexttetromino = this.curbag.pop()!;
    if (!this.curbag.length) {
      this.refillBag();
    }
    this.framesUntilDrop = 1;
    this.hasheld = false;  // can hold again

    // Check validity of new tetromino/check for gameover
    if (this.getGhost(this.curtetromino).r === this.curtetromino.r) {
      this.gameover = true;
    }
  }

  /**
   * Place on board, with no checks
   */
  place(tetromino: Tetromino): void {
    const shape = tetromino.getShape();
    for (let tet_r = 0; tet_r < shape.length; tet_r++) {
      for (let tet_c = 0; tet_c < shape[tet_r].length; tet_c++) {
        if (!shape[tet_r][tet_c]) continue;
        if (tetromino.r + tet_r >= CONFIG.rows || tetromino.r + tet_r < 0 ||
          tetromino.c + tet_c < 0 || tetromino.c + tet_c >= CONFIG.cols) continue;

        if (this.arr[tetromino.r + tet_r][tetromino.c + tet_c] === 0) {
          this.arr[tetromino.r + tet_r][tetromino.c + tet_c] = color(TetrominoType[tetromino.kind].color);
        } else {
          throw Error(`Invalid tetromino (${tetromino.kind}) placement: is ${this.arr[tetromino.r + tet_r][tetromino.c + tet_c]} (${tetromino.r + tet_r}, ${tetromino.c + tet_c})`);
        }
      }
    }
  }

  checklineclears(updateStat: boolean = true): void {
    for (let r = 0; r < CONFIG.rows; r++) {
      if (!this.arr[r].includes(0)) {
        if (updateStat) {
          this.lineclears += 1;
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
    let tetcopy = tetromino.copy();
    tetcopy.r += dr - 1;
    return tetcopy;
  }
}
