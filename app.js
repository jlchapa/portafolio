(function () {
  var PROJECTS = [
    { num: "01", title: "Investing", badge: "Finance", img: "images/investmentapp.png",
      desc: "A calculator and visualizer so you can asses if your capital and investments are enough to make passive income or F.I.R.E.",
      url: "https://jlchapa.github.io/investment/", repo: "https://www.github.com/jlchapa/investment" },
    { num: "02", title: "Brain", badge: "Web · Games", img: "images/brainapp.png",
      desc: "A set of daily puzzle games — sequence, digits, and shapes — for a bit of mental exercise. Progress tracked locally on your device.",
      url: "https://suhuy.com", repo: "https://www.github.com/jlchapa/brainapp" },
    { num: "03", title: "GymProgress", badge: "Local AI", img: "images/gymapp.png",
      desc: "A way to track gym progress on device. Snap a mirror photo every week then a small model reads the silhouette, posture, and composition trends. Photos never leave your device.",
      url: "https://jlchapa.github.io/gym-progress/", repo: "https://www.github.com/jlchapa/gym-progress" }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var page = $("page"), list = $("list"), card = $("card"), imgs = $("card-imgs");
  var detail = $("detail"), title = $("title"), counter = $("counter"), progress = $("progress");
  var cursor = $("cursor"), aboutToggle = $("about-toggle"), aboutPanel = $("about");
  var active = 0, prev = -1, about = false, hoverCard = false;
  var stacked = window.matchMedia("(max-width: 760px)");
  var total = pad(PROJECTS.length);

  var rows = PROJECTS.map(function (p, i) {
    var b = document.createElement("button");
    b.className = "list-item";
    b.innerHTML = '<span class="list-dot"></span>[' + p.num + "] " + p.title;
    b.addEventListener("click", function () { select(i); });
    list.appendChild(b);
    return b;
  });

  var pics = PROJECTS.map(function (p) {
    var img = document.createElement("img");
    img.className = "card-img";
    img.src = p.img;
    img.alt = p.title + " project cover";
    imgs.appendChild(img);
    return img;
  });

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function render() {
    var p = PROJECTS[active];
    rows.forEach(function (r, i) {
      r.classList.toggle("is-active", i === active);
      if (i === active) r.setAttribute("aria-current", "true"); else r.removeAttribute("aria-current");
    });
    pics.forEach(function (img, i) {
      img.classList.toggle("is-active", i === active);
      img.classList.toggle("is-prev", i === prev);
    });
    card.href = p.url;
    card.setAttribute("aria-label", "Open " + p.title);
    counter.textContent = p.num + " — " + total;
    progress.style.transform = "scaleX(" + (active + 1) / PROJECTS.length + ")";
    detail.innerHTML =
      '<div class="detail-inner">' +
        '<span class="detail-badge">(' + esc(p.badge) + ")</span>" +
        '<p class="detail-desc">' + esc(p.desc) + "</p>" +
        '<div class="detail-links">' +
          '<a href="' + esc(p.url) + '" target="_blank" rel="noreferrer">Open project ↗</a>' +
          '<a href="' + esc(p.repo) + '" target="_blank" rel="noreferrer">Source ↗</a>' +
        "</div>" +
      "</div>";
    var size = Math.min(52 / (p.title.length * 0.61), 100);
    title.innerHTML = '<div class="title" style="font-size:min(' + size.toFixed(2) + 'vw, 10vh)">' + esc(p.title) + "</div>";
    page.classList.toggle("is-about", about);
    aboutToggle.textContent = about ? "Close" : "About";
    aboutToggle.setAttribute("aria-expanded", String(about));
    aboutPanel.setAttribute("aria-hidden", String(!about));
    updateCursor();
  }

  function select(i) {
    if (i !== active) { prev = active; active = i; }
    about = false;
    render();
  }
  function go(d) { select((active + d + PROJECTS.length) % PROJECTS.length); }

  aboutToggle.addEventListener("click", function () { about = !about; render(); });

  // The about panel sits inside the card link; don't open the project while it's showing.
  card.addEventListener("click", function (e) { if (about) e.preventDefault(); });

  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "Escape" && about) { about = false; render(); }
  });

  var lastWheel = 0;
  window.addEventListener("wheel", function (e) {
    if (stacked.matches || Math.abs(e.deltaY) < 12) return;
    var now = Date.now();
    if (now - lastWheel < 1000) return;
    lastWheel = now;
    go(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  function updateCursor() {
    var big = hoverCard && !about;
    cursor.classList.toggle("is-big", big);
    cursor.textContent = big ? "Open" : "";
  }
  card.addEventListener("mouseenter", function () { hoverCard = true; updateCursor(); });
  card.addEventListener("mouseleave", function () { hoverCard = false; updateCursor(); });

  var raf = 0, mx = 0, my = 0;
  window.addEventListener("mousemove", function (e) {
    mx = e.clientX; my = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      cursor.style.transform = "translate(" + mx + "px," + my + "px)";
      var nx = mx / window.innerWidth * 2 - 1, ny = my / window.innerHeight * 2 - 1;
      card.style.transform = "translate(" + (nx * 14).toFixed(1) + "px," + (ny * 10).toFixed(1) + "px) rotate(" + (nx * 0.8).toFixed(2) + "deg)";
    });
  });

  render();
})();
