// e0engine: a tiny ASCII raycaster hidden in the contact terminal (`./do-not-run`).
// One ray per text column (DDA, Wolfenstein-style), walls shaded by distance with block
// characters, perspective corrected for the character cell's aspect ratio.

(() => {
  const MAP = [
    "################",
    "#..#.......#...#",
    "#..#.###.#.#.#.#",
    "#....#...#...#.#",
    "####.#.#####.#.#",
    "#....#.....#.#.#",
    "#.####.###.#...#",
    "#......#...###.#",
    "#.######.#...#.#",
    "#.#......#.#.#.#",
    "#.#.######.#.#.#",
    "#...#......#...#",
    "###.#.######.###",
    "#...#......#...#",
    "#.#######..#..E#",
    "################",
  ];
  const START = { x: 1.5, y: 1.5, a: Math.PI / 2 };
  const FOV_PLANE = 0.66;                       // camera plane half-length (≈66° FOV)
  const WALL_A = "@%#*+=-:.", WALL_B = "%#*+=-:.."; // near → far; the B side is a step darker
  const MAXD = 10;

  const cell = (x, y) => (MAP[y | 0] || "#")[x | 0] || "#";
  const solid = (x, y) => cell(x, y) !== ".";
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  function start(host, { onExit, sound } = {}) {
    const pre = document.createElement("pre");
    pre.className = "rc";
    pre.setAttribute("aria-label", "ASCII raycaster game. Arrow keys or WASD to move, Escape to quit.");
    host.appendChild(pre);

    // Character cell size of the current font
    const probe = document.createElement("span");
    probe.textContent = "M".repeat(50);
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
    pre.appendChild(probe);
    const cw = probe.getBoundingClientRect().width / 50;
    const ch = parseFloat(getComputedStyle(pre).lineHeight) || cw * 1.9;
    probe.remove();

    let cols = 80, rows = 30;
    const fit = () => {
      const cs = getComputedStyle(pre);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      cols = Math.max(40, Math.min(160, Math.floor((host.clientWidth - padX) / cw)));
      rows = Math.max(16, Math.min(60, Math.floor((host.clientHeight - padY) / ch)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);

    const P = { ...START };
    const keys = new Set();
    const pad = { mx: 0, my: 0, turn: 0 };
    let won = false, t0 = performance.now(), last = t0, raf = 0, ft = 16.7;

    function step(dt) {
      if (won) return;
      const fwd = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - pad.my;
      const strafe = (keys.has("e") ? 1 : 0) - (keys.has("q") ? 1 : 0) + pad.mx;
      const turn = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0) + pad.turn;
      P.a += turn * 2.4 * dt;
      const sp = 2.6 * dt, dx = Math.cos(P.a), dy = Math.sin(P.a);
      const vx = (dx * fwd - dy * strafe) * sp, vy = (dy * fwd + dx * strafe) * sp;
      const r = .22;  // collision radius; slide along walls by resolving axes separately
      const hitX = cell(P.x + vx + Math.sign(vx) * r, P.y), hitY = cell(P.x, P.y + vy + Math.sign(vy) * r);
      if (hitX === "E" || hitY === "E") return win();
      if (hitX === ".") P.x += vx;
      if (hitY === ".") P.y += vy;
    }

    function win() {
      won = true;
      sound?.("start");
      const s = ((performance.now() - t0) / 1000).toFixed(1);
      setTimeout(() => stop(`exit found in ${s}s. You really shouldn't have run that.`), 1600);
    }

    function render() {
      const W = cols * cw, H = rows * ch;
      const proj = (W / 2) / FOV_PLANE;           // pixel distance to the projection plane
      const dx = Math.cos(P.a), dy = Math.sin(P.a);
      const px = -dy * FOV_PLANE, py = dx * FOV_PLANE;
      const grid = Array.from({ length: rows }, () => new Array(cols));
      const cls = Array.from({ length: rows }, () => new Array(cols));
      const half = rows / 2;
      for (let c = 0; c < cols; c++) {
        const cam = 2 * c / cols - 1;
        const rx = dx + px * cam, ry = dy + py * cam;
        let mx = P.x | 0, my = P.y | 0;
        const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry);
        const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
        let sdx = (rx < 0 ? P.x - mx : mx + 1 - P.x) * ddx, sdy = (ry < 0 ? P.y - my : my + 1 - P.y) * ddy;
        let side = 0, hit = ".";
        for (let i = 0; i < 64 && hit === "."; i++) {
          if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
          hit = cell(mx, my);
        }
        const dist = Math.max(.05, side === 0 ? sdx - ddx : sdy - ddy);
        const hRows = (proj / dist) / ch;
        const top = Math.round(half - hRows / 2), bot = Math.round(half + hRows / 2);
        const set = side ? WALL_B : WALL_A;
        const shade = set[Math.min(set.length - 1, Math.floor(Math.pow(dist / MAXD, .8) * set.length))];
        // Texture coordinate along the wall, for the EXIT door pattern
        const wx = side === 0 ? P.y + dist * ry : P.x + dist * rx;
        const u = wx - Math.floor(wx);
        for (let r = 0; r < rows; r++) {
          if (r < top) { grid[r][c] = " "; cls[r][c] = 0; }
          else if (r < bot) {
            if (hit === "E") {
              const v = (r - top) / Math.max(1, bot - top);
              const frame = u < .08 || u > .92 || v < .06 || v > .94;
              grid[r][c] = frame ? "#" : (v > .42 && v < .58 && u > .2 && u < .8) ? "EXIT"[Math.floor((u - .2) / .6 * 4) % 4] : "+";
              cls[r][c] = 2;
            } else { grid[r][c] = shade; cls[r][c] = 1; }
          } else {
            grid[r][c] = " "; cls[r][c] = 0;        // floor left empty, like the ceiling
          }
        }
      }
      // Minimap (top-left) and HUD (bottom)
      const mm = MAP.map((row, y) => row.replace(/\./g, " ").split(""));
      const ax = P.x | 0, ay = P.y | 0;
      const arrows = "→↘↓↙←↖↑↗";
      mm[ay][ax] = arrows[((Math.round(P.a / (Math.PI / 4)) % 8) + 8) % 8];
      for (let y = 0; y < mm.length && y + 1 < rows; y++)
        for (let x = 0; x < mm[y].length && x + 1 < cols; x++) {
          const v = mm[y][x]; grid[y + 1][x + 1] = v === "#" ? "▪" : v === "E" ? "E" : v; cls[y + 1][x + 1] = v === "E" ? 2 : 4;
        }
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      const full = ` e0engine · ${ft.toFixed(1)}ms · ${secs}s · WASD/arrows move · Q/E strafe · Esc quit · find the EXIT `;
      const hud = won ? "  ★ EXIT FOUND ★  " : full.length <= cols ? full : ` ${secs}s · WASD move · Esc quit `;
      const hy = rows - 1, hx = Math.max(0, Math.floor((cols - hud.length) / 2));
      for (let i = 0; i < hud.length && hx + i < cols; i++) { grid[hy][hx + i] = hud[i]; cls[hy][hx + i] = 5; }
      // Emit as runs of styled spans
      let html = "";
      const names = ["", "w", "x", "f", "m", "h"];
      for (let r = 0; r < rows; r++) {
        let run = "", rc = cls[r][0];
        for (let c = 0; c < cols; c++) {
          if (cls[r][c] !== rc) { html += rc ? `<span class="rc-${names[rc]}">${esc(run)}</span>` : esc(run); run = ""; rc = cls[r][c]; }
          run += grid[r][c];
        }
        html += (rc ? `<span class="rc-${names[rc]}">${esc(run)}</span>` : esc(run)) + "\n";
      }
      pre.innerHTML = html;
    }

    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      ft += ((now - (frame.prev || now)) - ft) * .1; frame.prev = now;
      step(dt);
      render();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    let stopped = false;
    function stop(message) {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf); ro.disconnect(); pre.remove();
      onExit?.(message);
    }

    return {
      key(e, down) {
        const k = e.key.toLowerCase();
        if (down && (k === "escape")) { e.preventDefault(); return stop("e0engine terminated."); }
        if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
          e.preventDefault();
          down ? keys.add(k) : keys.delete(k);
        }
      },
      pad(p) {
        const dz = (v) => (Math.abs(v) < .2 ? 0 : v);
        pad.mx = dz(p.axes[0] || 0); pad.my = dz(p.axes[1] || 0); pad.turn = dz(p.axes[2] || 0);
        const btn = (i) => p.buttons[i]?.pressed;
        if (btn(12)) pad.my = -1; if (btn(13)) pad.my = 1; if (btn(14)) pad.turn = -1; if (btn(15)) pad.turn = 1;
        if (btn(1)) stop("e0engine terminated.");
      },
      stop,
    };
  }

  window.E0Raycaster = { start };
})();
