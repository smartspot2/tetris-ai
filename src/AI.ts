interface ExecuteType {
  steps: Map<number, AIStep[]>;
  tet: Tetromino;
  row: number;
  col: number;
  arr: (0 | p5.Color)[][];
}

interface StatisticsType {
  lineclears: number;
  totalholes: number;
  scaledholes: number;
  boardheight: number;
  scaledboardheight: number;
  placementheight: number;
  scaledplacementheight: number;
  avgheightdiff: number;
}

enum AIStep {
  RIGHT = "R",
  LEFT = "L",
  DROP = "D",
  CLOCKWISE = "C",
  COUNTERCLOCKWISE = "c",
  HOLD = "H",
  DOWN = "d"  // either press down, or wait for the tetromino to drop by one
}

class AI {
  toexecute: ExecuteType | null;
  private framesuntilnext: number;
  private board: Board;

  constructor(board: Board) {
    this.board = board;
    this.toexecute = null;

    this.framesuntilnext = CONFIG.aidelay;
  }

  getHint() {
    return this.selectdest().tet;
  }

  aistep() {
    if (!CONFIG.aienabled) {
      return;
    }
    if (!this.toexecute) {
      this.toexecute = this.selectdest();
      displayScore(this.toexecute);
    }
    if (this.framesuntilnext-- > 0) {
      return;
    }
    this.framesuntilnext = CONFIG.aidelay;

    // only execute subsections <= current row position
    let curstepnumber = (CONFIG.aidelay < 0) ? 99 : this.board.curtetromino.r;
    let nextstep = null;
    let nextstepnumber = 99;
    for (let [idx, step] of this.toexecute.steps.entries()) {
      // get earliest
      if (step.length > 0 && idx <= curstepnumber && idx <= nextstepnumber) {
        nextstep = step;
        nextstepnumber = idx;
      }
    }
    if (nextstep == null || nextstepnumber == 99) return;
    let cmd = nextstep.shift();
    switch (cmd) {
      case AIStep.RIGHT:
        this.board.move(this.board.curtetromino, 0, 1);
        break;
      case AIStep.LEFT:
        this.board.move(this.board.curtetromino, 0, -1);
        break;
      case AIStep.DROP:
        this.board.moveDrop(this.board.curtetromino);
        break;
      case AIStep.CLOCKWISE:
        this.board.rotate(this.board.curtetromino, Rotation.CLOCKWISE);
        break;
      case AIStep.COUNTERCLOCKWISE:
        this.board.rotate(this.board.curtetromino, Rotation.COUNTERCLOCKWISE);
        break;
      case AIStep.DOWN:
        // only move down if it's in the position to do so
        if (this.board.curtetromino.r <= nextstepnumber) {
          this.board.move(this.board.curtetromino, 1, 0);
        }
        break;
      case AIStep.HOLD:
        this.board.hold();
        break;
    }

    if (this.toexecute !== null) {
      if (nextstep.length === 0) {
        this.toexecute.steps.delete(nextstepnumber);
      }
      if (this.toexecute.steps.size === 0) {
        this.toexecute = null;
      }

      // Recurse to do all steps if aidelay = -1
      if (CONFIG.aidelay === -1) this.aistep();
    }
  }

  getbestlist() {
    // starting values of the current and next tetrominos
    const curTet = this.board.curtetromino.copy();
    let altTet: Tetromino, nextTet: Tetromino | undefined;
    if (this.board.heldtetromino != null) {
      altTet = this.board.heldtetromino.copy();
      nextTet = this.board.nexttetromino.copy();
    } else {
      altTet = this.board.nexttetromino.copy();
      nextTet = undefined;
    }
    // get all possible end positions
    let poslist = this.bfsendpositions(curTet.copy(), altTet.copy());

    // filter to only the top 25%
    let scorelist = poslist.map(pos => this.getscore(pos));
    let sortedScoreList = scorelist.slice();
    sortedScoreList.sort((a, b) => b - a);
    let cutoff = sortedScoreList[Math.floor(scorelist.length / 4)];
    if (cutoff == sortedScoreList[0]) {
      cutoff -= 1;  // include the top score if necessary
    }
    poslist = poslist.filter((_pos, idx) => scorelist[idx] > cutoff);
    scorelist = scorelist.filter(score => score > cutoff);

    // bump previous; need to have a strict improvement to take the next
    scorelist = scorelist.map(score => score + CONFIG.aiturnimprovement);

    // get all possible end positions for the next turn, for each one of the previous
    const prevArr = this.board.arr.map(a => a.slice());
    const nextScores = poslist.map(pos => {
      this.board.place(pos.tet);  // place the tetromino
      this.board.checklineclears(false);
      let nextStart: Tetromino, nextAlt: Tetromino | undefined;
      if (nextTet === undefined) {
        nextStart = pos.tet.kind === curTet.kind ? altTet.copy() : curTet.copy();
        nextAlt = undefined;
      } else if (pos.tet.kind === curTet.kind) {
        nextStart = nextTet.copy();
        nextAlt = altTet.copy();
      } else {
        nextStart = altTet.copy();
        nextAlt = nextTet.copy();
      }
      const nextPosList = this.bfsendpositions(nextStart, nextAlt);  // get all next end positions
      const nextScoreList = nextPosList.map(nextPos => this.getscore(nextPos));

      // restore the board
      this.board.arr = prevArr.map(a => a.slice());
      return Math.max(...nextScoreList);
    });

    const maxScore = Math.max(...nextScores, ...scorelist);
    return poslist.filter((_pos, idx) => scorelist[idx] === maxScore || nextScores[idx] === maxScore);
  }

  selectdest() {
    let bestlist = this.getbestlist();
    let toexecute: ExecuteType;
    if (bestlist.length === 1) {
      toexecute = bestlist[0];
    } else {
      // For now, randomly select out of best
      let randindex = Math.floor(Math.random() * Math.floor(bestlist.length));
      toexecute = bestlist[randindex];
    }

    return toexecute;
  }

  getpotential(tet: Tetromino): ExecuteType {
    let prevarr = this.board.arr.map(a => a.slice());
    let finaltet = this.board.getGhost(tet);
    this.board.place(finaltet);
    let curarr = this.board.arr.map(a => a.slice());
    this.board.arr = prevarr;
    return {
      steps: new Map(),
      row: finaltet.r,
      col: finaltet.c,
      arr: curarr,
      tet: finaltet
    };
  }

  /**
   * Run BFS to find a list of all possible end positions,
   * with the shortest paths to get there.
   */
  bfsendpositions(curTet: Tetromino, nextTet?: Tetromino): ExecuteType[] {
    const possibilities: ExecuteType[] = [];
    const visited = new Set<string>();
    const visited_dropped = new Set<string>();

    const cloneSteps = (steps: Map<number, AIStep[]>): Map<number, AIStep[]> => {
      const cloned = new Map<number, AIStep[]>();
      steps.forEach((lst, idx) => {
        cloned.set(idx, lst.slice());
      });
      return cloned;
    };

    const pushStep = (steps: Map<number, AIStep[]>, row: number, step: AIStep) => {
      if (steps.has(row)) {
        steps.get(row)?.push(step);
      } else {
        steps.set(row, [step]);
      }
    };

    interface BFSState {
      cur: Tetromino;
      prevSteps: Map<number, AIStep[]>;
    }

    const queue: BFSState[] = [{ cur: curTet.copy(), prevSteps: new Map() }];

    // add alternate start
    if (nextTet != undefined) {
      const holdSteps = new Map();
      holdSteps.set(-999, [AIStep.HOLD]);
      queue.push({ cur: nextTet.copy(), prevSteps: holdSteps });
    }

    // breadth-first search for all possible end positions
    while (queue.length > 0) {
      const { cur, prevSteps } = queue.shift()!;

      // drop

      const dropped = this.board.getGhost(cur);
      if (!visited_dropped.has(dropped.toString()) && this.board.isValid(dropped, 0, 0)) {
        // haven't already tried dropping the tetromino here
        const finalSteps = cloneSteps(prevSteps);
        pushStep(finalSteps, cur.r, AIStep.DROP);
        visited_dropped.add(dropped.toString());
        // visited.set(dropped.toString(), countSteps(finalSteps));

        // place on board and save steps
        const prevArr = this.board.arr.map(a => a.slice());
        this.board.place(dropped);
        const curArr = this.board.arr;
        this.board.arr = prevArr;

        const potential: ExecuteType = {
          arr: curArr,
          row: dropped.r,
          col: dropped.c,
          steps: finalSteps,
          tet: dropped
        };
        possibilities.push(potential);
      }

      // rotations

      for (let rotation of [Rotation.CLOCKWISE, Rotation.COUNTERCLOCKWISE]) {
        const step = rotation === Rotation.CLOCKWISE ? AIStep.CLOCKWISE : AIStep.COUNTERCLOCKWISE;
        const rotateTet = cur.copy();
        rotateTet.rotate(rotation);
        if (this.board.isValid(rotateTet, 0, 0)) {
          // valid rotation
          let next = rotateTet.copy();
          if (!visited.has(next.toString())) {
            let nextSteps = cloneSteps(prevSteps);
            pushStep(nextSteps, cur.r, step);
            queue.push({ cur: next, prevSteps: nextSteps });
            visited.add(next.toString());
          }

          // attempt to rotate again
          rotateTet.rotate(rotation);
          if (this.board.isValid(rotateTet, 0, 0)) {
            // valid rotation
            next = rotateTet.copy();
            if (!visited.has(next.toString())) {
              let nextSteps = cloneSteps(prevSteps);
              pushStep(nextSteps, cur.r, step);
              pushStep(nextSteps, cur.r, step);
              queue.push({ cur: next, prevSteps: nextSteps });
              visited.add(next.toString());
            }
          }
        }
      }

      // movement

      if (this.board.isValid(cur, 0, -1)) {
        // can move left
        const next = cur.copy();
        next.c -= 1;
        if (!visited.has(next.toString())) {
          const nextSteps = cloneSteps(prevSteps);
          pushStep(nextSteps, cur.r, AIStep.LEFT);
          queue.push({ cur: next, prevSteps: nextSteps });
          visited.add(next.toString());
        }
      }
      if (this.board.isValid(cur, 0, 1)) {
        // can move right
        const next = cur.copy();
        next.c += 1;
        if (!visited.has(next.toString())) {
          const nextSteps = cloneSteps(prevSteps);
          pushStep(nextSteps, cur.r, AIStep.RIGHT);
          queue.push({ cur: next, prevSteps: nextSteps });
          visited.add(next.toString());
        }
      }

      if (this.board.isValid(cur, 1, 0)) {
        // can move down
        const next = cur.copy();
        next.r += 1;
        if (!visited.has(next.toString())) {
          const nextSteps = cloneSteps(prevSteps);
          pushStep(nextSteps, cur.r, AIStep.DOWN);
          queue.push({ cur: next, prevSteps: nextSteps });
          visited.add(next.toString());
        }
      }
    }

    return possibilities;
  }

  /**
   * Scores a potential end position
   */
  getscore(potential: ExecuteType) {
    let score = 0;
    let stats = this.getstatistics(potential);
    // check line clears
    score += CONFIG.weight_lineclears * stats.lineclears;
    // penalize holes
    if (CONFIG.scaled_holes) {
      score -= CONFIG.weight_holes * stats.scaledholes;
    } else {
      score -= CONFIG.weight_holes * stats.totalholes;
    }
    // penalize height
    if (CONFIG.scaled_boardheight) {
      score -= CONFIG.weight_boardheight * stats.scaledboardheight;
    } else {
      score -= CONFIG.weight_boardheight * stats.boardheight;
    }
    // penalize placement height
    if (CONFIG.scaled_placementheight) {
      score -= CONFIG.weight_placementheight * stats.scaledplacementheight;
    } else {
      score -= CONFIG.weight_placementheight * stats.placementheight;
    }
    // penalize wells
    score -= CONFIG.weight_avgheightdiff * stats.avgheightdiff;
    return score;
  }

  getstatistics(potential: ExecuteType) {
    let stats: StatisticsType = {} as StatisticsType;
    let arr = potential.arr;
    // line clears
    stats.lineclears = 0;
    for (let r = 0; r < CONFIG.rows; r++) {
      if (!arr[r].includes(0)) {
        stats.lineclears += 1;
      }
    }
    // holes
    stats.totalholes = stats.scaledholes = 0;
    for (let c = 0; c < CONFIG.cols; c++) {
      let firsttile = arr.findIndex(row => row[c] !== 0);
      if (firsttile === -1) continue;
      let numholes = 0;
      for (let r = firsttile; r < CONFIG.rows; r++) {
        if (arr[r][c] === 0) {
          numholes++;
          stats.totalholes++;
        }
      }
      stats.scaledholes += Math.pow(numholes, CONFIG.exp_holes);
    }
    // board height
    let firstrowwithtile = arr.findIndex(row => !row.every(item => item === 0));
    stats.boardheight = CONFIG.rows - firstrowwithtile;
    stats.scaledboardheight = Math.pow(stats.boardheight, CONFIG.exp_boardheight);
    // placement height
    stats.placementheight = CONFIG.rows - potential.row;
    stats.scaledplacementheight = Math.pow(CONFIG.rows - potential.row, CONFIG.exp_placementheight);
    // height distribution
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
    stats.avgheightdiff = sumheightdiffs / (CONFIG.cols - 1);
    return stats;
  }
}

function displayScore(potential: ExecuteType) {
  let HTMLscore = document.getElementById("stats-current-score")!;
  let HTMLlineclears = document.getElementById("stats-line-clears")!;
  let HTMLlineclearscalc = document.getElementById("stats-line-clears-calc")!;
  let HTMLholes = document.getElementById("stats-holes")!;
  let HTMLholescalc = document.getElementById("stats-holes-calc")!;
  let HTMLboardheight = document.getElementById("stats-board-height")!;
  let HTMLboardheightcalc = document.getElementById("stats-board-height-calc")!;
  let HTMLplacementheight = document.getElementById("stats-placement-height")!;
  let HTMLplacementheightcalc = document.getElementById("stats-placement-height-calc")!;
  let HTMLavgheightdiff = document.getElementById("stats-avg-height-diff")!;
  let HTMLavgheightdiffcalc = document.getElementById("stats-avg-height-diff-calc")!;
  let score = ai.getscore(potential);
  let stats = ai.getstatistics(potential);
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
  HTMLavgheightdiffcalc.innerHTML = String(
    Math.round(-CONFIG.weight_avgheightdiff * stats.avgheightdiff * 100) / 100);
}
