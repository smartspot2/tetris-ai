import Board from "./Board";
import { CONFIG } from "./config";
import Tetromino from "./Tetromino";
import { Rotation, TETROMINO_TYPE } from "./TetrominoConstants";

import Parallel from "paralleljs";
import p5 from "p5";

interface Step {
  step: AIStep;
  stepNumber: number;
}

interface ExecuteType {
  steps: Step[];
  tet: Tetromino;
  row: number;
  col: number;
  arr: (0 | p5.Color)[][];
}

type ParallelExecuteType = Omit<ExecuteType, "tet"> & {
  tet: {
    kind: keyof typeof TETROMINO_TYPE,
    rotation: Rotation
  };
}

interface StatisticsType {
  lineClears: number;
  totalHoles: number;
  scaledHoles: number;
  boardHeight: number;
  scaledBoardHeight: number;
  placementHeight: number;
  scaledPlacementHeight: number;
  avgHeightDiff: number;
  rowFlips: number;
  colFlips: number;
  deepestWell: number;
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

export default class AI {
  toExecute: ExecuteType | null;
  private readonly _p: p5;
  private framesUntilNext: number;
  private readonly board: Board;

  constructor(p: p5, board: Board) {
    this._p = p;
    this.board = board;
    this.toExecute = null;

    this.framesUntilNext = CONFIG.aiDelay;
  }

  aistep() {
    if (!CONFIG.aiEnabled) {
      return;
    }
    if (!this.toExecute) {
      this.framesUntilNext = CONFIG.aiDelay;
      this.toExecute = this.selectDest(this.board.framesUntilDrop);
      this.displayScore(this.toExecute);
    }
    if (this.framesUntilNext > 0) {
      this.framesUntilNext--;
      return;
    }
    this.framesUntilNext = CONFIG.aiDelay;

    if (this.toExecute.steps.length === 0) {
      this.toExecute = null;
      return;
    }

    // only execute subsections <= current row position
    let nextStepNumber, nextStep;
    const curStepNumber = this.board.curTetromino.r;
    if (CONFIG.aiDelay < 0) {
      ({ step: nextStep, stepNumber: nextStepNumber } = this.toExecute.steps.shift()!);
    } else {
      do {
        ({ step: nextStep, stepNumber: nextStepNumber } = this.toExecute.steps[0]);
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

      // Recurse to do all steps if aiDelay = -1
      if (CONFIG.aiDelay === -1) {
        this.aistep();
      }
    }
  }

  getbestlist(initialDropFrames: number) {
    // starting values of the current and next tetrominos
    const curTet = this.board.curTetromino.copy();
    let altTet: Tetromino;
    let nextTet: Tetromino | undefined;
    if (this.board.heldTetromino != null) {
      altTet = this.board.heldTetromino.copy();
      nextTet = this.board.nextTetromino.copy();
    } else {
      altTet = this.board.nextTetromino.copy();
    }
    // get all possible end positions
    let posList = this.bfsEndPositions(curTet.copy(), altTet.copy(), initialDropFrames);

    // filter to only consider the best options
    let scoreList = posList.map(pos => this.getScore(pos));
    const sortedScoreList = scoreList.slice();
    sortedScoreList.sort((a, b) => b - a);
    // we can afford to go through more if we parallelize
    const percentile = CONFIG.aiParallel ? Math.floor(scoreList.length / 2) : Math.floor(scoreList.length / 4);
    let cutoff = sortedScoreList[percentile];
    if (cutoff === sortedScoreList[0]) {
      cutoff -= 1;  // include the top score if necessary
    }
    posList = posList.filter((_pos, idx) => scoreList[idx] > cutoff);
    scoreList = scoreList.filter(score => score > cutoff);

    // bump current state; need to have a strict improvement to take the next
    scoreList = scoreList.map(score => score + CONFIG.aiturnimprovement);

    // get all possible end positions for the next turn, for each one of the previous
    const prevArr = this.board.arr.map(a => a.slice());
    const processPos = (pos: ExecuteType) => {
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
      const nextPosList = this.bfsEndPositions(nextStart, nextAlt, CONFIG.dropFrames, false);
      const nextScoreList = nextPosList.map(nextPos => this.getScore(nextPos));

      // restore the board
      this.board.arr = prevArr.map(a => a.slice());
      return Math.max(...nextScoreList);
    };

    let nextScores: number[] = [];
    if (CONFIG.aiParallel) {
      // convert to a serializable type, and the tetromino can be recreated in the parallel function
      const p = new Parallel(posList.map<ParallelExecuteType>(pos => ({
        steps: pos.steps,
        arr: pos.arr,
        tet: {
          kind: pos.tet.kind,
          rotation: pos.tet.rotation
        },
        row: pos.row,
        col: pos.col
      })));

      p.map<any>((parallel_pos: ParallelExecuteType) => {
        // rebuild the execution type
        const pos: ExecuteType = {
          steps: parallel_pos.steps,
          arr: parallel_pos.arr,
          tet: new Tetromino(this._p, parallel_pos.tet.kind, parallel_pos.row, parallel_pos.col, parallel_pos.tet.rotation),
          row: parallel_pos.row,
          col: parallel_pos.col
        };
        return processPos(pos);
      }).then((arr: any[]) => {
        nextScores = arr;
      });
    } else {
      nextScores = posList.map(processPos);
    }

    const maxScore = Math.max(...nextScores, ...scoreList);
    return posList.filter((_pos, idx) => scoreList[idx] === maxScore || nextScores[idx] === maxScore);
  }

  /**
   * Select the best destination, and return instructions to get to the destination.
   *
   * @param initialDropFrames frames left until the current piece drops
   */
  selectDest(initialDropFrames: number): ExecuteType {
    const bestList = this.getbestlist(initialDropFrames);
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
  bfsEndPositions(curTet: Tetromino, nextTet: Tetromino | undefined, initialDropFrames: number, storeSteps: boolean = true): ExecuteType[] {
    const possibilities: ExecuteType[] = [];
    const visited = new Set<string>();
    const visited_dropped = new Set<string>();

    interface BFSState {
      cur: Tetromino;
      prevSteps: Step[];
      dropFrames: number;  // # frames until gravity applies
      lockFrames: number | null;  // # frames until the piece is locked
    }

    const queue: BFSState[] = [{ cur: curTet.copy(), prevSteps: [], dropFrames: initialDropFrames, lockFrames: null }];

    // add alternate start
    if (nextTet !== undefined) {
      const holdSteps: Step[] = [{ stepNumber: -999, step: AIStep.HOLD }];
      queue.push({
        cur: nextTet.copy(),
        prevSteps: storeSteps ? holdSteps : [],
        dropFrames: 0,
        lockFrames: null
      });
    }

    // special first turn ai delay, starting from the current ai delay
    // -1 because we want to count the current frame as well
    let curAIDelay = this.framesUntilNext - 1;

    // breadth-first search for all possible end positions
    while (queue.length > 0) {
      const queueItem = queue.shift();
      let cur = queueItem.cur;
      const prevSteps = queueItem.prevSteps;
      let nextDropFrames = queueItem.dropFrames;
      let nextLockFrames = queueItem.lockFrames;

      /* ----- apply gravity ----- */

      let mustDrop = false;

      // check lock state
      const onGround = !this.board.isValidMovement(cur, 1, 0);
      if (nextLockFrames === null && onGround) {
        // start lock timer if it hasn't already
        nextLockFrames = CONFIG.dropLockFrames;
      } else if (nextLockFrames !== null && !onGround) {
        // no longer on ground
        nextLockFrames = null;
      }

      // process delay + 1 frames; delay is how many we missed, +1 for the current frame
      cur = cur.copy();
      for (let delayFrame = 0; delayFrame <= curAIDelay; delayFrame++) {
        if (nextLockFrames != null) {
          // on ground; use lock timer
          if (nextLockFrames <= 0) {
            mustDrop = true;
            break;
          } else {
            nextLockFrames--;
          }
        } else {
          // not on ground; use drop timer
          if (nextDropFrames <= 0) {
            // try to move down
            if (this.board.isValidMovement(cur, 1, 0)) {
              cur.r++;
              nextDropFrames = CONFIG.dropFrames;
              // check lock state
              if (!this.board.isValidMovement(cur, 1, 0)) {
                nextLockFrames = CONFIG.dropLockFrames;
              }
            } else {
              mustDrop = true;
              break;
            }
          } else {
            nextDropFrames--;
          }
        }
      }

      // reset to the normal ai delay
      if (curAIDelay !== CONFIG.aiDelay) {
        curAIDelay = CONFIG.aiDelay;
      }

      /* ----- drop ----- */

      const dropped = this.board.getGhost(cur);
      if (!visited_dropped.has(dropped.toString()) && this.board.isValidMovement(dropped, 0, 0)) {
        // haven't already tried dropping the tetromino here
        visited_dropped.add(dropped.toString());

        // place on board and save steps
        const prevArr = this.board.arr.map(a => a.slice());
        this.board.place(dropped);
        const curArr = this.board.arr;
        this.board.arr = prevArr;

        const finalSteps: Step[] = prevSteps.slice();
        // no need to add the DROP if gravity did it for us
        if (storeSteps && !mustDrop) {
          finalSteps.push({ stepNumber: cur.r, step: AIStep.DROP });
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

      if (mustDrop) {
        // can't do anything else
        continue;
      }

      /* ----- rotations ----- */

      const possibleRotations = [Rotation.CLOCKWISE, Rotation.COUNTERCLOCKWISE] as const;
      for (const rotation of possibleRotations) {
        const step = rotation === Rotation.CLOCKWISE ? AIStep.CLOCKWISE : AIStep.COUNTERCLOCKWISE;
        const next = cur.copy();
        const validRotation = next.rotateValid(this.board, rotation);
        if (validRotation && !visited.has(next.toString())) {
          if (storeSteps) {
            const nextSteps = prevSteps.slice();
            nextSteps.push({ stepNumber: cur.r, step: step });
            queue.push({ cur: next, prevSteps: nextSteps, dropFrames: nextDropFrames, lockFrames: nextLockFrames });
          } else {
            queue.push({ cur: next, prevSteps: [], dropFrames: nextDropFrames, lockFrames: nextLockFrames });
          }
          visited.add(next.toString());
        }
      }

      /* ----- movement ----- */

      if (this.board.isValidMovement(cur, 0, -1)) {
        // can move left
        const next = cur.copy();
        next.c -= 1;
        if (!visited.has(next.toString())) {
          if (storeSteps) {
            const nextSteps = prevSteps.slice();
            nextSteps.push({ stepNumber: cur.r, step: AIStep.LEFT });
            queue.push({ cur: next, prevSteps: nextSteps, dropFrames: nextDropFrames, lockFrames: nextLockFrames });
          } else {
            queue.push({ cur: next, prevSteps: [], dropFrames: nextDropFrames, lockFrames: nextLockFrames });
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
            nextSteps.push({ stepNumber: cur.r, step: AIStep.RIGHT });
            queue.push({ cur: next, prevSteps: nextSteps, dropFrames: nextDropFrames, lockFrames: nextLockFrames });
          } else {
            queue.push({ cur: next, prevSteps: [], dropFrames: nextDropFrames, lockFrames: nextLockFrames });
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
            nextSteps.push({ stepNumber: cur.r, step: AIStep.DOWN });
            queue.push({ cur: next, prevSteps: nextSteps, dropFrames: nextDropFrames, lockFrames: nextLockFrames });
          } else {
            queue.push({ cur: next, prevSteps: [], dropFrames: nextDropFrames, lockFrames: nextLockFrames });
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
    score += CONFIG.weight_lineclears * stats.lineClears;
    // penalize holes
    if (CONFIG.scaled_holes) {
      score -= CONFIG.weight_holes * stats.scaledHoles;
    } else {
      score -= CONFIG.weight_holes * stats.totalHoles;
    }
    // penalize height
    if (CONFIG.scaled_boardheight) {
      score -= CONFIG.weight_boardheight * stats.scaledBoardHeight;
    } else {
      score -= CONFIG.weight_boardheight * stats.boardHeight;
    }
    // penalize placement height
    if (CONFIG.scaled_placementheight) {
      score -= CONFIG.weight_placementheight * stats.scaledPlacementHeight;
    } else {
      score -= CONFIG.weight_placementheight * stats.placementHeight;
    }
    // penalize wells
    score -= CONFIG.weight_avgheightdiff * stats.avgHeightDiff;
    score -= CONFIG.weight_deepestwell * stats.deepestWell;
    // penalize high flips
    score -= CONFIG.weight_rowflip * stats.rowFlips;
    score -= CONFIG.weight_colflip * stats.colFlips;
    return score;
  }

  getStatistics(potential: ExecuteType) {
    const stats: StatisticsType = {} as StatisticsType;
    const potentialArr = potential.arr;
    // line clears
    stats.lineClears = 0;
    for (let r = 0; r < CONFIG.rows; r++) {
      if (!potentialArr[r].includes(0)) {
        stats.lineClears += 1;
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
    stats.totalHoles = 0;
    stats.scaledHoles = 0;
    for (let c = 0; c < CONFIG.cols; c++) {
      const firstTile = arr.findIndex(row => row[c] !== 0);
      if (firstTile === -1) {
        continue;
      }
      let numHoles = 0;
      for (let r = firstTile; r < CONFIG.rows; r++) {
        if (arr[r][c] === 0) {
          numHoles++;
          stats.totalHoles++;
        }
      }
      stats.scaledHoles += Math.pow(numHoles, CONFIG.exp_holes);
    }
    // board height
    const firstRowWithTile = arr.findIndex(row => !row.every(item => item === 0));
    stats.boardHeight = CONFIG.rows - firstRowWithTile;
    stats.scaledBoardHeight = Math.pow(stats.boardHeight, CONFIG.exp_boardheight);
    // placement height
    stats.placementHeight = CONFIG.rows - potential.row;
    stats.scaledPlacementHeight = Math.pow(CONFIG.rows - potential.row, CONFIG.exp_placementheight);
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
    stats.avgHeightDiff = sumHeightDiffs / (CONFIG.cols - 1);
    // deepest well
    let deepestWell = 0;
    for (let c = 0; c < CONFIG.cols; c++) {
      let leftHeight = c === 0 ? null : heights[c - 1];
      let rightHeight = c === CONFIG.cols - 1 ? null : heights[c + 1];
      if (leftHeight === null) {
        leftHeight = rightHeight;
      } else if (rightHeight === null) {
        rightHeight = leftHeight;
      }
      const curHeight = heights[c];
      if (leftHeight > curHeight && curHeight < rightHeight) {
        // in a well
        deepestWell = Math.max(deepestWell, Math.min(leftHeight - curHeight, rightHeight - curHeight));
      }
    }
    stats.deepestWell = deepestWell;
    // flips in empty/nonempty cells
    let rowFlips = 0;
    let colFlips = 0;
    for (let r = 1; r < CONFIG.rows; r++) {
      for (let c = 1; c < CONFIG.cols; c++) {
        const curEmpty = arr[r][c] === 0;
        const aboveEmpty = arr[r - 1][c] === 0;
        const leftEmpty = arr[r][c - 1] === 0;
        if (curEmpty ^ aboveEmpty) {  // XOR = 1 if different
          colFlips++;
        }
        if (curEmpty ^ leftEmpty) {
          rowFlips++;
        }
      }
    }
    stats.rowFlips = rowFlips;
    stats.colFlips = colFlips;
    return stats;
  }


  displayScore(potential: ExecuteType) {
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
    const HTMLdeepestwell = document.getElementById("stats-deepest-well");
    const HTMLdeepestwellcalc = document.getElementById("stats-deepest-well-calc");
    const HTMLflips = document.getElementById("stats-flips");
    const HTMLflipscalc = document.getElementById("stats-flips-calc");
    const score = this.board.ai.getScore(potential);
    const stats = this.board.ai.getStatistics(potential);
    HTMLscore.innerHTML = ((score < 0) ? "" : "&nbsp;") + (Math.round(score * 100) / 100);
    HTMLlineclears.innerText = String(stats.lineClears);
    HTMLlineclearscalc.innerText = String(Math.round(CONFIG.weight_lineclears * stats.lineClears * 100) / 100);
    HTMLholes.innerText = String(Math.round((CONFIG.scaled_holes ? stats.scaledHoles : stats.totalHoles) * 100) / 100);
    HTMLholescalc.innerText = String(Math.round(-CONFIG.weight_holes *
      (CONFIG.scaled_holes ? stats.scaledHoles : stats.totalHoles) * 100) / 100);
    HTMLboardheight.innerText = String(Math.round(stats.boardHeight * 100) / 100);
    HTMLboardheightcalc.innerText = String(Math.round(-CONFIG.weight_boardheight *
      (CONFIG.scaled_boardheight ? stats.scaledBoardHeight : stats.boardHeight) * 100) / 100);
    HTMLplacementheight.innerText = String(Math.round(stats.placementHeight * 100) / 100);
    HTMLplacementheightcalc.innerText = String(Math.round(-CONFIG.weight_placementheight *
      (CONFIG.scaled_placementheight ? stats.scaledPlacementHeight : stats.placementHeight) * 100) / 100);
    HTMLavgheightdiff.innerText = String(Math.round(stats.avgHeightDiff * 100) / 100);
    HTMLavgheightdiffcalc.innerText = String(
      Math.round(-CONFIG.weight_avgheightdiff * stats.avgHeightDiff * 100) / 100);
    HTMLdeepestwell.innerText = String(stats.deepestWell);
    HTMLdeepestwellcalc.innerText = String(-stats.deepestWell * CONFIG.weight_deepestwell);
    HTMLflips.innerText = String(stats.rowFlips + stats.colFlips);
    HTMLflipscalc.innerText = String(-stats.rowFlips * CONFIG.weight_rowflip - stats.colFlips * CONFIG.weight_colflip);
  }
}