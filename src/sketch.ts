let board: Board;
let ai: AI;

function setup() {
  const canvas = createCanvas(800, 800);
  canvas.parent("sketch");

  frameRate(CONFIG.framerate);

  CONFIG.board_tl = { x: 0.5 * (width - CONFIG.board_w), y: 0.5 * (height - CONFIG.board_h) };

  resetBoard();
}

function draw() {
  background(250);

  fill(0);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(24);
  text(`Lines cleared: ${board.lineClears}`, width / 2, 50);
  textSize(20);
  text("Next", width / 2 + 242, 110);
  text("Hold", width / 2 - 241, 110);

  if (board.gameOver) {
    textSize(28);
    text("Game Over", width / 2, height - 60);
    document.getElementById("replay-btn")!.style.visibility = "visible";
    noLoop();
  }
  board.draw();
}

function keyPressed() {
  // Disabled if focused on settings
  if (document.activeElement?.classList.contains("settings-number")) {
    return;
  }
  if (keyCode === LEFT_ARROW) {
    board.move(board.curTetromino, 0, -1);
  } else if (keyCode === RIGHT_ARROW) {
    board.move(board.curTetromino, 0, 1);
  } else if (key === " ") {
    board.moveDrop(board.curTetromino);
  } else if (keyCode === DOWN_ARROW) {
    board.move(board.curTetromino, 1, 0);
  } else if (keyCode === UP_ARROW) {
    board.rotate(board.curTetromino, Rotation.CLOCKWISE);
  } else if (key === "z") {
    board.rotate(board.curTetromino, Rotation.COUNTERCLOCKWISE);
  } else if (keyCode === SHIFT) {
    board.hold();
  }

  if (!CONFIG.aienabled) {
    displayScore(ai.getPotential(board.curTetromino));
  }
}


function resetBoard() {
  board = new Board(0.5 * (width - CONFIG.board_w), 0.5 * (height - CONFIG.board_h),
    CONFIG.board_w, CONFIG.board_h);
  ai = new AI(board);
  document.getElementById("replay-btn")!.style.visibility = "hidden";
  loop();
}