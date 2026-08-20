/* ============================================================
   Copié tel quel depuis le design system Coucou Simon,
   assets/motifs/triangles-live.js. Ne pas modifier ici :
   corriger à la source, puis recopier.
   ------------------------------------------------------------
   COUCOU SIMON — Motif triangles ANIMÉ (« sommets flottants »)
   -----------------------------------------------------------
   <cs-triangles-live variant="blue|ink|light" speed="1">
   Web component autonome. Le maillage n'est PAS une grille : il
   reprend la triangulation irrégulière maison des SVG de bannière
   (assets/motifs/triangles-mesh.js → window.CS_TRI_MESH), donc la
   distribution des facettes et les teintes sont identiques au motif
   statique. Chaque SOMMET dérive légèrement (sinus déphasé) — les
   facettes respirent. Comme les sommets sont partagés entre triangles,
   le maillage reste sommet-à-sommet : aucun trou, aucune jonction en T,
   que des triangles. Se fige sur prefers-reduced-motion.
   ============================================================ */
(() => {
  if (customElements.get("cs-triangles-live")) return;
  const EPS = 0.5;

  // Comment le mouvement est modélisé : chaque SOMMET oscille autour de sa
  // position d'origine (sin sur x, cos sur y), avec phase/fréquence propres.
  // L'amplitude est bornée localement (voir buildMesh) pour qu'un sommet ne
  // franchisse jamais un côté et n'écrase jamais une facette.

  class TrianglesLive extends HTMLElement {
    connectedCallback() {
      this.canvas = document.createElement("canvas");
      Object.assign(this.canvas.style, { display: "block", width: "100%", height: "100%" });
      Object.assign(this.style, { display: "block", position: "relative", overflow: "hidden" });
      this.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");
      this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

      this.buildMesh();
      this.ro = new ResizeObserver(() => this.layout());
      this.ro.observe(this);
      this.layout();
      this.start();
    }
    disconnectedCallback() { this.stop(); this.ro && this.ro.disconnect(); }

    get speed() { return parseFloat(this.getAttribute("speed")) || 1; }

    buildMesh() {
      const mesh = (window.CS_TRI_MESH || {})[this.getAttribute("variant")] || (window.CS_TRI_MESH || {}).blue;
      if (!mesh) { this.mesh = null; return; }
      this.W = mesh.W; this.H = mesh.H;
      this.pal = mesh.pal; this.tris = mesh.tris;
      // Distance au plus proche voisin CONNECTÉ, par sommet — borne locale
      // du mouvement. L'amplitude ne dépasse jamais une petite fraction de
      // cette distance : un sommet ne peut donc ni rejoindre un voisin, ni
      // franchir un côté adjacent (pas de repli, pas de désolidarisation),
      // quelle que soit la taille de la facette.
      const V = mesh.verts;
      const minEdge = V.map(() => Infinity);
      // « Clairance » d'un sommet = plus petite HAUTEUR de triangle mesurée
      // DEPUIS ce sommet (distance au côté opposé), sur toutes ses facettes.
      // C'est la marge avant écrasement (angle → 180°) : si une facette est
      // déjà fine, la hauteur est petite → le sommet bouge très peu. On borne
      // aussi par la plus courte arête pour ne jamais rejoindre un voisin.
      const clear = V.map(() => Infinity);
      const consider = (i, j) => {
        const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1]);
        if (d < minEdge[i]) minEdge[i] = d;
        if (d < minEdge[j]) minEdge[j] = d;
      };
      const height = (a, b, c) => { // hauteur depuis a (côté opposé b-c)
        const area2 = Math.abs((V[b][0] - V[a][0]) * (V[c][1] - V[a][1]) - (V[c][0] - V[a][0]) * (V[b][1] - V[a][1]));
        const opp = Math.hypot(V[c][0] - V[b][0], V[c][1] - V[b][1]);
        return opp > 1e-6 ? area2 / opp : 0;
      };
      for (const [a, b, c] of this.tris) {
        consider(a, b); consider(b, c); consider(c, a);
        clear[a] = Math.min(clear[a], height(a, b, c));
        clear[b] = Math.min(clear[b], height(b, c, a));
        clear[c] = Math.min(clear[c], height(c, a, b));
      }
      this.verts = V.map(([x, y], k) => {
        const onL = x <= EPS, onR = x >= this.W - EPS;
        const onT = y <= EPS, onB = y >= this.H - EPS;
        // Amplitude pilotée par la clairance (hauteur mini) → grande dans
        // les facettes larges, quasi-nulle près d'un écrasement ; plafonnée
        // par la plus courte arête pour rester bien séparé des voisins.
        const room = Math.min(isFinite(clear[k]) ? clear[k] : this.W * 0.1,
                              (isFinite(minEdge[k]) ? minEdge[k] : this.W * 0.05) * 0.6);
        const amp = room * 0.34;
        return {
          x, y,
          ax: (onL || onR) ? 0 : amp,
          ay: (onT || onB) ? 0 : amp,
          px: Math.random() * Math.PI * 2, py: Math.random() * Math.PI * 2,
          fx: 0.5 + Math.random() * 0.6, fy: 0.5 + Math.random() * 0.6,
        };
      });
    }

    layout() {
      const rect = this.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, Math.round(rect.width));
      this.h = Math.max(1, Math.round(rect.height));
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.mesh === null || !this.verts) return;
      // « cover » : le maillage remplit toute la surface sans déformation.
      this.scale = Math.max(this.w / this.W, this.h / this.H);
      this.ox = (this.w - this.W * this.scale) / 2;
      this.oy = (this.h - this.H * this.scale) / 2;
      if (this.reduced) this.draw(0);
    }

    start() {
      if (this.reduced || !this.verts) return;
      const t0 = performance.now();
      const loop = (now) => { this.draw((now - t0) / 1000); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    }
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }

    draw(t) {
      if (!this.verts) return;
      const ctx = this.ctx, s = t * this.speed * 0.55, sc = this.scale, ox = this.ox, oy = this.oy;
      // position écran de chaque sommet (drift sinusoïdal + cover)
      const P = this.verts.map((v) => [
        ox + (v.x + Math.sin(s * v.fx + v.px) * v.ax) * sc,
        oy + (v.y + Math.cos(s * v.fy + v.py) * v.ay) * sc,
      ]);
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.lineJoin = "round";
      for (const [a, b, c, ci] of this.tris) {
        const fill = this.pal[ci];
        ctx.beginPath();
        ctx.moveTo(P[a][0], P[a][1]);
        ctx.lineTo(P[b][0], P[b][1]);
        ctx.lineTo(P[c][0], P[c][1]);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        // hairline même teinte → soude le liseré anti-aliasé entre facettes.
        ctx.strokeStyle = fill; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  }

  customElements.define("cs-triangles-live", TrianglesLive);
})();
