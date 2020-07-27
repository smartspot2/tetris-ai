/** @type Board */
let board;
/** @type AI */
let ai;

function setup() {
    let canvas = createCanvas(800, 800);
    canvas.parent('sketch');

    frameRate(CONFIG.framerate);

    CONFIG.board_tl = {x: 0.5 * (width - CONFIG.board_w), y: 0.5 * (height - CONFIG.board_h)};

    board = new Board(0.5 * (width - CONFIG.board_w), 0.5 * (height - CONFIG.board_h),
        CONFIG.board_w, CONFIG.board_h);
    ai = new AI(board);
}

function draw() {
    background(250);

    fill(0);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(24);
    text('Lines cleared: ' + board.lineclears, width / 2, 50);
    textSize(20);
    text('Next', width/2 + 242, 110);
    text('Hold', width/2 - 241, 110);
    board.draw();
}

function keyPressed() {
    if (keyCode === LEFT_ARROW) {
        board.move(board.curtetromino, 0, -1);
    } else if (keyCode === RIGHT_ARROW) {
        board.move(board.curtetromino, 0, 1);
    } else if (key === ' ') {
        board.moveDrop(board.curtetromino);
    } else if (keyCode === DOWN_ARROW) {
        board.move(board.curtetromino, 1, 0);
    } else if (keyCode === UP_ARROW) {
        board.rotate(board.curtetromino, 1);
    } else if (key === 'z') {
        board.rotate(board.curtetromino, -1);
    } else if (keyCode === SHIFT) {
        board.hold();
    }
}

function toggleAI() {
    ai.enabled ^= 1;
    console.log('AI toggled; now ' + ai.enabled);
}

function toggleShowHint() {
    CONFIG.showhint ^= 1
    console.log('Show hint toggled; now ' + CONFIG.showhint);
}