# Pathfinding Algorithm Visualizer

An interactive visualizer for classic pathfinding algorithms on a customizable grid. Draw walls and weighted nodes, pick an algorithm, and watch it explore the grid in real time.

## Features

- **4 Algorithms**: A* Search, Dijkstra's, Breadth-First Search (BFS), Depth-First Search (DFS)
- **Interactive Grid**: Click and drag to place walls, weights, or move start/end nodes
- **Weighted Nodes**: Add weight-5 nodes to test algorithms that account for edge cost (A*, Dijkstra)
- **Maze Generation**: One-click recursive division maze generation
- **Speed Control**: Slow, Medium, Fast, and Instant visualization speeds
- **Adjustable Grid Size**: Small (15x15), Medium (25x25), Large (35x35), XL (50x30)
- **Live Statistics**: Visited node count, path length, path cost, and algorithm execution time
- **Drag Start/End**: Click and drag the green (start) or red (end) node to reposition
- **Persistent Settings**: Algorithm, speed, tool, and grid size saved to localStorage
- **Touch Support**: Full touch event support for mobile devices
- **Responsive Design**: Works on desktop, tablet, and mobile screens
- **Dark Theme**: Modern dark UI with smooth animations

## Getting Started

```bash
# Clone the repo
git clone https://github.com/JASSBR/pathfinding-visualizer.git
cd pathfinding-visualizer

# Open in browser
open index.html
```

No build tools or dependencies required — just open `index.html` in any modern browser.

## Usage

1. **Select an algorithm** from the dropdown (or press 1-4)
2. **Choose a tool** — Wall, Weight, Start, End, or Eraser
3. **Draw on the grid** by clicking and dragging
4. **Drag the start/end nodes** to reposition them
5. Click **Visualize** (or press Enter) to run the algorithm
6. Watch the exploration (blue) and shortest path (yellow) animate
7. Use **Generate Maze** for a quick maze to solve

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Select A* Search |
| `2` | Select Dijkstra's |
| `3` | Select BFS |
| `4` | Select DFS |
| `W` | Wall tool |
| `G` | Weight tool |
| `S` | Start node tool |
| `E` | End node tool |
| `X` | Eraser tool |
| `Enter` | Visualize / Stop |
| `C` | Clear path |
| `Shift+C` | Clear all |
| `M` | Generate maze |

## Algorithm Notes

| Algorithm | Weighted | Guarantees Shortest Path |
|-----------|----------|--------------------------|
| A* | Yes | Yes |
| Dijkstra | Yes | Yes |
| BFS | No | Yes (unweighted) |
| DFS | No | No |

## Project Structure

```
index.html        — Main HTML page
src/app.js        — All application logic and algorithms
src/style.css     — Styles and animations
CLAUDE.md         — Project instructions
```

## Screenshots

_Open index.html in a browser to see the visualizer in action._

## License

MIT

---

Built as part of my **Daily Project Challenge** — Day 1
