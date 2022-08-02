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

  dropframes: 30,
  dropLockFrames: 30,
  framerate: 30,

  aienabled: false,
  aidelay: 1,
  aiparallel: true,
  showhint: false,

  weight_lineclears: 200,
  weight_holes: 300,
  scale_unreachableholes: 1.5,
  scaled_holes: true,
  exp_holes: 0.66,
  weight_boardheight: 1,
  scaled_boardheight: true,
  exp_boardheight: 2,
  weight_placementheight: 5,
  scaled_placementheight: true,
  exp_placementheight: 2,
  weight_avgheightdiff: 75,
  aiturnimprovement: 100
};

export const MINSETTINGS = {
  aidelay: -1,
  framerate: 10,
  dropframes: 0,
  weight_lineclears: 0,
  weight_holes: 0,
  weight_boardheight: 0,
  weight_placementheight: 0,
  weight_avgheightdiff: 0,
  exp_holes: 0,
  exp_boardheight: 0,
  exp_placementheight: 0
};


/* Initialize HTML config settings */

if (CONFIG.aienabled) {
  document.getElementById("enable-ai-input")!.setAttribute("checked", "");
  document.getElementById("ai-delay-input")!.removeAttribute("disabled");
  document.getElementById("ai-parallel-input")!.removeAttribute("disabled");
}
if (CONFIG.showhint) {
  document.getElementById("show-hint-input")!.setAttribute("checked", "");
}
if (CONFIG.aiparallel) {
  (document.getElementById("ai-parallel-input")! as HTMLInputElement).setAttribute("checked", "");
}
(document.getElementById("ai-delay-input")! as HTMLInputElement).value = String(CONFIG.aidelay);
(document.getElementById("frame-rate-input")! as HTMLInputElement).value = String(CONFIG.framerate);
(document.getElementById("drop-frames-input")! as HTMLInputElement).value = String(CONFIG.dropframes);
(document.getElementById("weight-line-clears")! as HTMLInputElement).value = String(CONFIG.weight_lineclears);
(document.getElementById("weight-holes")! as HTMLInputElement).value = String(CONFIG.weight_holes);
(document.getElementById("weight-board-height")! as HTMLInputElement).value = String(CONFIG.weight_boardheight);
(document.getElementById("weight-placement-height")! as HTMLInputElement).value = String(CONFIG.weight_placementheight);
(document.getElementById("weight-avg-height-diff")! as HTMLInputElement).value = String(CONFIG.weight_avgheightdiff);
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