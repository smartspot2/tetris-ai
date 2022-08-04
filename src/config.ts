export const CONFIG = {
  board_tl: { x: 0, y: 0 },
  board_w: 300,
  board_h: 600,
  rows: 20,
  cols: 10,
  tilesize: 30,

  tetromino_stroke: 190,
  ghost_alpha: 51,
  aitarget_alpha: 100,
  hint_alpha: 17,

  dropFrames: 30,
  dropLockFrames: 30,
  frameRate: 30,
  autoShiftDelay: 10,
  repeatDelay: 1,

  aiEnabled: false,
  aiDelay: 1,
  aiParallel: true,
  showHint: false,

  weight_lineclears: 200,
  weight_holes: 300,
  scaled_holes: true,
  exp_holes: 0.66,
  weight_boardheight: 8,
  scaled_boardheight: true,
  exp_boardheight: 2,
  weight_placementheight: 5,
  scaled_placementheight: true,
  exp_placementheight: 2,
  weight_avgheightdiff: 75,
  aiturnimprovement: 100,
  weight_rowflip: 20,
  weight_colflip: 20,
  weight_deepestwell: 100
};

export const MINSETTINGS = {
  aiDelay: -1,
  frameRate: 10,
  dropFrames: 0,
  dropLockFrames: 0,
  weight_lineclears: 0,
  weight_holes: 0,
  weight_boardheight: 0,
  weight_placementheight: 0,
  weight_avgheightdiff: 0,
  weight_rowflip: 0,
  weight_colflip: 0,
  weight_deepestwell: 0,
  exp_holes: 0,
  exp_boardheight: 0,
  exp_placementheight: 0
};


/* Initialize HTML config settings */

if (CONFIG.aiEnabled) {
  document.getElementById("enable-ai-input")!.setAttribute("checked", "");
  document.getElementById("ai-delay-input")!.removeAttribute("disabled");
  document.getElementById("ai-parallel-input")!.removeAttribute("disabled");
}
if (CONFIG.showHint) {
  document.getElementById("show-hint-input")!.setAttribute("checked", "");
}
if (CONFIG.aiParallel) {
  (document.getElementById("ai-parallel-input")! as HTMLInputElement).setAttribute("checked", "");
}
(document.getElementById("ai-delay-input")! as HTMLInputElement).value = String(CONFIG.aiDelay);
(document.getElementById("frame-rate-input")! as HTMLInputElement).value = String(CONFIG.frameRate);
(document.getElementById("drop-frames-input")! as HTMLInputElement).value = String(CONFIG.dropFrames);
(document.getElementById("lock-frames-input")! as HTMLInputElement).value = String(CONFIG.dropLockFrames);
(document.getElementById("weight-line-clears")! as HTMLInputElement).value = String(CONFIG.weight_lineclears);
(document.getElementById("weight-holes")! as HTMLInputElement).value = String(CONFIG.weight_holes);
(document.getElementById("weight-board-height")! as HTMLInputElement).value = String(CONFIG.weight_boardheight);
(document.getElementById("weight-placement-height")! as HTMLInputElement).value = String(CONFIG.weight_placementheight);
(document.getElementById("weight-avg-height-diff")! as HTMLInputElement).value = String(CONFIG.weight_avgheightdiff);
(document.getElementById("weight-row-flip")! as HTMLInputElement).value = String(CONFIG.weight_rowflip);
(document.getElementById("weight-col-flip")! as HTMLInputElement).value = String(CONFIG.weight_colflip);
(document.getElementById("weight-deepest-well")! as HTMLInputElement).value = String(CONFIG.weight_deepestwell);
if (CONFIG.scaled_holes) {
  document.getElementById("scaled-holes")!.setAttribute("checked", "");
  document.getElementById("exp-holes")!.removeAttribute("disabled");
}
if (CONFIG.scaled_boardheight) {
  document.getElementById("scaled-board-height")!.setAttribute("checked", "");
  document.getElementById("exp-board-height")!.removeAttribute("disabled");
}
if (CONFIG.scaled_placementheight) {
  document.getElementById("scaled-placement-height")!.setAttribute("checked", "");
  document.getElementById("exp-placement-height")!.removeAttribute("disabled");
}
(document.getElementById("exp-holes")! as HTMLInputElement).value = String(CONFIG.exp_holes);
(document.getElementById("exp-board-height")! as HTMLInputElement).value = String(CONFIG.exp_boardheight);
(document.getElementById("exp-placement-height")! as HTMLInputElement).value = String(CONFIG.exp_placementheight);

// Disable default keyboard scrolling
window.addEventListener("keydown", function (e) {
  if (!document.activeElement?.className.includes("settings-number") && [32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
    e.preventDefault();
  }
}, false);