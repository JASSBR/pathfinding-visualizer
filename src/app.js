document.addEventListener('DOMContentLoaded', () => {
  const app = new PathfindingVisualizer();
  app.init();
});

class PathfindingVisualizer {
  constructor() {
    this.gridSizes = {
      small:  { cols: 15, rows: 15 },
      medium: { cols: 25, rows: 25 },
      large:  { cols: 35, rows: 35 },
      xlarge: { cols: 50, rows: 30 },
    };
    this.speeds = { slow: 60, medium: 25, fast: 5, instant: 0 };

    this.cols = 25;
    this.rows = 25;
    this.grid = [];
    this.startNode = null;
    this.endNode = null;
    this.isRunning = false;
    this.animationFrameId = null;
    this.tool = 'wall';
    this.isMouseDown = false;
    this.dragNode = null; // 'start' or 'end' when dragging those nodes
  }

  init() {
    this.cacheDOM();
    this.bindEvents();
    this.loadSettings();
    this.buildGrid();
  }

  cacheDOM() {
    this.gridEl = document.getElementById('grid');
    this.algorithmSelect = document.getElementById('algorithm-select');
    this.speedSelect = document.getElementById('speed-select');
    this.toolSelect = document.getElementById('tool-select');
    this.gridSizeSelect = document.getElementById('grid-size');
    this.btnVisualize = document.getElementById('btn-visualize');
    this.btnClearPath = document.getElementById('btn-clear-path');
    this.btnClearAll = document.getElementById('btn-clear-all');
    this.btnGenerateMaze = document.getElementById('btn-generate-maze');
    this.statVisited = document.getElementById('stat-visited');
    this.statPath = document.getElementById('stat-path');
    this.statCost = document.getElementById('stat-cost');
    this.statTime = document.getElementById('stat-time');
  }

  bindEvents() {
    this.btnVisualize.addEventListener('click', () => this.handleVisualize());
    this.btnClearPath.addEventListener('click', () => this.clearPath());
    this.btnClearAll.addEventListener('click', () => this.clearAll());
    this.btnGenerateMaze.addEventListener('click', () => this.generateMaze());

    this.gridSizeSelect.addEventListener('change', () => {
      this.saveSettings();
      const size = this.gridSizes[this.gridSizeSelect.value];
      this.cols = size.cols;
      this.rows = size.rows;
      this.buildGrid();
    });

    this.algorithmSelect.addEventListener('change', () => this.saveSettings());
    this.speedSelect.addEventListener('change', () => this.saveSettings());
    this.toolSelect.addEventListener('change', () => {
      this.tool = this.toolSelect.value;
      this.saveSettings();
    });

    // Grid mouse events
    this.gridEl.addEventListener('mousedown', (e) => this.onGridMouseDown(e));
    this.gridEl.addEventListener('mouseover', (e) => this.onGridMouseOver(e));
    document.addEventListener('mouseup', () => this.onMouseUp());

    // Touch support
    this.gridEl.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    this.gridEl.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    this.gridEl.addEventListener('touchend', () => this.onMouseUp());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.onKeyDown(e));

    // Prevent context menu on grid
    this.gridEl.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('pathfinder-settings'));
      if (saved) {
        if (saved.algorithm) this.algorithmSelect.value = saved.algorithm;
        if (saved.speed) this.speedSelect.value = saved.speed;
        if (saved.tool) { this.toolSelect.value = saved.tool; this.tool = saved.tool; }
        if (saved.gridSize) {
          this.gridSizeSelect.value = saved.gridSize;
          const size = this.gridSizes[saved.gridSize];
          if (size) { this.cols = size.cols; this.rows = size.rows; }
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('pathfinder-settings', JSON.stringify({
        algorithm: this.algorithmSelect.value,
        speed: this.speedSelect.value,
        tool: this.toolSelect.value,
        gridSize: this.gridSizeSelect.value,
      }));
    } catch {
      // storage full or unavailable
    }
  }

  // --- Grid ---

  buildGrid() {
    this.stopAnimation();
    this.grid = [];
    this.gridEl.innerHTML = '';
    this.gridEl.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    this.gridEl.style.gridTemplateRows = `repeat(${this.rows}, 1fr)`;

    // Size cells based on available width
    const containerWidth = this.gridEl.parentElement.clientWidth - 2; // border
    const cellSize = Math.floor(containerWidth / this.cols);
    this.gridEl.style.width = `${cellSize * this.cols + this.cols + 1}px`;

    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.setAttribute('role', 'gridcell');
        this.gridEl.appendChild(cell);
        row.push({ row: r, col: c, type: 'empty', weight: 1, el: cell });
      }
      this.grid.push(row);
    }

    // Default start and end
    const midRow = Math.floor(this.rows / 2);
    const startCol = Math.floor(this.cols / 4);
    const endCol = Math.floor((3 * this.cols) / 4);

    this.setStart(midRow, startCol);
    this.setEnd(midRow, endCol);
    this.resetStats();
  }

  getCell(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return this.grid[row][col];
  }

  setStart(row, col) {
    if (this.startNode) {
      this.startNode.type = 'empty';
      this.startNode.el.classList.remove('start');
    }
    const cell = this.getCell(row, col);
    if (!cell) return;
    cell.type = 'start';
    cell.weight = 1;
    cell.el.className = 'cell start';
    this.startNode = cell;
  }

  setEnd(row, col) {
    if (this.endNode) {
      this.endNode.type = 'empty';
      this.endNode.el.classList.remove('end');
    }
    const cell = this.getCell(row, col);
    if (!cell) return;
    cell.type = 'end';
    cell.weight = 1;
    cell.el.className = 'cell end';
    this.endNode = cell;
  }

  applyTool(row, col) {
    const cell = this.getCell(row, col);
    if (!cell) return;

    // Don't overwrite start/end unless using start/end tool
    if (cell.type === 'start' && this.tool !== 'start' && this.tool !== 'eraser') return;
    if (cell.type === 'end' && this.tool !== 'end' && this.tool !== 'eraser') return;

    this.clearPath();

    switch (this.tool) {
      case 'wall':
        if (cell.type === 'start' || cell.type === 'end') return;
        cell.type = 'wall';
        cell.weight = 1;
        cell.el.className = 'cell wall';
        break;
      case 'weight':
        if (cell.type === 'start' || cell.type === 'end') return;
        cell.type = 'weight';
        cell.weight = 5;
        cell.el.className = 'cell weight';
        break;
      case 'start':
        this.setStart(row, col);
        break;
      case 'end':
        this.setEnd(row, col);
        break;
      case 'eraser':
        if (cell.type === 'start' || cell.type === 'end') return;
        cell.type = 'empty';
        cell.weight = 1;
        cell.el.className = 'cell';
        break;
    }
  }

  // --- Mouse / Touch Handling ---

  getCellFromEvent(e) {
    const target = e.target.closest('.cell');
    if (!target) return null;
    return { row: +target.dataset.row, col: +target.dataset.col };
  }

  onGridMouseDown(e) {
    if (this.isRunning) return;
    e.preventDefault();
    this.isMouseDown = true;

    const pos = this.getCellFromEvent(e);
    if (!pos) return;
    const cell = this.getCell(pos.row, pos.col);

    // Drag start/end nodes
    if (cell.type === 'start') {
      this.dragNode = 'start';
      return;
    }
    if (cell.type === 'end') {
      this.dragNode = 'end';
      return;
    }

    this.applyTool(pos.row, pos.col);
  }

  onGridMouseOver(e) {
    if (!this.isMouseDown || this.isRunning) return;
    const pos = this.getCellFromEvent(e);
    if (!pos) return;

    if (this.dragNode === 'start') {
      const cell = this.getCell(pos.row, pos.col);
      if (cell && cell.type !== 'end' && cell.type !== 'wall') {
        this.setStart(pos.row, pos.col);
      }
      return;
    }
    if (this.dragNode === 'end') {
      const cell = this.getCell(pos.row, pos.col);
      if (cell && cell.type !== 'start' && cell.type !== 'wall') {
        this.setEnd(pos.row, pos.col);
      }
      return;
    }

    this.applyTool(pos.row, pos.col);
  }

  onMouseUp() {
    this.isMouseDown = false;
    this.dragNode = null;
  }

  onTouchStart(e) {
    if (this.isRunning) return;
    e.preventDefault();
    this.isMouseDown = true;
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target || !target.classList.contains('cell')) return;
    const row = +target.dataset.row;
    const col = +target.dataset.col;
    const cell = this.getCell(row, col);

    if (cell.type === 'start') { this.dragNode = 'start'; return; }
    if (cell.type === 'end') { this.dragNode = 'end'; return; }

    this.applyTool(row, col);
  }

  onTouchMove(e) {
    if (!this.isMouseDown || this.isRunning) return;
    e.preventDefault();
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target || !target.classList.contains('cell')) return;
    const row = +target.dataset.row;
    const col = +target.dataset.col;

    if (this.dragNode === 'start') {
      const cell = this.getCell(row, col);
      if (cell && cell.type !== 'end' && cell.type !== 'wall') this.setStart(row, col);
      return;
    }
    if (this.dragNode === 'end') {
      const cell = this.getCell(row, col);
      if (cell && cell.type !== 'start' && cell.type !== 'wall') this.setEnd(row, col);
      return;
    }

    this.applyTool(row, col);
  }

  // --- Keyboard ---

  onKeyDown(e) {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;

    switch (e.key) {
      case '1': this.algorithmSelect.value = 'astar'; this.saveSettings(); break;
      case '2': this.algorithmSelect.value = 'dijkstra'; this.saveSettings(); break;
      case '3': this.algorithmSelect.value = 'bfs'; this.saveSettings(); break;
      case '4': this.algorithmSelect.value = 'dfs'; this.saveSettings(); break;
      case 'w': case 'W': this.toolSelect.value = 'wall'; this.tool = 'wall'; this.saveSettings(); break;
      case 'g': case 'G': this.toolSelect.value = 'weight'; this.tool = 'weight'; this.saveSettings(); break;
      case 's': case 'S': this.toolSelect.value = 'start'; this.tool = 'start'; this.saveSettings(); break;
      case 'e': case 'E': this.toolSelect.value = 'end'; this.tool = 'end'; this.saveSettings(); break;
      case 'x': case 'X': this.toolSelect.value = 'eraser'; this.tool = 'eraser'; this.saveSettings(); break;
      case 'Enter': e.preventDefault(); this.handleVisualize(); break;
      case 'c':
        if (e.shiftKey) this.clearAll();
        else this.clearPath();
        break;
      case 'C':
        this.clearAll();
        break;
      case 'm': case 'M': this.generateMaze(); break;
    }
  }

  // --- Clear ---

  clearPath() {
    this.stopAnimation();
    for (const row of this.grid) {
      for (const cell of row) {
        cell.el.classList.remove('visited', 'path');
      }
    }
    this.resetStats();
  }

  clearAll() {
    this.stopAnimation();
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell.type === 'start' || cell.type === 'end') continue;
        cell.type = 'empty';
        cell.weight = 1;
        cell.el.className = 'cell';
      }
    }
    this.resetStats();
  }

  resetStats() {
    this.statVisited.textContent = '0';
    this.statPath.textContent = '0';
    this.statCost.textContent = '0';
    this.statTime.textContent = '0ms';
  }

  stopAnimation() {
    this.isRunning = false;
    this.btnVisualize.classList.remove('running');
    this.btnVisualize.querySelector('.btn-icon').innerHTML = '&#9654;';
    this.btnVisualize.childNodes[1].textContent = ' Visualize';
    this.setControlsDisabled(false);
  }

  setControlsDisabled(disabled) {
    this.btnClearAll.disabled = disabled;
    this.btnGenerateMaze.disabled = disabled;
    this.gridSizeSelect.disabled = disabled;
  }

  // --- Maze Generation (Recursive Division) ---

  generateMaze() {
    if (this.isRunning) return;
    this.clearAll();

    // Fill border walls
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.getCell(r, c);
        if (cell.type === 'start' || cell.type === 'end') continue;
        if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) {
          cell.type = 'wall';
          cell.el.className = 'cell wall';
        }
      }
    }

    this.recursiveDivision(1, this.rows - 2, 1, this.cols - 2);
  }

  recursiveDivision(rowStart, rowEnd, colStart, colEnd) {
    const height = rowEnd - rowStart + 1;
    const width = colEnd - colStart + 1;
    if (height < 3 || width < 3) return;

    const horizontal = height > width;

    if (horizontal) {
      // Place horizontal wall
      const possibleRows = [];
      for (let r = rowStart + 1; r < rowEnd; r += 1) {
        if (r % 2 === 0) possibleRows.push(r);
      }
      if (possibleRows.length === 0) return;
      const wallRow = possibleRows[Math.floor(Math.random() * possibleRows.length)];
      const passage = this.randomOdd(colStart, colEnd);

      for (let c = colStart; c <= colEnd; c++) {
        if (c === passage) continue;
        const cell = this.getCell(wallRow, c);
        if (cell && cell.type !== 'start' && cell.type !== 'end') {
          cell.type = 'wall';
          cell.el.className = 'cell wall';
        }
      }

      this.recursiveDivision(rowStart, wallRow - 1, colStart, colEnd);
      this.recursiveDivision(wallRow + 1, rowEnd, colStart, colEnd);
    } else {
      // Place vertical wall
      const possibleCols = [];
      for (let c = colStart + 1; c < colEnd; c += 1) {
        if (c % 2 === 0) possibleCols.push(c);
      }
      if (possibleCols.length === 0) return;
      const wallCol = possibleCols[Math.floor(Math.random() * possibleCols.length)];
      const passage = this.randomOdd(rowStart, rowEnd);

      for (let r = rowStart; r <= rowEnd; r++) {
        if (r === passage) continue;
        const cell = this.getCell(r, wallCol);
        if (cell && cell.type !== 'start' && cell.type !== 'end') {
          cell.type = 'wall';
          cell.el.className = 'cell wall';
        }
      }

      this.recursiveDivision(rowStart, rowEnd, colStart, wallCol - 1);
      this.recursiveDivision(rowStart, rowEnd, wallCol + 1, colEnd);
    }
  }

  randomOdd(min, max) {
    const odds = [];
    for (let i = min; i <= max; i++) {
      if (i % 2 === 1) odds.push(i);
    }
    return odds.length > 0 ? odds[Math.floor(Math.random() * odds.length)] : min;
  }

  // --- Visualization ---

  async handleVisualize() {
    if (this.isRunning) {
      this.stopAnimation();
      return;
    }

    if (!this.startNode || !this.endNode) return;

    this.clearPath();
    this.isRunning = true;
    this.btnVisualize.classList.add('running');
    this.btnVisualize.querySelector('.btn-icon').innerHTML = '&#9632;';
    this.btnVisualize.childNodes[1].textContent = ' Stop';
    this.setControlsDisabled(true);

    const algorithm = this.algorithmSelect.value;
    const speed = this.speeds[this.speedSelect.value];

    const startTime = performance.now();
    let result;

    switch (algorithm) {
      case 'astar':   result = this.astar(); break;
      case 'dijkstra': result = this.dijkstra(); break;
      case 'bfs':     result = this.bfs(); break;
      case 'dfs':     result = this.dfs(); break;
    }

    const elapsed = performance.now() - startTime;

    if (!result) {
      this.stopAnimation();
      return;
    }

    const { visited, path, cost } = result;

    // Animate visited
    await this.animateCells(visited, 'visited', speed);
    if (!this.isRunning) return;

    // Animate path
    const pathSpeed = speed === 0 ? 0 : Math.max(speed, 30);
    await this.animateCells(path, 'path', pathSpeed);

    // Update stats
    this.statVisited.textContent = visited.length;
    this.statPath.textContent = path.length;
    this.statCost.textContent = cost;
    this.statTime.textContent = `${elapsed.toFixed(1)}ms`;

    this.stopAnimation();
  }

  animateCells(cells, className, speed) {
    return new Promise((resolve) => {
      if (speed === 0) {
        for (const cell of cells) {
          if (cell.type !== 'start' && cell.type !== 'end') {
            cell.el.classList.add(className);
          }
        }
        resolve();
        return;
      }

      let i = 0;
      const step = () => {
        if (!this.isRunning || i >= cells.length) {
          resolve();
          return;
        }
        const batch = Math.max(1, Math.floor(3 / (speed / 10)));
        for (let b = 0; b < batch && i < cells.length; b++, i++) {
          const cell = cells[i];
          if (cell.type !== 'start' && cell.type !== 'end') {
            cell.el.classList.add(className);
          }
        }
        this.animationFrameId = setTimeout(step, speed);
      };
      step();
    });
  }

  // --- Algorithm Helpers ---

  getNeighbors(cell) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const neighbors = [];
    for (const [dr, dc] of dirs) {
      const n = this.getCell(cell.row + dr, cell.col + dc);
      if (n && n.type !== 'wall') {
        neighbors.push(n);
      }
    }
    return neighbors;
  }

  reconstructPath(cameFrom, endCell) {
    const path = [];
    let current = endCell;
    while (current) {
      path.unshift(current);
      current = cameFrom.get(current);
    }
    return path;
  }

  heuristic(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  }

  // --- A* ---

  astar() {
    const openSet = new MinHeap((a, b) => a.f - b.f);
    const cameFrom = new Map();
    const gScore = new Map();
    const visited = [];

    gScore.set(this.startNode, 0);
    openSet.push({ cell: this.startNode, f: this.heuristic(this.startNode, this.endNode) });

    while (openSet.size() > 0) {
      const { cell: current } = openSet.pop();

      if (current === this.endNode) {
        const path = this.reconstructPath(cameFrom, this.endNode);
        return { visited, path, cost: gScore.get(this.endNode) };
      }

      if (current.type !== 'start' && current.type !== 'end') {
        if (visited.includes(current)) continue;
        visited.push(current);
      }

      for (const neighbor of this.getNeighbors(current)) {
        const tentativeG = gScore.get(current) + neighbor.weight;
        if (!gScore.has(neighbor) || tentativeG < gScore.get(neighbor)) {
          cameFrom.set(neighbor, current);
          gScore.set(neighbor, tentativeG);
          const f = tentativeG + this.heuristic(neighbor, this.endNode);
          openSet.push({ cell: neighbor, f });
        }
      }
    }

    return { visited, path: [], cost: 0 };
  }

  // --- Dijkstra ---

  dijkstra() {
    const openSet = new MinHeap((a, b) => a.dist - b.dist);
    const cameFrom = new Map();
    const dist = new Map();
    const visited = [];
    const visitedSet = new Set();

    dist.set(this.startNode, 0);
    openSet.push({ cell: this.startNode, dist: 0 });

    while (openSet.size() > 0) {
      const { cell: current } = openSet.pop();

      if (visitedSet.has(current)) continue;
      visitedSet.add(current);

      if (current !== this.startNode && current !== this.endNode) {
        visited.push(current);
      }

      if (current === this.endNode) {
        const path = this.reconstructPath(cameFrom, this.endNode);
        return { visited, path, cost: dist.get(this.endNode) };
      }

      for (const neighbor of this.getNeighbors(current)) {
        if (visitedSet.has(neighbor)) continue;
        const newDist = dist.get(current) + neighbor.weight;
        if (!dist.has(neighbor) || newDist < dist.get(neighbor)) {
          cameFrom.set(neighbor, current);
          dist.set(neighbor, newDist);
          openSet.push({ cell: neighbor, dist: newDist });
        }
      }
    }

    return { visited, path: [], cost: 0 };
  }

  // --- BFS ---

  bfs() {
    const queue = [this.startNode];
    const cameFrom = new Map();
    const visitedSet = new Set([this.startNode]);
    const visited = [];

    while (queue.length > 0) {
      const current = queue.shift();

      if (current !== this.startNode && current !== this.endNode) {
        visited.push(current);
      }

      if (current === this.endNode) {
        const path = this.reconstructPath(cameFrom, this.endNode);
        return { visited, path, cost: path.length - 1 };
      }

      for (const neighbor of this.getNeighbors(current)) {
        if (visitedSet.has(neighbor)) continue;
        visitedSet.add(neighbor);
        cameFrom.set(neighbor, current);
        queue.push(neighbor);
      }
    }

    return { visited, path: [], cost: 0 };
  }

  // --- DFS ---

  dfs() {
    const stack = [this.startNode];
    const cameFrom = new Map();
    const visitedSet = new Set();
    const visited = [];

    while (stack.length > 0) {
      const current = stack.pop();

      if (visitedSet.has(current)) continue;
      visitedSet.add(current);

      if (current !== this.startNode && current !== this.endNode) {
        visited.push(current);
      }

      if (current === this.endNode) {
        const path = this.reconstructPath(cameFrom, this.endNode);
        return { visited, path, cost: path.length - 1 };
      }

      const neighbors = this.getNeighbors(current);
      for (let i = neighbors.length - 1; i >= 0; i--) {
        const neighbor = neighbors[i];
        if (!visitedSet.has(neighbor)) {
          cameFrom.set(neighbor, current);
          stack.push(neighbor);
        }
      }
    }

    return { visited, path: [], cost: 0 };
  }
}

// --- MinHeap (Priority Queue) ---

class MinHeap {
  constructor(comparator) {
    this.data = [];
    this.cmp = comparator;
  }

  size() { return this.data.length; }

  push(val) {
    this.data.push(val);
    this.bubbleUp(this.data.length - 1);
  }

  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.cmp(this.data[i], this.data[parent]) < 0) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else break;
    }
  }

  sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.cmp(this.data[left], this.data[smallest]) < 0) smallest = left;
      if (right < n && this.cmp(this.data[right], this.data[smallest]) < 0) smallest = right;
      if (smallest !== i) {
        [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
        i = smallest;
      } else break;
    }
  }
}
