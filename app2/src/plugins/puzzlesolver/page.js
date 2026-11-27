// RuneLite's Puzzle Solver plugin, cloned from net.runelite.client.plugins.puzzlesolver (BSD 2-Clause, Copyright (c)
// 2018, Lotto <https://github.com/devLotto>, (c) 2018, Henke <https://github.com/henke96> and RuneLite contributors):
// PuzzleSolverPlugin, PuzzleSolverConfig, PuzzleSolverOverlay, PuzzleSolver, PuzzleState, Pathfinder, IDAStar,
// Heuristic / ManhattanDistance.
// Era-trim: the clue sliding puzzles (2007 interface 363, inv 140: the same ids as OSRS's TrailSlidepuzzle /
// TRAIL_PUZZLEINV) and Monkey Madness's reinitialisation puzzle (IDAStarMM, PuzzleSwapPattern; 2007 inv 221
// reinitialisation_inv, the same id as OSRS, with its pieces at 287:2, the server's inter_214:com_3); no light box
// (Elemental Workshop II) or Varrock museum quiz. The tile size comes from the 2007 inventory component's margin. RuneLite solves on an executor thread; here the IDA* search runs in slices of a few ms per
// frame (an explicit stack instead of recursion), so the game never stalls. The arrows mode uses the MAPMARKER sprite
// when the 2007 cache has it (the dots are the default).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, Overlay, OverlayPosition, OverlayLayer, OverlayPriority, GameState, Rectangle, BackgroundComponent, TextComponent, Point } = rl;
  const GROUP = 'puzzlesolver';
  const DIMENSION = 5;
  const BLANK_TILE_VALUE = -1;
  const MAX_WAIT_DURATION = 1500;
  const TRAIL_PUZZLEINV = 140;
  const PIECES = (363 << 16) | 1; // InterfaceID.TrailSlidepuzzle.PIECES
  const REINITIALISATION_INV = 221; // InventoryID.REINITIALISATION_INV
  const PIECES_MM = (287 << 16) | 2; // 2007: the MM puzzle is its own interface (inter_214:com_3)

  // ---- PuzzleState
  class PuzzleState {
    constructor(pieces, copyOf) {
      this.parent = null; this.h = -1;
      if (copyOf) { this.pieces = copyOf.pieces.slice(); this.emptyPiece = copyOf.emptyPiece; return; }
      if (pieces == null) throw new Error('Pieces cannot be null');
      if (DIMENSION * DIMENSION !== pieces.length) throw new Error('Piece array does not have the right dimensions');
      this.pieces = pieces; this.emptyPiece = -1;
      this.findEmptyPiece();
    }
    findEmptyPiece() {
      for (let i = 0; i < this.pieces.length; i++) if (this.pieces[i] === BLANK_TILE_VALUE) { this.emptyPiece = i; return; }
      throw new Error('Incorrect empty piece passed in!');
    }
    move(to) {
      const state = new PuzzleState(null, this);
      state.parent = this;
      state.pieces[to] = BLANK_TILE_VALUE;
      state.pieces[this.emptyPiece] = this.pieces[to];
      state.emptyPiece = to;
      return state;
    }
    computeMoves() {
      const moves = [];
      const e = this.emptyPiece; const x = e % DIMENSION; const y = Math.floor(e / DIMENSION);
      const p = this.parent;
      if (x > 0 && (p == null || p.emptyPiece !== e - 1)) moves.push(this.move(e - 1));
      if (x < DIMENSION - 1 && (p == null || p.emptyPiece !== e + 1)) moves.push(this.move(e + 1));
      if (y > 0 && (p == null || p.emptyPiece !== e - DIMENSION)) moves.push(this.move(e - DIMENSION));
      if (y < DIMENSION - 1 && (p == null || p.emptyPiece !== e + DIMENSION)) moves.push(this.move(e + DIMENSION));
      return moves;
    }
    swap(x1, y1, x2, y2) {
      const val1 = this.getPiece(x1, y1); const val2 = this.getPiece(x2, y2);
      if (!this.isValidSwap(x1, y1, x2, y2)) throw new Error(`Invalid swap: (${x1}, ${y1}), (${x2}, ${y2})`);
      const newState = new PuzzleState(null, this);
      newState.pieces[y1 * DIMENSION + x1] = val2;
      newState.pieces[y2 * DIMENSION + x2] = val1;
      newState.findEmptyPiece();
      return newState;
    }
    isValidSwap(x1, y1, x2, y2) {
      const absX = Math.abs(x1 - x2); const absY = Math.abs(y1 - y2);
      if (this.getPiece(x1, y1) !== BLANK_TILE_VALUE && this.getPiece(x2, y2) !== BLANK_TILE_VALUE) return false;
      if (x1 === x2 && absY === 1) return true;
      return y1 === y2 && absX === 1;
    }
    getParent() { return this.parent; }
    hasPieces(pieces) { return pieces.length === this.pieces.length && pieces.every((v, i) => v === this.pieces[i]); }
    getPiece(x, y) { return this.pieces[y * DIMENSION + x]; }
    getEmptyPiece() { return this.emptyPiece; }
    getHeuristicValue(heuristic) { if (this.h === -1) this.h = heuristic.computeValue(this); return this.h; }
  }

  // ---- ManhattanDistance
  const ManhattanDistance = {
    computeValue(state) {
      let value = 0;
      const parent = state.getParent();
      if (parent == null) {
        for (let x = 0; x < DIMENSION; x++) {
          for (let y = 0; y < DIMENSION; y++) {
            const piece = state.getPiece(x, y);
            if (piece === BLANK_TILE_VALUE) continue;
            value += Math.abs(x - piece % DIMENSION) + Math.abs(y - Math.floor(piece / DIMENSION));
          }
        }
      } else {
        // the parent's value, plus or minus one for the piece that moved
        value = parent.getHeuristicValue(this);
        const x = parent.getEmptyPiece() % DIMENSION; const y = Math.floor(parent.getEmptyPiece() / DIMENSION);
        const x2 = state.getEmptyPiece() % DIMENSION; const y2 = Math.floor(state.getEmptyPiece() / DIMENSION);
        const piece = state.getPiece(x, y);
        if (x2 > x) value += piece % DIMENSION > x ? 1 : -1;
        else if (x2 < x) value += piece % DIMENSION < x ? 1 : -1;
        else if (y2 > y) value += Math.floor(piece / DIMENSION) > y ? 1 : -1;
        else value += Math.floor(piece / DIMENSION) < y ? 1 : -1;
      }
      return value;
    },
  };

  // ---- IDAStar (search(node, g, bound) with an explicit stack, resumable: step(budgetMs) returns the path when done)
  class IDAStar {
    constructor(heuristic) { this.heuristic = heuristic; }
    start(root) {
      this.root = root; this.bound = root.getHeuristicValue(this.heuristic);
      this.stack = [{ node: root, g: 0, moves: null, i: 0 }];
    }
    step(budgetMs) {
      const end = performance.now() + budgetMs;
      let n = 0;
      while (true) {
        if ((++n & 1023) === 0 && performance.now() > end) return undefined;
        if (this.stack.length === 0) { this.bound += 1; this.stack = [{ node: this.root, g: 0, moves: null, i: 0 }]; continue; }
        const top = this.stack[this.stack.length - 1];
        if (top.moves === null) {
          const h = top.node.getHeuristicValue(this.heuristic);
          if (top.g + h > this.bound) { this.stack.pop(); continue; }
          if (h === 0) return this.computePath(top.node);
          top.moves = top.node.computeMoves();
        }
        if (top.i >= top.moves.length) { this.stack.pop(); continue; }
        this.stack.push({ node: top.moves[top.i++], g: top.g + 1, moves: null, i: 0 });
      }
    }
    computePath(goalNode) {
      const path = [];
      for (let parent = goalNode; parent != null; parent = parent.getParent()) path.unshift(parent);
      return path;
    }
  }


  // ---- PuzzleSwapPattern
  const PuzzleSwapPattern = {};
  [['ROTATE_LEFT_UP', [1, -1, 0, -1, -1, -1, -1, 0], 1, 1], ['ROTATE_LEFT_DOWN', null, 1, -1], ['ROTATE_RIGHT_UP', null, -1, 1],
    ['ROTATE_RIGHT_DOWN', null, -1, -1], ['ROTATE_UP_LEFT', [-1, 1, -1, 0, -1, -1, 0, -1], 1, 1], ['ROTATE_UP_RIGHT', null, -1, 1],
    ['ROTATE_DOWN_LEFT', null, 1, -1], ['ROTATE_DOWN_RIGHT', null, -1, -1], ['LAST_PIECE_ROW', [-1, -1, 0, -1, -1, 0, -1, 1], 1, 1],
    ['LAST_PIECE_COLUMN', [-1, -1, -1, 0, 0, -1, 1, -1], 1, 1], ['SHUFFLE_UP_RIGHT', [1, -1, 0, -1], 1, 1],
    ['SHUFFLE_UP_LEFT', [-1, -1, 0, -1], 1, 1], ['SHUFFLE_UP_BELOW', [-1, 1, -1, 0], 1, 1], ['SHUFFLE_UP_ABOVE', [-1, -1, -1, 0], 1, 1],
  ].forEach(([name, points, modX, modY]) => { PuzzleSwapPattern[name] = Object.freeze({ name, getPoints: () => points, getModX: () => modX, getModY: () => modY }); });
  const SP = PuzzleSwapPattern;

  // ---- IDAStarMM: solves the first row, the first column and the second row by swap patterns, then IDA* for the rest.
  // RuneLite's computePath(root) is start(root) (the patterns, synchronous: a few hundred swaps) plus step() here.
  const pt = (x, y) => ({ x, y });
  class IDAStarMM extends IDAStar {
    constructor(heuristic) {
      super(heuristic);
      this.currentState = null; this.stateList = [];
      this.validRowNumbers = [[0, 1, 2, 3, 4], [6, 7, 8, 9]];
      this.validColumnNumbers = [[5, 10, 15, 20]];
    }
    start(root) {
      this.currentState = root;
      this.stateList.push(root);
      this.solveRow(0);
      this.solveColumn();
      this.solveRow(1);
      this.stateList.pop();
      super.start(this.currentState);
    }
    step(budgetMs) {
      const rest = super.step(budgetMs);
      if (rest === undefined || rest == null) return rest;
      return this.stateList.concat(rest);
    }
    solveRow(row) {
      for (let i = row; i < DIMENSION; i++) {
        const valTarget = row * DIMENSION + i;
        if (this.currentState.getPiece(i, row) !== valTarget) this.moveTowardsVal(valTarget, i, row, true);
      }
    }
    solveColumn() {
      const column = 0;
      for (let i = column + 1; i < DIMENSION; i++) {
        const valTarget = column + i * DIMENSION;
        if (this.currentState.getPiece(column, i) !== valTarget) this.moveTowardsVal(valTarget, column, i, false);
      }
    }
    moveTowardsVal(valTarget, x, y, rowMode) {
      let reached = false;
      const cs = () => this.currentState;
      while (cs().getPiece(x, y) !== valTarget) {
        const locVal = this.findPiece(valTarget);
        const locBlank = this.findPiece(BLANK_TILE_VALUE);
        if (reached) {
          if (rowMode) { this.alignTargetX(valTarget, x, y); this.swapUpRow(valTarget, x, y); }
          else { this.alignTargetY(valTarget, x, y); this.swapLeftColumn(valTarget, x, y); }
          continue;
        }
        const distX = locVal.x - locBlank.x; const distY = locVal.y - locBlank.y;
        const distAbsX = Math.abs(distX); const distAbsY = Math.abs(distY);
        if (distX === 0) {
          if (distAbsY === 1) reached = true;
          else if (distY >= 2) this.swap(locBlank, pt(locBlank.x, locBlank.y + 1));
          else if (distY <= -2) this.swap(locBlank, pt(locBlank.x, locBlank.y - 1));
        } else if (distY === 0) {
          if (distAbsX === 1) reached = true;
          else if (distX >= 2) this.swap(locBlank, pt(locBlank.x + 1, locBlank.y));
          else if (distX <= -2) this.swap(locBlank, pt(locBlank.x - 1, locBlank.y));
        } else if (rowMode) {
          if (locBlank.y - 1 === y
            && this.validRowNumbers[y].includes(cs().getPiece(locBlank.x, locBlank.y - 1))
            && cs().getPiece(locBlank.x, locBlank.y - 1) < valTarget
            && distY <= -1) {
            this.swap(locBlank, pt(locBlank.x + 1, locBlank.y));
            continue;
          }
          if (distY >= 1) this.swap(locBlank, pt(locBlank.x, locBlank.y + 1));
          else if (distY <= -1) this.swap(locBlank, pt(locBlank.x, locBlank.y - 1));
        } else {
          if (locBlank.x - 1 === x
            && this.validColumnNumbers[x].includes(cs().getPiece(locBlank.x - 1, locBlank.y))
            && cs().getPiece(locBlank.x - 1, locBlank.y) < valTarget
            && distX <= -1) {
            this.swap(locBlank, pt(locBlank.x, locBlank.y + 1));
            continue;
          }
          if (distX >= 1) this.swap(locBlank, pt(locBlank.x + 1, locBlank.y));
          else if (distX <= -1) this.swap(locBlank, pt(locBlank.x - 1, locBlank.y));
        }
      }
    }
    alignTargetX(valTarget, x, y) {
      let locVal = this.findPiece(valTarget);
      if (locVal.x === x) return;
      const direction = Math.sign(x - locVal.x);
      while (locVal.x !== x) {
        locVal = this.findPiece(valTarget);
        const locBlank = this.findPiece(BLANK_TILE_VALUE);
        if (x - locVal.x === 0) break;
        if (locVal.x === locBlank.x) {
          const diff = locBlank.y - locVal.y;
          if (diff === 1) {
            const loc1 = pt(locBlank.x + direction, locBlank.y); const loc2 = pt(loc1.x, loc1.y - 1);
            this.swap(locBlank, loc1); this.swap(loc1, loc2); this.swap(loc2, locVal);
          } else if (diff === -1) this.swap(locBlank, locVal);
        } else if (locVal.y === locBlank.y) {
          const diff = locBlank.x - locVal.x;
          if (diff === 1) {
            if (direction === 1) this.swap(locVal, locBlank);
            else if (direction === -1) this.performSwapPattern(locBlank, locVal, locVal.y === DIMENSION - 1 ? SP.ROTATE_LEFT_UP : SP.ROTATE_LEFT_DOWN);
          } else if (diff === -1) {
            if (direction === -1) this.swap(locVal, locBlank);
            else if (direction === 1) this.performSwapPattern(locBlank, locVal, locVal.y === DIMENSION - 1 ? SP.ROTATE_RIGHT_UP : SP.ROTATE_RIGHT_DOWN);
          }
        }
      }
    }
    swapUpRow(valTarget, x, y) {
      let locVal = this.findPiece(valTarget);
      let locBlank = this.findPiece(BLANK_TILE_VALUE);
      if (locVal.x === x && locVal.y === y) return;
      if (locBlank.x === x && locBlank.y === y && locVal.y - 1 === y) { this.swap(locBlank, locVal); return; }
      while (true) {
        locVal = this.findPiece(valTarget);
        locBlank = this.findPiece(BLANK_TILE_VALUE);
        if (locVal.x === x && locVal.y === y) return;
        if (locVal.x === locBlank.x) {
          const diff = locBlank.y - locVal.y;
          if (diff === 1) {
            if (x === DIMENSION - 1) { this.performSwapPattern(locBlank, locVal, SP.LAST_PIECE_ROW); return; }
            this.performSwapPattern(locBlank, locVal, SP.ROTATE_UP_RIGHT);
          } else if (diff === -1) this.swap(locBlank, locVal);
        } else if (locVal.y === locBlank.y) {
          const diff = locBlank.x - locVal.x;
          if (diff === 1) this.performSwapPattern(locBlank, locVal, SP.SHUFFLE_UP_RIGHT);
          else if (diff === -1) {
            if (locVal.y - 1 === y) {
              const loc1 = pt(locBlank.x, locBlank.y + 1); const loc2 = pt(loc1.x + 1, loc1.y);
              this.swap(locBlank, loc1); this.swap(loc1, loc2);
              continue;
            }
            this.performSwapPattern(locBlank, locVal, SP.SHUFFLE_UP_LEFT);
          }
        }
      }
    }
    alignTargetY(valTarget, x, y) {
      let locVal = this.findPiece(valTarget);
      if (locVal.y === y) return;
      const direction = Math.sign(y - locVal.y);
      while (locVal.y !== y) {
        locVal = this.findPiece(valTarget);
        const locBlank = this.findPiece(BLANK_TILE_VALUE);
        if (y - locVal.y === 0) break;
        if (locVal.y === locBlank.y) {
          const diff = locBlank.x - locVal.x;
          if (diff === 1) {
            const loc1 = pt(locBlank.x, locBlank.y + direction); const loc2 = pt(loc1.x - 1, loc1.y);
            this.swap(locBlank, loc1); this.swap(loc1, loc2); this.swap(loc2, locVal);
          } else if (diff === -1) this.swap(locBlank, locVal);
        } else if (locVal.x === locBlank.x) {
          const diff = locBlank.y - locVal.y;
          if (diff === 1) {
            if (direction === 1) this.swap(locVal, locBlank);
            else if (direction === -1) this.performSwapPattern(locBlank, locVal, locVal.x === DIMENSION - 1 ? SP.ROTATE_UP_LEFT : SP.ROTATE_UP_RIGHT);
          } else if (diff === -1) {
            if (direction === -1) this.swap(locVal, locBlank);
            else if (direction === 1) this.performSwapPattern(locBlank, locVal, locVal.x === DIMENSION - 1 ? SP.ROTATE_DOWN_LEFT : SP.ROTATE_DOWN_RIGHT);
          }
        }
      }
    }
    swapLeftColumn(valTarget, x, y) {
      let locVal = this.findPiece(valTarget);
      let locBlank = this.findPiece(BLANK_TILE_VALUE);
      if (locVal.x === x && locVal.y === y) return;
      if (locBlank.x === x && locBlank.y === y && locVal.x - 1 === x) { this.swap(locBlank, locVal); return; }
      while (true) {
        locVal = this.findPiece(valTarget);
        locBlank = this.findPiece(BLANK_TILE_VALUE);
        if (locVal.x === x && locVal.y === y) return;
        if (locVal.x === locBlank.x) {
          const diff = locBlank.y - locVal.y;
          if (diff === 1) this.performSwapPattern(locBlank, locVal, SP.SHUFFLE_UP_BELOW);
          else if (diff === -1) {
            if (locVal.x - 1 === x) {
              const loc1 = pt(locBlank.x + 1, locBlank.y); const loc2 = pt(loc1.x, loc1.y + 1);
              this.swap(locBlank, loc1); this.swap(loc1, loc2);
              continue;
            }
            this.performSwapPattern(locBlank, locVal, SP.SHUFFLE_UP_ABOVE);
          }
        } else if (locVal.y === locBlank.y) {
          const diff = locBlank.x - locVal.x;
          if (diff === 1) {
            if (y === DIMENSION - 1) { this.performSwapPattern(locBlank, locVal, SP.LAST_PIECE_COLUMN); return; }
            this.performSwapPattern(locBlank, locVal, SP.ROTATE_LEFT_DOWN);
          } else if (diff === -1) this.swap(locBlank, locVal);
        }
      }
    }
    swap(p1, p2) {
      const newState = this.currentState.swap(p1.x, p1.y, p2.x, p2.y);
      this.currentState = newState;
      this.stateList.push(newState);
    }
    findPiece(val) {
      for (let x = 0; x < DIMENSION; x++) for (let y = 0; y < DIMENSION; y++) if (this.currentState.getPiece(x, y) === val) return pt(x, y);
      throw new Error("Piece wasn't found!");
    }
    /** Assumes locBlank is the first point for the swap and locVal the last */
    performSwapPattern(locBlank, locVal, pattern) {
      let offsets;
      switch (pattern) {
        case SP.ROTATE_LEFT_UP: case SP.ROTATE_RIGHT_UP: case SP.ROTATE_RIGHT_DOWN: case SP.ROTATE_LEFT_DOWN:
          offsets = SP.ROTATE_LEFT_UP.getPoints(); break;
        case SP.ROTATE_UP_LEFT: case SP.ROTATE_UP_RIGHT: case SP.ROTATE_DOWN_LEFT: case SP.ROTATE_DOWN_RIGHT:
          offsets = SP.ROTATE_UP_LEFT.getPoints(); break;
        default: offsets = pattern.getPoints();
      }
      if (offsets == null || offsets.length % 2 === 1) throw new Error('Unexpected points given in pattern!');
      const modX = pattern.getModX(); const modY = pattern.getModY();
      const points = [];
      for (let i = 0; i < offsets.length; i += 2) points.push(pt(locVal.x + modX * offsets[i], locVal.y + modY * offsets[i + 1]));
      points.push(locVal);
      if (pattern !== SP.LAST_PIECE_ROW && pattern !== SP.LAST_PIECE_COLUMN) {
        let start = locBlank;
        for (const p of points) { this.swap(start, p); start = p; }
      } else {
        const [loc1, loc2, loc3, loc4] = points;
        const seq = [[locBlank, locVal], [locVal, loc3], [loc3, loc1], [loc1, loc2], [loc2, locVal], [locVal, loc3], [loc3, loc1],
          [loc1, loc2], [loc2, locVal], [locVal, locBlank], [locBlank, loc4], [loc4, loc3], [loc3, loc1], [loc1, loc2], [loc2, locVal]];
        for (const [a, b] of seq) this.swap(a, b);
      }
    }
  }

  // ---- PuzzleSolver
  class PuzzleSolver {
    constructor(pathfinder, startState) { this.pathfinder = pathfinder; this.startState = startState; this.solution = null; this.position = 0; this.started = 0; this.failed = false; this.cancelled = false; }
    getStep(i) { return this.solution[i]; }
    getStepCount() { return this.solution.length; }
    hasSolution() { return this.solution != null; }
    getPosition() { return this.position; }
    setPosition(p) { this.position = p; }
    hasExceededWaitDuration() { return this.started > 0 && Date.now() - this.started > MAX_WAIT_DURATION; }
    hasFailed() { return this.failed; }
    cancel() { this.cancelled = true; }
    run() {
      this.started = Date.now();
      try { this.pathfinder.start(this.startState); } catch { this.failed = true; return; }
      const slice = () => {
        if (this.cancelled) return;
        let r;
        try { r = this.pathfinder.step(6); } catch { this.failed = true; return; }
        if (r === undefined) { setTimeout(slice, 10); return; }
        this.solution = r; this.failed = r == null;
      };
      slice();
    }
  }

  // ---- PuzzleSolverOverlay
  const INFO_BOX_WIDTH = 100; const INFO_BOX_OFFSET_Y = 50; const INFO_BOX_TOP_BORDER = 2; const INFO_BOX_BOTTOM_BORDER = 2;
  const DOT_MARKER_MAX_SIZE = 24; const DOT_MARKER_MIN_SIZE = 4;
  const colorLerp = (a, b, t) => new Color(Math.round(a.r + (b.r - a.r) * t), Math.round(a.g + (b.g - a.g) * t), Math.round(a.b + (b.b - a.b) * t), Math.round(a.a + (b.a - a.a) * t));
  const MAPMARKER = 299; // SpriteID.MAPMARKER

  class PuzzleSolverOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin; this.solver = null; this.cachedItems = null; this.arrows = {};
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setPriority(OverlayPriority.HIGH);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
    }
    render(graphics) {
      const config = this.plugin.config;
      if ((!config.displaySolution() && !config.displayRemainingMoves()) || client.getGameState() !== GameState.LOGGED_IN) return null;
      let useNormalSolver = true;
      let container = client.getItemContainer(TRAIL_PUZZLEINV);
      if (container == null) {
        useNormalSolver = false;
        container = client.getItemContainer(REINITIALISATION_INV);
        if (container == null) return null;
      }
      const piecesId = useNormalSolver ? PIECES : PIECES_MM;
      const puzzleBox = client.getWidget(piecesId);
      if (puzzleBox == null || puzzleBox.isHidden()) return null;
      const puzzleBoxLocation = puzzleBox.getCanvasLocation();
      // 2007: the pieces are an inventory component (width and height in slots, 32 px items plus its margin) rather
      // than OSRS's 50 px tiles
      const com = ll.api && ll.api.com ? ll.api.com(piecesId) : null;
      const PUZZLE_TILE_SIZE = com && com.type === 2 ? 32 + (com.marginX | 0) : 50;
      const boxWidth = com && com.type === 2 ? PUZZLE_TILE_SIZE * DIMENSION : puzzleBox.getWidth();
      let infoString = 'Solving..';
      const itemIds = this.getItemIds(container, useNormalSolver);
      if (itemIds == null) return null;
      let shouldCache = false;
      const solver = this.solver;
      if (solver != null) {
        if (solver.hasFailed()) {
          infoString = 'The puzzle could not be solved';
        } else if (solver.hasSolution()) {
          let foundPosition = false;
          // Find the current state by looking at the current step and up to the next 5 steps
          for (let i = 0; i < 6; i++) {
            const j = solver.getPosition() + i;
            if (j === solver.getStepCount()) break;
            const currentState = solver.getStep(j);
            if (currentState != null && currentState.hasPieces(itemIds)) { foundPosition = true; solver.setPosition(j); if (i > 0) shouldCache = true; break; }
          }
          // If looking at the next steps didn't find the current state, see if we can find the current state in the 5 previous steps
          if (!foundPosition) {
            for (let i = 1; i < 6; i++) {
              const j = solver.getPosition() - i;
              if (j < 0) break;
              const currentState = solver.getStep(j);
              if (currentState != null && currentState.hasPieces(itemIds)) { foundPosition = true; shouldCache = true; solver.setPosition(j); break; }
            }
          }
          if (foundPosition) {
            const stepsLeft = solver.getStepCount() - solver.getPosition() - 1;
            if (stepsLeft === 0) infoString = 'Solved!';
            else if (config.displayRemainingMoves()) infoString = 'Moves left: ' + stepsLeft;
            else infoString = null;
            if (config.displaySolution()) {
              if (config.drawDots()) {
                const movesToShow = config.movesToShow();
                // Display the next 4 steps
                for (let i = 1; i <= movesToShow; i++) {
                  const j = solver.getPosition() + i;
                  if (j >= solver.getStepCount()) break;
                  const futureMove = solver.getStep(j);
                  if (futureMove == null) break;
                  const blankX = futureMove.getEmptyPiece() % DIMENSION;
                  const blankY = Math.floor(futureMove.getEmptyPiece() / DIMENSION);
                  const numerator = (i - 1) * (DOT_MARKER_MAX_SIZE - DOT_MARKER_MIN_SIZE);
                  const denominator = movesToShow - 1;
                  const markerSize = Math.round(DOT_MARKER_MAX_SIZE - numerator / denominator);
                  const x = puzzleBoxLocation.getX() + blankX * PUZZLE_TILE_SIZE + PUZZLE_TILE_SIZE / 2 - Math.trunc(markerSize / 2) - 1;
                  const y = puzzleBoxLocation.getY() + blankY * PUZZLE_TILE_SIZE + PUZZLE_TILE_SIZE / 2 - Math.trunc(markerSize / 2) - 1;
                  graphics.setColor(colorLerp(config.dotColor(), config.dotEndColor(), (i - 1) / (movesToShow - 1)));
                  graphics.fillOval(x, y, markerSize, markerSize);
                  graphics.setColor(Color.BLACK);
                  graphics.drawOval(x - 1, y - 1, markerSize + 1, markerSize + 1);
                }
              } else {
                // Display the next 3 steps
                const currentMove = solver.getStep(solver.getPosition());
                let lastBlankX = currentMove.getEmptyPiece() % DIMENSION;
                let lastBlankY = Math.floor(currentMove.getEmptyPiece() / DIMENSION);
                for (let i = 1; i < 4; i++) {
                  const j = solver.getPosition() + i;
                  if (j >= solver.getStepCount()) break;
                  const futureMove = solver.getStep(j);
                  if (futureMove == null) break;
                  const blankX = futureMove.getEmptyPiece() % DIMENSION;
                  const blankY = Math.floor(futureMove.getEmptyPiece() / DIMENSION);
                  const xDelta = blankX - lastBlankX; const yDelta = blankY - lastBlankY;
                  const arrow = this.getArrow(xDelta > 0 ? 3 * Math.PI / 2 : xDelta < 0 ? Math.PI / 2 : yDelta > 0 ? 0 : Math.PI);
                  if (arrow != null) {
                    const x = puzzleBoxLocation.getX() + blankX * PUZZLE_TILE_SIZE + PUZZLE_TILE_SIZE / 2 - Math.trunc(arrow.width / 2) - 1;
                    const y = puzzleBoxLocation.getY() + blankY * PUZZLE_TILE_SIZE + PUZZLE_TILE_SIZE / 2 - Math.trunc(arrow.height / 2) - 1;
                    rl.OverlayUtil.renderImageLocation(graphics, new Point(x, y), arrow);
                  }
                  lastBlankX = blankX; lastBlankY = blankY;
                }
              }
            }
          }
        }
      }
      // Draw info box
      if (infoString != null) {
        const x = puzzleBoxLocation.getX() + Math.trunc(boxWidth / 2) - INFO_BOX_WIDTH / 2;
        const y = puzzleBoxLocation.getY() - INFO_BOX_OFFSET_Y;
        const fm = graphics.getFontMetrics();
        const height = INFO_BOX_TOP_BORDER + fm.getHeight() + INFO_BOX_BOTTOM_BORDER;
        const backgroundComponent = new BackgroundComponent();
        backgroundComponent.setRectangle(new Rectangle(x, y, INFO_BOX_WIDTH, height));
        backgroundComponent.render(graphics);
        const textOffsetX = Math.trunc((INFO_BOX_WIDTH - fm.stringWidth(infoString)) / 2);
        const textOffsetY = fm.getHeight();
        const textComponent = new TextComponent();
        textComponent.setPosition(new Point(x + textOffsetX, y + textOffsetY));
        textComponent.setText(infoString);
        textComponent.render(graphics);
      }
      // Solve the puzzle if we don't have an up to date solution
      if (solver == null || this.cachedItems == null
        || (!shouldCache && solver.hasExceededWaitDuration() && !this.sameAsCached(itemIds))) {
        this.solve(itemIds, useNormalSolver);
        shouldCache = true;
      }
      if (shouldCache) this.cachedItems = itemIds.slice();
      return null;
    }
    sameAsCached(ids) { return this.cachedItems && this.cachedItems.length === ids.length && ids.every((v, i) => v === this.cachedItems[i]); }
    getItemIds(container, useNormalSolver) {
      const itemIds = new Array(DIMENSION * DIMENSION).fill(BLANK_TILE_VALUE);
      const items = container.getItems();
      for (let i = 0; i < items.length && i < itemIds.length; i++) itemIds[i] = items[i] && items[i].getId() >= 0 ? items[i].getId() : BLANK_TILE_VALUE;
      if (itemIds.filter((v) => v === BLANK_TILE_VALUE).length !== 1) return null; // (not loaded yet)
      return this.convertToSolverFormat(itemIds, useNormalSolver);
    }
    convertToSolverFormat(items, useNormalSolver) {
      let lowestId = Infinity;
      for (const id of items) if (id !== BLANK_TILE_VALUE && id < lowestId) lowestId = id;
      // The MM puzzle has gaps
      return items.map((id) => (id !== BLANK_TILE_VALUE ? (useNormalSolver ? id - lowestId : Math.trunc((id - lowestId) / 2)) : BLANK_TILE_VALUE));
    }
    solve(items, useNormalSolver = true) {
      if (this.solver != null) this.solver.cancel();
      const puzzleState = new PuzzleState(items.slice());
      this.solver = new PuzzleSolver(useNormalSolver ? new IDAStar(ManhattanDistance) : new IDAStarMM(ManhattanDistance), puzzleState);
      this.solver.run();
    }
    /** SpriteID.MAPMARKER (the down arrow) rotated by ImageUtil.rotateImage, or null if the cache has none */
    getArrow(theta) {
      if (this.arrows[theta]) return this.arrows[theta];
      const s = rl.spriteManager.getSprite(MAPMARKER);
      if (!s || !s.w) return null;
      const src = document.createElement('canvas'); src.width = s.w; src.height = s.h;
      const sg = src.getContext('2d'); const img = sg.createImageData(s.w, s.h);
      for (let i = 0; i < s.px.length; i++) { const v = s.px[i]; img.data[i * 4] = (v >> 16) & 255; img.data[i * 4 + 1] = (v >> 8) & 255; img.data[i * 4 + 2] = v & 255; img.data[i * 4 + 3] = (v >>> 24) & 255; }
      sg.putImageData(img, 0, 0);
      const out = document.createElement('canvas'); out.width = s.w; out.height = s.h;
      const og = out.getContext('2d'); og.translate(s.w / 2, s.h / 2); og.rotate(theta); og.drawImage(src, -s.w / 2, -s.h / 2);
      this.arrows[theta] = out;
      return out;
    }
  }

  // ---- PuzzleSolverPlugin (the light box and museum quiz are later content)
  class PuzzleSolverPlugin {
    constructor() { this.configGroup = GROUP; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = new PuzzleSolverOverlay(this);
      rl.overlayManager.add(this.overlay);
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      if (this.overlay.solver) this.overlay.solver.cancel();
    }
  }

  const plugin = new PuzzleSolverPlugin();
  ll.__puzzlesolver = { plugin, PuzzleState, IDAStar, IDAStarMM, PuzzleSwapPattern, ManhattanDistance, PuzzleSolver };
  rl.registerPlugin(GROUP, plugin);
})();
