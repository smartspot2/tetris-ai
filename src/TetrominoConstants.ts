export enum Rotation {
  SPAWN = 0,
  CLOCKWISE = 1,
  FLIP = 2,
  COUNTERCLOCKWISE = 3
}


/**
 * All possible tetromino types, along with their corresponding shapes and colors.
 */
export const TETROMINO_TYPE = {
  I: {
    shape: [[0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]],
    color: "#31C7EF"
  },
  J: {
    shape: [[1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: "#5A65AD"
  },
  L: {
    shape: [[0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]],
    color: "#EF7921"
  },
  O: {
    shape: [[1, 1],
      [1, 1]],
    color: "#F7D308"
  },
  S: {
    shape: [[0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]],
    color: "#42B642"
  },
  T: {
    shape: [[0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]],
    color: "#AD4D9C"
  },
  Z: {
    shape: [[1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]],
    color: "#EF2029"
  }
} as const;

/**
 * Translation tests for wall kick implementation.
 *
 * First level is the current rotation state,
 * second level is which direction we're rotating (i.e. CLOCKWISE vs COUNTERCLOCKWISE).
 * The resulting array gives a list of pairs (dr, dc) to translate by, to be tested in order.
 */
export const WALLKICK_TESTS: { [state in Rotation]: { [rot in Rotation.CLOCKWISE | Rotation.COUNTERCLOCKWISE]: number[][] } } = {
  [Rotation.SPAWN]: {
    [Rotation.CLOCKWISE]: [
      [0, 0],
      [0, -1],
      [-1, -1],
      [2, 0],
      [2, -1]
    ],
    [Rotation.COUNTERCLOCKWISE]: [
      [0, 0],
      [0, 1],
      [-1, 1],
      [2, 0],
      [2, 1]
    ]
  },
  [Rotation.CLOCKWISE]: {
    [Rotation.CLOCKWISE]: [
      [0, 0],
      [0, 1],
      [1, 1],
      [-2, 0],
      [-2, 1]
    ],
    [Rotation.COUNTERCLOCKWISE]: [
      [0, 0],
      [0, 1],
      [1, 1],
      [-2, 0],
      [-2, 1]
    ]
  },
  [Rotation.FLIP]: {
    [Rotation.CLOCKWISE]: [
      [0, 0],
      [0, 1],
      [-1, 1],
      [2, 0],
      [2, 1]
    ],
    [Rotation.COUNTERCLOCKWISE]: [
      [0, 0],
      [0, -1],
      [-1, -1],
      [2, 0],
      [2, -1]
    ]
  },
  [Rotation.COUNTERCLOCKWISE]: {
    [Rotation.CLOCKWISE]: [
      [0, 0],
      [0, -1],
      [1, -1],
      [-2, 0],
      [-2, -1]
    ],
    [Rotation.COUNTERCLOCKWISE]: [
      [0, 0],
      [0, -1],
      [1, -1],
      [-2, 0],
      [-2, -1]
    ]
  }
};

export const WALLKICK_TESTS_I: { [state in Rotation]: { [rot in Rotation.CLOCKWISE | Rotation.COUNTERCLOCKWISE]: number[][] } } = {
  [Rotation.SPAWN]: {
    [Rotation.CLOCKWISE]: [
      [0, 0],
      [0, -2],
      [0, 1],
      [1, -2],
      [-2, 1]
    ],
    [Rotation.COUNTERCLOCKWISE]: [
      [0, 0],
      [0, -1],
      [0, 2],
      [-2, -1],
      [1, 2]
    ]
  },
  [Rotation.CLOCKWISE]: {
    [Rotation.CLOCKWISE]: [
      [0, 0],
      [0, -1],
      [0, 2],
      [-2, -1],
      [1, 2]
    ],
    [Rotation.COUNTERCLOCKWISE]: [
      [0, 0],
      [0, 2],
      [0, -1],
      [-1, 2],
      [2, -1]
    ]
  },
  [Rotation.FLIP]: {
    [Rotation.CLOCKWISE]: [
      [0, 0],
      [0, 2],
      [0, -1],
      [-1, 2],
      [2, -1]
    ],
    [Rotation.COUNTERCLOCKWISE]: [
      [0, 0],
      [0, 1],
      [0, -2],
      [2, 1],
      [-1, -2]
    ]
  },
  [Rotation.COUNTERCLOCKWISE]: {
    [Rotation.CLOCKWISE]: [
      [0, 0],
      [0, 1],
      [0, -2],
      [2, 1],
      [-1, -2]
    ],
    [Rotation.COUNTERCLOCKWISE]: [
      [0, 0],
      [0, -2],
      [0, 1],
      [1, -2],
      [-2, 1]
    ]
  }
};