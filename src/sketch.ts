import Board from "./Board";
import { CONFIG, MINSETTINGS } from "./config";
import { Rotation } from "./TetrominoConstants";

import p5 from "p5";

const p5Instance = new p5(p => {
  let board: Board;

  p.setup = () => {
    const canvas = p.createCanvas(800, 800);
    canvas.parent("sketch");

    p.frameRate(CONFIG.framerate);

    CONFIG.board_tl = { x: 0.5 * (p.width - CONFIG.board_w), y: 0.5 * (p.height - CONFIG.board_h) };

    resetBoard();
  };

  p.draw = () => {
    p.background(250);

    p.fill(0);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(24);
    p.text(`Lines cleared: ${board.lineClears}`, p.width / 2, 50);
    p.textSize(20);
    p.text("Next", p.width / 2 + 242, 110);
    p.text("Hold", p.width / 2 - 241, 110);

    if (board.gameOver) {
      p.textSize(28);
      p.text("Game Over", p.width / 2, p.height - 60);
      document.getElementById("replay-btn")!.style.visibility = "visible";
      p.noLoop();
    }
    board.draw();
  };

  p.keyPressed = () => {
    // Disabled if focused on settings
    if (document.activeElement?.classList.contains("settings-number")) {
      return;
    }
    if (p.keyCode === p.LEFT_ARROW) {
      board.move(board.curTetromino, 0, -1);
    } else if (p.keyCode === p.RIGHT_ARROW) {
      board.move(board.curTetromino, 0, 1);
    } else if (p.key === " ") {
      board.moveDrop(board.curTetromino);
    } else if (p.keyCode === p.DOWN_ARROW) {
      board.move(board.curTetromino, 1, 0);
    } else if (p.keyCode === p.UP_ARROW) {
      board.rotate(board.curTetromino, Rotation.CLOCKWISE);
    } else if (p.key === "z") {
      board.rotate(board.curTetromino, Rotation.COUNTERCLOCKWISE);
    } else if (p.keyCode === p.SHIFT) {
      board.hold();
    }

    if (!CONFIG.aienabled) {
      board.ai.displayScore(board.ai.getPotential(board.curTetromino));
    }
  };

  function resetBoard() {
    board = new Board(p, 0.5 * (p.width - CONFIG.board_w), 0.5 * (p.height - CONFIG.board_h),
      CONFIG.board_w, CONFIG.board_h);

    document.getElementById("replay-btn")!.style.visibility = "hidden";
    p.loop();
  }


  // Config settings

  function toggleAI() {
    CONFIG.aienabled = !CONFIG.aienabled;
    // console.info('AI toggled; now ' + CONFIG.aienabled);
    // Toggle other AI inputs
    if (CONFIG.aienabled) {
      document.getElementById("ai-delay-input")?.removeAttribute("disabled");
      document.getElementById("ai-parallel-input")?.removeAttribute("disabled");
    } else {
      document.getElementById("ai-delay-input")?.setAttribute("disabled", "");
      document.getElementById("ai-parallel-input")?.setAttribute("disabled", "");
    }
  }

  function toggleShowHint() {
    CONFIG.showhint = !CONFIG.showhint;
    // console.info('Show hint toggled; now ' + CONFIG.showhint);
  }

  function toggleAIParallel() {
    CONFIG.aiparallel = !CONFIG.aiparallel;
  }


  function changeSetting(el: HTMLInputElement, setting: keyof typeof MINSETTINGS) {
    const val = Number(el.value);
    if (isNaN(val)) {
      el.value = String(CONFIG[setting]);
      return;
    }
    if (val < MINSETTINGS[setting]) {
      el.value = String(MINSETTINGS[setting]);
    }
    CONFIG[setting] = Number(val);
    if (setting === "framerate") {
      p.frameRate(CONFIG.framerate);
    }
    // console.info(setting + ' set to: ' + el.value);
    // Update statistics
    if (CONFIG.aienabled && board.ai.toExecute) {
      board.ai.displayScore(board.ai.toExecute);
    } else {
      board.ai.displayScore(board.ai.getPotential(board.curTetromino));
    }
  }

  function toggleScaled(setting: string) {
    // coerce types
    const formattedSetting: "holes" | "boardheight" | "placementheight" = setting.replace("-", "") as any;
    const scaledSetting: "scaled_holes" | "scaled_boardheight" | "scaled_placementheight" = "scaled_" + formattedSetting as any;

    CONFIG[scaledSetting] = !CONFIG[scaledSetting];
    if (CONFIG[scaledSetting]) {
      if (setting === "holes") {
        document.getElementById("stats-holes-label")!.innerText = "Holes (scaled)";
      }
      document.getElementById("exp-" + setting)!.removeAttribute("disabled");
    } else {
      if (setting === "holes") {
        document.getElementById("stats-holes-label")!.innerText = "Holes";
      }
      document.getElementById("exp-" + setting)!.setAttribute("disabled", "");
    }
  }

  function toggleSettings(el: HTMLButtonElement) {
    if (el.innerText.includes("Advanced")) {
      document.getElementById("basic-settings")!.classList.add("collapsed");
      document.getElementById("advanced-settings")!.classList.remove("collapsed");
      document.getElementById("settings-content")!.classList.remove("collapsed");
      el.innerText = "Basic";
    } else {
      document.getElementById("basic-settings")!.classList.remove("collapsed");
      document.getElementById("advanced-settings")!.classList.add("collapsed");
      document.getElementById("settings-content")!.classList.add("collapsed");
      el.innerText = "Advanced";
    }
  }

  // add event listeners

  document.getElementById("replay-btn")?.addEventListener("click", () => resetBoard());
  document.getElementById("settings-toggle")?.addEventListener("click", el => toggleSettings(el.target as HTMLButtonElement));

  document.getElementById("enable-ai-input")?.addEventListener("click", () => toggleAI());
  document.getElementById("show-hint-input")?.addEventListener("click", () => toggleShowHint());
  document.getElementById("ai-parallel-input")?.addEventListener("click", () => toggleAIParallel());

  document.getElementById("ai-delay-input")?.addEventListener("change", el => changeSetting(el.target as HTMLInputElement, "aidelay"));
  document.getElementById("frame-rate-input")?.addEventListener("change", el => changeSetting(el.target as HTMLInputElement, "framerate"));
  document.getElementById("drop-frames-input")?.addEventListener("change", el => changeSetting(el.target as HTMLInputElement, "dropframes"));
  document.getElementById("weight-line-clears")?.addEventListener("change", el => changeSetting(el.target as HTMLInputElement, "weight_lineclears"));
  document.getElementById("weight-holes")?.addEventListener("change", el => changeSetting(el.target as HTMLInputElement, "weight_holes"));
  document.getElementById("weight-board-height")?.addEventListener("change", el => changeSetting(el.target as HTMLInputElement, "weight_boardheight"));
  document.getElementById("weight-placement-height")?.addEventListener("change", el => changeSetting(el.target as HTMLInputElement, "weight_placementheight"));
  document.getElementById("weight-avg-height-diff")?.addEventListener("change", el => changeSetting(el.target as HTMLInputElement, "weight_avgheightdiff"));

  document.getElementById("scaled-holes")?.addEventListener("click", () => toggleScaled("holes"));
  document.getElementById("exp-holes")?.addEventListener("change", el => changeSetting(el.target as HTMLInputElement, "exp_holes"));
  document.getElementById("scaled-board-height")?.addEventListener("click", () => toggleScaled("board-height"));
  document.getElementById("exp-board-height")?.addEventListener("change", el => changeSetting(el.target as HTMLInputElement, "exp_boardheight"));
  document.getElementById("scaled-placement-height")?.addEventListener("click", () => toggleScaled("placement-height"));
  document.getElementById("exp-placement-height")?.addEventListener("change", el => changeSetting(el.target as HTMLInputElement, "exp_placementheight"));
});