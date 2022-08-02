interface ExecuteType {
  steps: [number, AIStep][];
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
  toExecute: ExecuteType | null;
  private framesUntilNext: number;
  private board: Board;

  constructor(board: Board) {
    this.board = board;
    this.toExecute = null;

    this.framesUntilNext = CONFIG.aidelay;
  }

  aistep() {
    if (!CONFIG.aienabled) {
      return;
    }
    if (!this.toExecute) {
      this.toExecute = this.selectDest();
      displayScore(this.toExecute);
    }
    if (this.framesUntilNext-- > 0) {
      return;
    }
    this.framesUntilNext = CONFIG.aidelay;

    if (this.toExecute.steps.length === 0) {
      this.toExecute = null;
      return;
    }

    // only execute subsections <= current row position
    let nextStepNumber, nextStep;
    if (CONFIG.aidelay < 0) {
      [nextStepNumber, nextStep] = this.toExecute.steps.shift()!;
    } else {
      const curStepNumber = this.board.curTetromino.r;
      do {
        [nextStepNumber, nextStep] = this.toExecute.steps[0];
        if (nextStepNumber > curStepNumber) {
          return;  // don't do anything yet this turn
        } else {
          // execute this step; pop the first element
          this.toExecute.steps.shift();
        }
        if (this.toExecute.steps.length === 0) {
          break;  // nothing left to loop with, so stop
        }
        // take the next step if it was DOWN and we passed it already
      } while (nextStep === AIStep.DOWN && curStepNumber !== nextStepNumber);
    }

    switch (nextStep) {
      case AIStep.RIGHT:
        this.board.move(this.board.curTetromino, 0, 1);
        break;
      case AIStep.LEFT:
        this.board.move(this.board.curTetromino, 0, -1);
        break;
      case AIStep.DROP:
        this.board.moveDrop(this.board.curTetromino);
        break;
      case AIStep.CLOCKWISE:
        this.board.rotate(this.board.curTetromino, Rotation.CLOCKWISE);
        break;
      case AIStep.COUNTERCLOCKWISE:
        this.board.rotate(this.board.curTetromino, Rotation.COUNTERCLOCKWISE);
        break;
      case AIStep.DOWN:
        // only move down if it's in the position to do so
        if (this.board.curTetromino.r <= nextStepNumber) {
          this.board.move(this.board.curTetromino, 1, 0);
        }
        break;
      case AIStep.HOLD:
        this.board.hold();
        break;
    }

    if (this.toExecute !== null) {
      if (this.toExecute.steps.length === 0) {
        this.toExecute = null;
      }

      // Recurse to do all steps if aidelay = -1
      if (CONFIG.aidelay === -1) {
        this.aistep();
      }
    }
  }

  getbestlist() {
    // starting values of the current and next tetrominos
    const curTet = this.board.curTetromino.copy();
    let altTet: Tetromino, nextTet: Tetromino | undefined;
    if (this.board.heldTetromino != null) {
      altTet = this.board.heldTetromino.copy();
      nextTet = this.board.nextTetromino.copy();
    } else {
      altTet = this.board.nextTetromino.copy();
      nextTet = undefined;
    }
    // get all possible end positions
    let posList = this.bfsEndPositions(curTet.copy(), altTet.copy());

    // filter to only the top 25%
    let scoreList = posList.map(pos => this.getScore(pos));
    const sortedScoreList = scoreList.slice();
    sortedScoreList.sort((a, b) => b - a);
    let cutoff = sortedScoreList[Math.floor(scoreList.length / 4)];
    if (cutoff === sortedScoreList[0]) {
      cutoff -= 1;  // include the top score if necessary
    }
    posList = posList.filter((_pos, idx) => scoreList[idx] > cutoff);
    scoreList = scoreList.filter(score => score > cutoff);

    // bump previous; need to have a strict improvement to take the next
    scoreList = scoreList.map(score => score + CONFIG.aiturnimprovement);

    // get all possible end positions for the next turn, for each one of the previous
    const prevArr = this.board.arr.map(a => a.slice());
    const nextScores = posList.map(pos => {
      this.board.place(pos.tet);  // place the tetromino
      this.board.checkLineClears(false);
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
      // get all next end positions; no need to store the steps here
      const nextPosList = this.bfsEndPositions(nextStart, nextAlt, false);
      const nextScoreList = nextPosList.map(nextPos => this.getScore(nextPos));

      // restore the board
      this.board.arr = prevArr.map(a => a.slice());
      return Math.max(...nextScoreList);
    });

    const maxScore = Math.max(...nextScores, ...scoreList);
    return posList.filter((_pos, idx) => scoreList[idx] === maxScore || nextScores[idx] === maxScore);
  }

  selectDest() {
    const bestList = this.getbestlist();
    let toExecute: ExecuteType;
    if (bestList.length === 1) {
      toExecute = bestList[0];
    } else {
      // For now, randomly select out of best
      const randIndex = Math.floor(Math.random() * Math.floor(bestList.length));
      toExecute = bestList[randIndex];
    }

    return toExecute;
  }

  getPotential(tet: Tetromino): ExecuteType {
    const prevArr = this.board.arr.map(a => a.slice());
    const finalTet = this.board.getGhost(tet);
    this.board.place(finalTet);
    const curArr = this.board.arr.map(a => a.slice());
    this.board.arr = prevArr;
    return {
      steps: [],
      row: finalTet.r,
      col: finalTet.c,
      arr: curArr,
      tet: finalTet
    };
  }

  /**
   * Run BFS to find a list of all possible end positions,
   * with the shortest paths to get there.
   */
  bfsEndPositions(curTet: Tetromino, nextTet?: Tetromino, storeSteps: boolean = true): ExecuteType[] {
    const possibilities: ExecuteType[] = [];
    const visited = new Set<string>();
    const visited_dropped = new Set<string>();

    interface BFSState {
      cur: Tetromino;
      prevSteps: [number, AIStep][];
    }

    const queue: BFSState[] = [{ cur: curTet.copy(), prevSteps: [] }];

    // add alternate start
    if (nextTet !== undefined) {
      const holdSteps: [number, AIStep][] = [[-999, AIStep.HOLD]];
      queue.push({ cur: nextTet.copy(), prevSteps: storeSteps ? holdSteps : [] });
    }

    // breadth-first search for all possible end positions
    while (queue.length > 0) {
      const { cur, prevSteps } = queue.shift()!;

      // drop

      const dropped = this.board.getGhost(cur);
      if (!visited_dropped.has(dropped.toString()) && this.board.isValidMovement(dropped, 0, 0)) {
        // haven't already tried dropping the tetromino here
        visited_dropped.add(dropped.toString());

        // place on board and save steps
        const prevArr = this.board.arr.map(a => a.slice());
        this.board.place(dropped);
        const curArr = this.board.arr;
        this.board.arr = prevArr;

        let finalSteps: [number, AIStep][] = [];
        if (storeSteps) {
          finalSteps = prevSteps.slice();
          finalSteps.push([cur.r, AIStep.DROP]);
        }

        const potential: ExecuteType = {
          arr: curArr,
          row: dropped.r,
          col: dropped.c,
          steps: storeSteps ? finalSteps : [],
          tet: dropped
        };
        possibilities.push(potential);
      }

      // rotations

      const possibleRotations = [Rotation.CLOCKWISE, Rotation.COUNTERCLOCKWISE] as const;
      for (const rotation of possibleRotations) {
        const step = rotation === Rotation.CLOCKWISE ? AIStep.CLOCKWISE : AIStep.COUNTERCLOCKWISE;
        const rotateTet = cur.copy();
        const [validRotation, [dr, dc]] = this.board.isValidRotation(rotateTet, rotation);
        if (validRotation) {
          // valid rotation
          rotateTet.rotate(rotation);
          rotateTet.r += dr;
          rotateTet.c += dc;
          const next = rotateTet.copy();
          if (!visited.has(next.toString())) {
            if (storeSteps) {
              const nextSteps = prevSteps.slice();
              nextSteps.push([cur.r, step]);
              queue.push({ cur: next, prevSteps: nextSteps });
            } else {
              queue.push({ cur: next, prevSteps: [] });
            }
            visited.add(next.toString());
          }
        }
      }

      // movement

      if (this.board.isValidMovement(cur, 0, -1)) {
        // can move left
        const next = cur.copy();
        next.c -= 1;
        if (!visited.has(next.toString())) {
          if (storeSteps) {
            const nextSteps = prevSteps.slice();
            nextSteps.push([cur.r, AIStep.LEFT]);
            queue.push({ cur: next, prevSteps: nextSteps });
          } else {
            queue.push({ cur: next, prevSteps: [] });
          }
          visited.add(next.toString());
        }
      }
      if (this.board.isValidMovement(cur, 0, 1)) {
        // can move right
        const next = cur.copy();
        next.c += 1;
        if (!visited.has(next.toString())) {
          if (storeSteps) {
            const nextSteps = prevSteps.slice();
            nextSteps.push([cur.r, AIStep.RIGHT]);
            queue.push({ cur: next, prevSteps: nextSteps });
          } else {
            queue.push({ cur: next, prevSteps: [] });
          }
          visited.add(next.toString());
        }
      }

      if (this.board.isValidMovement(cur, 1, 0)) {
        // can move down
        const next = cur.copy();
        next.r += 1;
        if (!visited.has(next.toString())) {
          if (storeSteps) {
            const nextSteps = prevSteps.slice();
            nextSteps.push([cur.r, AIStep.DOWN]);
            queue.push({ cur: next, prevSteps: nextSteps });
          } else {
            queue.push({ cur: next, prevSteps: [] });
          }
          visited.add(next.toString());
        }
      }
    }

    return possibilities;
  }

  /**
   * Scores a potential end position
   */
  getScore(potential: ExecuteType) {
    let score = 0;
    const stats = this.getStatistics(potential);
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

  getStatistics(potential: ExecuteType) {
    const stats: StatisticsType = {} as StatisticsType;
    const potentialArr = potential.arr;
    // line clears
    stats.lineclears = 0;
    for (let r = 0; r < CONFIG.rows; r++) {
      if (!potentialArr[r].includes(0)) {
        stats.lineclears += 1;
      }
    }

    // make copy of array with lines cleared; use this for rest of stats
    const arr = potentialArr.map(row => row.slice());
    for (let r = 0; r < CONFIG.rows; r++) {
      if (!arr[r].includes(0)) {
        arr.splice(r, 1);
        arr.splice(0, 0, Array(CONFIG.cols).fill(0));
      }
    }

    // holes
    stats.totalholes = 0;
    stats.scaledholes = 0;
    for (let c = 0; c < CONFIG.cols; c++) {
      const firstTile = arr.findIndex(row => row[c] !== 0);
      if (firstTile === -1) {
        continue;
      }
      let numHoles = 0;
      for (let r = firstTile; r < CONFIG.rows; r++) {
        if (arr[r][c] === 0) {
          numHoles++;
          stats.totalholes++;
        }
      }
      stats.scaledholes += Math.pow(numHoles, CONFIG.exp_holes);
    }
    // board height
    const firstRowWithTile = arr.findIndex(row => !row.every(item => item === 0));
    stats.boardheight = CONFIG.rows - firstRowWithTile;
    stats.scaledboardheight = Math.pow(stats.boardheight, CONFIG.exp_boardheight);
    // placement height
    stats.placementheight = CONFIG.rows - potential.row;
    stats.scaledplacementheight = Math.pow(CONFIG.rows - potential.row, CONFIG.exp_placementheight);
    // height distribution
    const heights = [];
    for (let c = 0; c < CONFIG.cols; c++) {
      const ht = arr.findIndex(row => row[c] !== 0);
      if (ht === -1) {
        heights.push(0);
      } else {
        heights.push(CONFIG.rows - ht);
      }
    }
    let sumHeightDiffs = 0;
    for (let c = 1; c < CONFIG.cols; c++) {
      sumHeightDiffs += Math.abs(heights[c] - heights[c - 1]);
    }
    stats.avgheightdiff = sumHeightDiffs / (CONFIG.cols - 1);
    return stats;
  }
}

function displayScore(potential: ExecuteType) {
  const HTMLscore = document.getElementById("stats-current-score")!;
  const HTMLlineclears = document.getElementById("stats-line-clears")!;
  const HTMLlineclearscalc = document.getElementById("stats-line-clears-calc")!;
  const HTMLholes = document.getElementById("stats-holes")!;
  const HTMLholescalc = document.getElementById("stats-holes-calc")!;
  const HTMLboardheight = document.getElementById("stats-board-height")!;
  const HTMLboardheightcalc = document.getElementById("stats-board-height-calc")!;
  const HTMLplacementheight = document.getElementById("stats-placement-height")!;
  const HTMLplacementheightcalc = document.getElementById("stats-placement-height-calc")!;
  const HTMLavgheightdiff = document.getElementById("stats-avg-height-diff")!;
  const HTMLavgheightdiffcalc = document.getElementById("stats-avg-height-diff-calc")!;
  const score = ai.getScore(potential);
  const stats = ai.getStatistics(potential);
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
