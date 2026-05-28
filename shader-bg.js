/* ============================================================
   <shader-bg>  plasma WebGL background — all values hardcoded.
   URL ?bg=animated|static|solid overrides tier detection.
   ============================================================ */

(function () {

  function detectTier() {
    const forced = new URLSearchParams(location.search).get("bg");
    if (forced === "animated" || forced === "static" || forced === "solid") return forced;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "static";
    if (navigator.connection && navigator.connection.saveData) return "solid";
    const mem   = navigator.deviceMemory       || 4;
    const cores = navigator.hardwareConcurrency || 4;
    if (mem <= 1 || cores <= 2) return "solid";
    let gl = null;
    try {
      const c = document.createElement("canvas");
      gl = c.getContext("webgl", { failIfMajorPerformanceCaveat: true })
         || c.getContext("experimental-webgl", { failIfMajorPerformanceCaveat: true });
    } catch (_) {}
    if (!gl) return "static";
    const isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
    if (isTouch && mem <= 2) return "static";
    return "animated";
  }

  class ShaderBg extends HTMLElement {
    constructor() {
      super();
      this._mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, hover: 0, thover: 0 };
      this._time  = 0;
      this._raf   = null;
      this._tier  = detectTier();
      this._accent  = [0.227, 0.478, 0.996]; // #3a7afe
      this._accent2 = [0.973, 0.882, 0.471]; // #f8e178
      this._accent3 = [0.99, 0.19, 0.99]; // rgb(0, 255, 21)
      this._isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
      this._dpr = Math.min(window.devicePixelRatio || 1, this._isTouch ? 2 : 1.5);
    }

    connectedCallback() {
      this.dataset.tier = this._tier;

      if (this._tier === "solid") {
        this.style.background = "";
        return;
      }

      if (this._tier === "static") {
        this._renderStatic();
        this._onResizeStatic = () => this._renderStatic();
        window.addEventListener("resize", this._onResizeStatic, { passive: true });
        return;
      }

      // animated
      this.canvas = document.createElement("canvas");
      this.appendChild(this.canvas);
      this._gl = this._initGL();
      if (!this._gl) {
        // runtime GL failure — downgrade
        this.canvas.remove(); this.canvas = null;
        this._tier = "static"; this.dataset.tier = "static";
        this._renderStatic();
        this._onResizeStatic = () => this._renderStatic();
        window.addEventListener("resize", this._onResizeStatic, { passive: true });
        return;
      }

      this._onResize     = this._onResize.bind(this);
      this._onMouse      = this._onMouse.bind(this);
      this._onLeave      = this._onLeave.bind(this);
      this._onVisibility = this._onVisibility.bind(this);
      window.addEventListener("resize",       this._onResize,     { passive: true });
      window.addEventListener("pointermove",  this._onMouse,      { passive: true });
      window.addEventListener("pointerleave", this._onLeave,      { passive: true });
      window.addEventListener("blur",         this._onLeave,      { passive: true });
      document.addEventListener("visibilitychange", this._onVisibility);
      this._onResize();
      this._loop = this._loop.bind(this);
      this._raf  = requestAnimationFrame(this._loop);
    }

    _onVisibility() {
      if (document.hidden) {
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
      } else {
        if (!this._raf) this._raf = requestAnimationFrame(this._loop);
      }
    }

    disconnectedCallback() {
      this._teardown();
    }

    setTier(t) {
      if (t !== "animated" && t !== "static" && t !== "solid") return;
      if (t === this._tier) return;
      this._teardown();
      this._tier = t; this.dataset.tier = t;
      this.style.background = "";
      if (this.isConnected) this.connectedCallback();
    }

    _teardown() {
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
      if (this.canvas) { this.canvas.remove(); this.canvas = null; }
      if (this._onResize) {
        window.removeEventListener("resize", this._onResize);
      }
      if (this._onResizeStatic) {
        window.removeEventListener("resize", this._onResizeStatic);
        this._onResizeStatic = null;
      }
      if (this._onMouse) {
        window.removeEventListener("pointermove", this._onMouse);
      }
      if (this._onVisibility) {
        document.removeEventListener("visibilitychange", this._onVisibility);
      }
      if (this._onLeave) {
        window.removeEventListener("pointerleave", this._onLeave);
        window.removeEventListener("blur", this._onLeave);
      }
      this._gl = null;
      this._uniforms = null;
    }

    _renderStatic() {
      this.style.background = [
        `radial-gradient(ellipse 70% 60% at 22% 30%, ${rgbaFromVec(this._accent, 0.50)} 0%, transparent 60%)`,
        `radial-gradient(ellipse 65% 55% at 78% 72%, ${rgbaFromVec(this._accent2, 0.45)} 0%, transparent 65%)`,
        `radial-gradient(ellipse 55% 45% at 60% 25%, ${rgbaFromVec(this._accent3, 0.16)} 0%, transparent 70%)`,
        `linear-gradient(to bottom, #0c0c10 0%, #08080a 100%)`,
      ].join(", ");
    }

    _onResize() {
      const w = this.clientWidth  || window.innerWidth;
      const h = this.clientHeight || window.innerHeight;
      this.canvas.width  = Math.floor(w * this._dpr);
      this.canvas.height = Math.floor(h * this._dpr);
      if (this._gl) this._gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    _onMouse(e) {
      const r = this.getBoundingClientRect();
      this._mouse.tx    = (e.clientX - r.left) / r.width;
      this._mouse.ty    = 1.0 - (e.clientY - r.top) / r.height;
      this._mouse.thover = 1.0;
    }
    _onLeave() { this._mouse.thover = 0.0; }

    _loop(t) {
      this._time = t / 1000;
      const k = 0.08;
      this._mouse.x     += (this._mouse.tx    - this._mouse.x)     * k;
      this._mouse.y     += (this._mouse.ty    - this._mouse.y)     * k;
      this._mouse.hover += (this._mouse.thover - this._mouse.hover) * 0.06;
      this._renderGL();
      this._raf = requestAnimationFrame(this._loop);
    }

    _initGL() {
      try {
        const gl = this.canvas.getContext("webgl", {
          antialias: false, alpha: false,
          premultipliedAlpha: false, powerPreference: "low-power",
        }) || this.canvas.getContext("experimental-webgl");
        if (!gl) return null;

        const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }`;

        // All tuning constants hardcoded:
        //   speed=0.05  phase=0.5   scale=2.0  turbulence(warpFbm)=2.0
        //   warpStrength=0.9  warpRadius=0.5
        //   layerMix=0.5  opacity1=0.9  opacity2=0.9  → both layer weights = 0.9
        const fs = `
          precision highp float;
          uniform vec2  u_res;
          uniform float u_t;
          uniform vec2  u_mouse;
          uniform float u_hover;
          uniform vec3  u_accent;
          uniform vec3  u_accent2;
          uniform vec3  u_accent3;

          mat2 rot(float a){
            float s=sin(a),c=cos(a);
            return mat2(c,-s,s,c);
          }
          float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
          vec2 grad(vec2 p){
            float a=hash(p)*6.28318530718;
            return vec2(cos(a),sin(a));
          }
          float gnoise(vec2 p){
            vec2 i=floor(p),f=fract(p);
            vec2 u=f*f*f*(f*(f*6.0-15.0)+10.0);
            float a=dot(grad(i+vec2(0.0,0.0)),f-vec2(0.0,0.0));
            float b=dot(grad(i+vec2(1.0,0.0)),f-vec2(1.0,0.0));
            float c=dot(grad(i+vec2(0.0,1.0)),f-vec2(0.0,1.0));
            float d=dot(grad(i+vec2(1.0,1.0)),f-vec2(1.0,1.0));
            return mix(mix(a,b,u.x),mix(c,d,u.x),u.y)*0.5+0.5;
          }
          float domainNoise(vec2 p){
            vec2 warp=vec2(gnoise(p*0.7+19.1),gnoise(p*0.7-4.7))-0.5;
            p += warp*0.65;
            return gnoise(p);
          }
          float fbm(vec2 p){
            float v=0.0,a=0.5;
            for(int i=0;i<5;i++){v+=a*domainNoise(p);p=rot(0.55)*p*2.03+13.17;a*=0.5;}
            return v;
          }

          void main(){
            vec2 uv = gl_FragCoord.xy / u_res;
            vec2 p  = uv * 2.0 - 1.0;
            p.x    *= u_res.x / u_res.y;

            // cursor warp
            vec2  m    = u_mouse * 2.0 - 1.0;
            m.x       *= u_res.x / u_res.y;
            vec2  d    = p - m;
            float dist = length(d);
            p -= d * (exp(-dist * 2.8) * u_hover * 0.54);

            p = rot(0.18) * p;
            p *= 2.35;                   // scale
            float t = u_t * 0.1 + 25.0;        // speed

            // Plasma — layer A
            vec3 col = vec3(0.03, 0.03, 0.04);
            vec2 q   = p * 0.6;
            q += 2.0 * vec2(fbm(q + t), fbm(q - t + 7.3));
            float nA1   = fbm(q * 1.4 + t * 0.5);
            float nA2   = fbm(q * 0.5 - t * 0.7 + 11.0);
            float maskA = smoothstep(0.12, 0.95, nA1) * (0.55 + 0.45 * smoothstep(0.3, 1.0, nA2));

            // Plasma — layer B (phase 0.5)
            vec2  q2 = rot(-0.42) * p * 0.55 + vec2(3.7, -2.1);
            float tb = t * 0.85 + 0.5;
            q2 += 2.0 * vec2(fbm(q2 + tb), fbm(q2 - tb + 1.3));
            float nB1   = fbm(q2 * 1.3 + tb * 0.6);
            float nB2   = fbm(q2 * 0.55 - tb * 0.5 + 5.0);
            float maskB = smoothstep(0.18, 0.98, nB1) * smoothstep(0.12, 0.95, nB2);

            // Plasma — layer B (phase 0.9)
            vec2  q3 = rot(0.73) * p * 0.65 + vec2(3.5, -2.1);
            float tc = t * 0.95 + 0.6;
            q3 += 2.0 * vec2(fbm(q3 + tc), fbm(q3 - tc + 1.3));
            float nC1   = fbm(q3 * 1.3 + tc * 0.6);
            float nC2   = fbm(q3 * 0.55 - tc * 0.5 + 5.0);
            float maskC = smoothstep(0.2, 0.98, nC1) * smoothstep(0.14, 0.96, nC2);

            vec3 glow = u_accent * maskA * 0.85
                      + u_accent2 * maskB * 0.42
                      + u_accent3 * maskC * 0.48;
            col = mix(col, col + glow, 0.82);

            // cursor glow + vignette + dither
            col += u_accent * exp(-dist * 1.8) * u_hover * 0.35;
            col *= 1.0 - smoothstep(0.7, 1.6, length(p)) * 0.6;
            col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

            gl_FragColor = vec4(col, 1.0);
          }
        `;

        const prog = makeProgram(gl, vs, fs);
        if (!prog) return null;

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER,
          new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
          gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, "p");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        this._uniforms = {
          u_res:    gl.getUniformLocation(prog, "u_res"),
          u_t:      gl.getUniformLocation(prog, "u_t"),
          u_mouse:  gl.getUniformLocation(prog, "u_mouse"),
          u_hover:  gl.getUniformLocation(prog, "u_hover"),
          u_accent: gl.getUniformLocation(prog, "u_accent"),
          u_accent2:gl.getUniformLocation(prog, "u_accent2"),
          u_accent3:gl.getUniformLocation(prog, "u_accent3"),
        };
        gl.useProgram(prog);
        return gl;
      } catch (err) { console.warn("WebGL init failed", err); return null; }
    }

    _renderGL() {
      const gl = this._gl;
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(this._uniforms.u_res,    this.canvas.width, this.canvas.height);
      gl.uniform1f(this._uniforms.u_t,      this._time);
      gl.uniform2f(this._uniforms.u_mouse,  this._mouse.x,      this._mouse.y);
      gl.uniform1f(this._uniforms.u_hover,  this._mouse.hover);
      gl.uniform3f(this._uniforms.u_accent,  this._accent[0],  this._accent[1],  this._accent[2]);
      gl.uniform3f(this._uniforms.u_accent2, this._accent2[0], this._accent2[1], this._accent2[2]);
      gl.uniform3f(this._uniforms.u_accent3, this._accent3[0], this._accent3[1], this._accent3[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  function makeProgram(gl, vs, fs) {
    const v = compile(gl, gl.VERTEX_SHADER,   vs);
    const f = compile(gl, gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    return p;
  }
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("Shader compile failed", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  function rgbaFromVec(color, alpha) {
    const r = Math.round(color[0] * 255);
    const g = Math.round(color[1] * 255);
    const b = Math.round(color[2] * 255);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  customElements.define("shader-bg", ShaderBg);
})();
