/* ==========================================================================
   트릭컬 낱말 러시 게임 엔진
   - 2D Crossword 교차 매칭 알고리즘
   - 배경 캔버스: 별빛 + 단어 입력 시 날아오르는 사도 일러스트 파티클
   - Web Audio API 내장 효과음
   ========================================================================== */

const TILE_SIZE = 52; // 타일 크기 (픽셀)
const INIT_TIME = 60;     // 시작 시간 (초)
const MAX_TIME = 90;      // 시간 상한 (초)
const BONUS_TIME = 3;     // 단어 연결 성공 시 추가 시간 (초)
const HINT_COST = 10;     // 힌트 사용 시 차감 시간 (초)
const MAX_EXPANSIONS = 1; // 막혔을 때 보드를 확장해 주는 횟수 (이후 막히면 종료)
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;

// 오디오 시스템
class SoundSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playPop() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(750, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playSuccess() {
    if (this.muted) return;
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = this.ctx.currentTime + idx * 0.07;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  playError() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }
}

// 배경 캔버스 및 날아오르는 사도 파티클 관리자
class CanvasManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.flyingApostles = [];
    this.imageCache = new Map();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.initAmbientParticles();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initAmbientParticles() {
    // 배경에 유영하는 은은한 별빛
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 2 + 1,
        vy: -(Math.random() * 0.4 + 0.1),
        alpha: Math.random() * 0.5 + 0.1
      });
    }
  }

  // 사도 이미지를 비동기로 로드하고 날아오르는 효과 등록
  spawnFlyingApostle(imageSrc, apostleName) {
    imageSrc = imageSrc || 'images/default.png';
    let img = this.imageCache.get(imageSrc);
    if (!img) {
      img = new Image();
      img.onerror = () => {
        // 이미지가 없으면 기본 대체 이미지를 한 번만 시도 (default.png도 없으면 볼따구 폴백 사용)
        img.onerror = null;
        img.src = 'images/default.png';
      };
      img.src = imageSrc;
      this.imageCache.set(imageSrc, img);
    }

    // 화면 하단 랜덤 위치에서 살짝 비스듬히 위로 날아오름
    const startX = Math.random() * (this.canvas.width - 200) + 100;
    this.flyingApostles.push({
      img: img,
      name: apostleName,
      x: startX,
      y: this.canvas.height + 80,
      targetY: this.canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -(Math.random() * 3 + 4.5),
      size: 130, // 사도 이미지 표시 크기
      alpha: 1.0,
      scale: 0.6,
      rotation: (Math.random() - 0.5) * 0.3,
      vr: (Math.random() - 0.5) * 0.02
    });
  }

  loop() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. 은은한 배경 파티클
    this.ctx.fillStyle = '#00e699';
    for (const p of this.particles) {
      p.y += p.vy;
      if (p.y < 0) p.y = this.canvas.height;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    // 2. 단어 입력 시 날아오르는 사도 일러스트 렌더링
    for (let i = this.flyingApostles.length - 1; i >= 0; i--) {
      const a = this.flyingApostles[i];
      a.x += a.vx;
      a.y += a.vy;
      a.rotation += a.vr;
      if (a.scale < 1.0) a.scale += 0.02;

      // 상단 목표치 도달 시 점차 페이드아웃
      if (a.y < a.targetY) {
        a.alpha -= 0.015;
      }

      if (a.alpha <= 0) {
        this.flyingApostles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, a.alpha);
      this.ctx.translate(a.x, a.y);
      this.ctx.rotate(a.rotation);
      this.ctx.scale(a.scale, a.scale);

      // 이미지가 로드되었으면 이미지 렌더링, 미로드 시 원형 볼따구로 대체
      if (a.img.complete && a.img.naturalWidth !== 0) {
        // 원형 클리핑 & 테두리
        this.ctx.beginPath();
        this.ctx.arc(0, 0, a.size / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = '#102521';
        this.ctx.fill();
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = '#00e699';
        this.ctx.stroke();
        this.ctx.clip();
        this.ctx.drawImage(a.img, -a.size / 2, -a.size / 2, a.size, a.size);
      } else {
        // 이미지 로딩 전/실패 시 볼따구 그래픽 폴백
        this.ctx.beginPath();
        this.ctx.arc(0, 0, a.size / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ffbbcc';
        this.ctx.fill();
        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 20px Jua';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(a.name, 0, 8);
      }
      this.ctx.restore();
    }

    this.ctx.globalAlpha = 1.0;
    requestAnimationFrame(this.loop);
  }
}

// 메인 게임 로직
class CrosswordGame {
  constructor() {
    this.sound = new SoundSystem();
    this.canvasManager = new CanvasManager(document.getElementById('bgCanvas'));

    this.grid = new Map(); // key: "x,y", value: { char, wordIndex }
    this.placedWords = [];  // { word, dir: 'H'|'V', startX, startY }
    this.usedWords = new Set();

    this.score = 0;
    this.timeLeft = INIT_TIME;
    this.timerInterval = null;
    this.state = 'ready'; // ready(시작 전) | playing | over
    this.expandCount = 0;  // 보드 확장 사용 횟수
    this.connectedCount = 0; // 직접 입력해 연결한 단어 수
    this.pointers = new Map(); // 터치/마우스 포인터 (이동·핀치 줌)
    this.pinch = null;
    this.lastFocus = { x: 0, y: 0 }; // 가장 최근에 연결한 단어의 중심 좌표

    this.dictMap = new Map(TRICKCAL_DICTIONARY.map(item => [item.word, item]));
    this.bestScore = this.loadBest();

    // 카메라 뷰포트 상태
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    this.initDOM();
    this.initEvents();
    this.showStartScreen();
  }

  // 최고 점수 저장/불러오기 (저장소 사용 불가 환경 대비)
  loadBest() {
    try { return parseInt(localStorage.getItem('cwrush_best') || '0', 10) || 0; }
    catch (e) { return 0; }
  }

  saveBest(v) {
    try { localStorage.setItem('cwrush_best', String(v)); } catch (e) { /* 무시 */ }
  }

  initDOM() {
    this.boardEl = document.getElementById('board');
    this.viewportEl = document.getElementById('viewport');
    this.inputEl = document.getElementById('wordInput');
    this.wordCountEl = document.getElementById('wordCount');
    this.scoreEl = document.getElementById('scoreDisplay');
    this.timerTextEl = document.getElementById('timerText');
    this.timerBarEl = document.getElementById('timerBar');
    this.historyListEl = document.getElementById('historyList');
    this.bubbleEl = document.getElementById('bubbleNotice');
    this.startScreenEl = document.getElementById('startScreen');
    this.endScreenEl = document.getElementById('endScreen');
    this.btnResultEl = document.getElementById('btnResult');
    this.endTitleEl = document.getElementById('endTitle');
    this.endReasonEl = document.getElementById('endReason');
    this.timerPillEl = document.querySelector('.stat-pill.timer');
    this.scorePillEl = this.scoreEl.closest('.stat-pill');
  }

  initEvents() {
    // 폼 제출 (단어 등록)
    document.getElementById('wordForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitWord(this.inputEl.value.trim());
    });

    // 시작 / 재시작 / 결과 보기
    document.getElementById('btnStart').addEventListener('click', () => this.startNewGame());
    document.getElementById('btnRestart').addEventListener('click', () => this.startNewGame());
    document.getElementById('btnViewBoard').addEventListener('click', () => {
      this.endScreenEl.classList.remove('show');
      this.btnResultEl.hidden = false;
    });
    this.btnResultEl.addEventListener('click', () => {
      this.endScreenEl.classList.add('show');
      this.btnResultEl.hidden = true;
    });
    // 시작 화면에서만 Enter로 시작 (종료 직후 실수로 재시작되지 않도록 종료 화면은 제외)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.state === 'ready') this.startNewGame();
    });

    // 힌트 버튼
    document.getElementById('btnHint').addEventListener('click', () => this.showHint());

    // 사운드 토글
    const btnSound = document.getElementById('btnSound');
    btnSound.addEventListener('click', () => {
      this.sound.muted = !this.sound.muted;
      btnSound.textContent = this.sound.muted ? '🔇' : '🔊';
    });

    // 보드 이동: 마우스 드래그 + 터치 드래그 + 두 손가락 핀치 줌 (Pointer Events)
    const vp = this.viewportEl;
    vp.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.view-controls') || e.target.closest('#bubbleNotice')) return;
      try { vp.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.setBoardDragging(true);
      if (this.pointers.size === 1) {
        this.dragStart = { x: e.clientX - this.camera.x, y: e.clientY - this.camera.y };
      } else if (this.pointers.size === 2) {
        this.pinch = { dist: this.pointerDistance(), zoom: this.camera.zoom };
      }
    });

    vp.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.camera.x = e.clientX - this.dragStart.x;
        this.camera.y = e.clientY - this.dragStart.y;
        this.updateBoardTransform();
      } else if (this.pointers.size >= 2 && this.pinch && this.pinch.dist > 0) {
        const [p1, p2] = [...this.pointers.values()];
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.pinch.zoom * this.pointerDistance() / this.pinch.dist));
        this.zoomAt((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, zoom);
      }
    });

    const endPointer = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      this.pinch = null;
      if (this.pointers.size === 0) {
        this.setBoardDragging(false);
      } else if (this.pointers.size === 1) {
        // 핀치 후 남은 손가락으로 이어서 드래그
        const p = [...this.pointers.values()][0];
        this.dragStart = { x: p.x - this.camera.x, y: p.y - this.camera.y };
      }
    };
    vp.addEventListener('pointerup', endPointer);
    vp.addEventListener('pointercancel', endPointer);

    // 휠 줌 (커서 위치 기준)
    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.camera.zoom * factor));
      this.setBoardDragging(true);
      this.zoomAt(e.clientX, e.clientY, zoom);
      clearTimeout(this.wheelTimer);
      this.wheelTimer = setTimeout(() => this.setBoardDragging(false), 150);
    }, { passive: false });

    // 보기 컨트롤: 확대 / 축소 / 전체 보기 / 최근 단어로 이동
    const center = () => {
      const r = vp.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const zoomBy = (f) => {
      const c = center();
      this.zoomAt(c.x, c.y, Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.camera.zoom * f)));
    };
    document.getElementById('btnZoomIn').addEventListener('click', () => zoomBy(1.25));
    document.getElementById('btnZoomOut').addEventListener('click', () => zoomBy(0.8));
    document.getElementById('btnFit').addEventListener('click', () => this.fitAll());
    document.getElementById('btnLast').addEventListener('click', () => {
      this.centerCameraOn(this.lastFocus.x, this.lastFocus.y);
    });
  }

  showStartScreen() {
    this.state = 'ready';
    document.getElementById('bestScoreStart').textContent = this.bestScore;
    document.getElementById('initTimeText').textContent = INIT_TIME;
    document.getElementById('maxTimeText').textContent = MAX_TIME;
    document.getElementById('bonusText').textContent = BONUS_TIME;
    document.getElementById('hintCostText').textContent = HINT_COST;
    this.inputEl.disabled = true;
    this.startScreenEl.classList.add('show');
  }

  startNewGame() {
    this.startScreenEl.classList.remove('show');
    this.endScreenEl.classList.remove('show');
    this.btnResultEl.hidden = true;
    this.inputEl.disabled = false;
    this.inputEl.value = '';
    this.inputEl.focus();
    this.state = 'playing';
    this.camera.zoom = 1;
    this.grid.clear();
    this.placedWords = [];
    this.usedWords.clear();
    this.boardEl.innerHTML = '';
    this.historyListEl.innerHTML = '';
    this.score = 0;
    this.timeLeft = INIT_TIME;
    this.expandCount = 0;
    this.connectedCount = 0;
    this.updateTimerUI();
    this.updateStats();

    // 초기 시드 단어 선택 (예: 모나티엄 또는 사멜리아)
    const seed = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)];
    this.placeWord(seed, 0, 0, 'H', true);

    this.startTimer();
    this.centerCameraOn(0, 0);
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      this.updateTimerUI();
      if (this.timeLeft <= 0) this.endGame('time');
    }, 1000);
  }

  // 단어 검증 및 교차 자동 매칭
  submitWord(raw) {
    if (this.state !== 'playing') return;
    // 공백·특수문자 제거 (예: "마에스트로 이호" → "마에스트로이호")
    const input = (raw || '').replace(/[\s!?.,~…·'"“”()\[\]-]/g, '');
    if (!input) return;
    this.inputEl.value = '';

    // 1) 사전 등록 여부
    const entry = this.dictMap.get(input);
    if (!entry) {
      const similar = TRICKCAL_DICTIONARY
        .filter(item => input.length >= 2 && (item.word.includes(input) || input.includes(item.word)))
        .sort((a, b) => a.word.length - b.word.length) // 짧은(가까운) 단어 우선
        .slice(0, 3).map(item => item.word);
      const hint = similar.length ? `\n혹시 ${similar.map(w => `"${w}"`).join(', ')}?` : '';
      this.showToast(`❌ 사전에 없는 단어예요: "${input}"${hint}`, 'error');
      this.feedbackError();
      return;
    }

    // 2) 이미 보드에 있는 단어
    if (this.usedWords.has(input)) {
      this.showToast(`🔁 이미 보드에 있는 단어예요: "${input}"`, 'warn');
      this.feedbackError();
      return;
    }

    // 3) 교차 가능한 좌표 탐색
    const placement = this.findPlacement(input);
    if (!placement) {
      const letters = [...new Set(input)];
      const boardChars = new Set([...this.grid.values()].map(c => c.char));
      const shared = letters.filter(ch => boardChars.has(ch));
      if (shared.length === 0) {
        this.showToast(`🧩 "${input}" — 보드에 겹치는 글자가 없어요\n${letters.join('·')} 중 하나가 보드에 있어야 해요`, 'warn');
      } else {
        this.showToast(`🧩 "${input}" — ${shared.join('·')} 글자는 겹치지만 놓을 빈자리가 없어요\n(다른 글자와 붙거나 겹치는 자리예요)`, 'warn');
      }
      this.feedbackError();
      return;
    }

    // 4) 성공: 배치 / 점수 / 시간 보너스
    this.placeWord(input, placement.x, placement.y, placement.dir, false, placement.anchor);
    this.sound.playSuccess();
    this.sound.playPop();
    this.connectedCount++;
    const gained = input.length * 100;
    this.score += gained;
    this.addTime(BONUS_TIME);
    this.updateStats();
    this.pulse(this.scorePillEl, 'bump');

    // 배경에 해당 사도 일러스트 날리기
    this.canvasManager.spawnFlyingApostle(entry.image, entry.word);

    let msg = `✅ ${input}  +${gained}점  +${BONUS_TIME}초`;
    if (entry.quote) msg += `\n"${entry.quote}"`;
    this.showToast(msg, 'ok', entry.quote ? 3200 : 2000);

    // 카메라를 새로 연결된 단어로 부드럽게 이동
    this.centerCameraOn(placement.x + Math.floor(input.length / 2), placement.y);

    // 더 이을 단어가 남았는지 확인 (막힘 처리)
    this.checkStuck();
  }

  // 입력 실패 시 입력창 흔들기 + 효과음
  feedbackError() {
    this.sound.playError();
    this.inputEl.classList.remove('shake');
    void this.inputEl.offsetWidth; // 애니메이션 재시작
    this.inputEl.classList.add('shake');
  }

  // 요소에 잠깐 애니메이션 클래스 부여
  pulse(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 600);
  }

  // 남은 시간 증감 (상한 MAX_TIME)
  addTime(delta) {
    this.timeLeft = Math.min(MAX_TIME, this.timeLeft + delta);
    this.updateTimerUI();
    this.pulse(this.timerPillEl, delta >= 0 ? 'bump' : 'penalty');
  }

  updateTimerUI() {
    this.timerTextEl.textContent = Math.max(0, this.timeLeft);
    const pct = Math.max(0, Math.min(100, (this.timeLeft / MAX_TIME) * 100));
    this.timerBarEl.style.width = `${pct}%`;
  }

  // ---------- 막힘 감지 / 보드 확장 ----------

  // 연결 가능한 단어가 하나도 없으면: 첫 번째는 보드 확장, 이후에는 종료
  checkStuck() {
    if (this.state !== 'playing') return;
    if (this.getAvailableWords().length > 0) return;

    if (this.expandCount < MAX_EXPANSIONS) {
      const plan = this.findExpansion();
      if (plan) {
        this.expandCount++;
        this.placeWord(plan.word, plan.x, plan.y, 'H', true);
        this.updateStats();
        this.centerCameraOn(plan.x + Math.floor(plan.word.length / 2), plan.y);
        this.showToast(
          `🧩 더 이을 단어가 없어 보드가 확장됐어요!\n새 단어 "${plan.word}" 추가 — 다음 막힘에는 게임이 종료돼요`,
          'info', 4200
        );
        return;
      }
    }
    this.endGame('stuck');
  }

  // 보드 아래쪽에 새 시작 단어를 놓을 위치/단어 탐색 (놓은 뒤 이어 붙일 단어가 많은 후보 우선)
  findExpansion() {
    const b = this.getBounds();
    const x = b.minX, y = b.maxY + 3; // 기존 보드와 닿지 않도록 간격을 둠
    const pool = TRICKCAL_DICTIONARY.filter(
      d => !this.usedWords.has(d.word) && d.word.length >= 3 && d.word.length <= 6
    );
    for (let i = pool.length - 1; i > 0; i--) { // 셔플
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let best = null;
    for (const item of pool.slice(0, 40)) {
      const idx = this.placedWords.length;
      const keys = [];
      this.placedWords.push({ word: item.word, dir: 'H', startX: x, startY: y });
      this.usedWords.add(item.word);
      for (let i = 0; i < item.word.length; i++) {
        const key = `${x + i},${y}`;
        this.grid.set(key, { char: item.word[i], wordIndex: idx });
        keys.push(key);
      }
      const count = this.getAvailableWords().length;
      keys.forEach(k => this.grid.delete(k)); // 가상 배치 되돌리기
      this.placedWords.pop();
      this.usedWords.delete(item.word);

      if (count > 0 && (!best || count > best.count)) best = { word: item.word, x, y, count };
      if (best && best.count >= 10) break;
    }
    return best;
  }

  // 보드에 놓인 타일 전체의 경계
  getBounds() {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const key of this.grid.keys()) {
      const [x, y] = key.split(',').map(Number);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (minX === Infinity) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    return { minX, maxX, minY, maxY };
  }

  // ---------- 보드 이동 / 줌 보조 ----------

  pointerDistance() {
    const [p1, p2] = [...this.pointers.values()];
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  // 드래그·핀치·휠 중에는 부드러운 이동 애니메이션을 꺼서 손에 붙게 함
  setBoardDragging(on) {
    this.boardEl.style.transition = on ? 'none' : '';
  }

  // 화면 좌표(clientX, clientY)를 고정점으로 삼아 줌
  zoomAt(clientX, clientY, newZoom) {
    const r = this.viewportEl.getBoundingClientRect();
    const cx = clientX - r.left, cy = clientY - r.top;
    const ratio = newZoom / this.camera.zoom;
    this.camera.x = cx - (cx - this.camera.x) * ratio;
    this.camera.y = cy - (cy - this.camera.y) * ratio;
    this.camera.zoom = newZoom;
    this.updateBoardTransform();
  }

  // 보드 전체가 한 화면에 보이도록 맞춤
  fitAll() {
    const b = this.getBounds();
    const w = (b.maxX - b.minX + 1) * TILE_SIZE, h = (b.maxY - b.minY + 1) * TILE_SIZE;
    const pad = 80;
    const z = Math.min(
      (this.viewportEl.clientWidth - pad) / w,
      (this.viewportEl.clientHeight - pad) / h
    );
    this.camera.zoom = Math.min(1.2, Math.max(MIN_ZOOM, z));
    this.centerCameraOn((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
  }

  // 십자말풀이 직교 규칙 검사 (H면 V로 교차, V면 H로 교차)
  findPlacement(word) {
    for (let i = 0; i < word.length; i++) {
      const char = word[i];

      // 보드에 있는 모든 동일 글자 검색
      for (const [key, cell] of this.grid.entries()) {
        if (cell.char === char) {
          const [cx, cy] = key.split(',').map(Number);
          const parentWord = this.placedWords[cell.wordIndex];
          const newDir = parentWord.dir === 'H' ? 'V' : 'H';

          const startX = newDir === 'H' ? cx - i : cx;
          const startY = newDir === 'V' ? cy - i : cy;

          if (this.canPlace(word, startX, startY, newDir, cx, cy)) {
            return { x: startX, y: startY, dir: newDir, anchor: { x: cx, y: cy } };
          }
        }
      }
    }
    return null;
  }

  // 인접 타일 충돌 검사
  canPlace(word, startX, startY, dir, anchorX, anchorY) {
    for (let i = 0; i < word.length; i++) {
      const x = dir === 'H' ? startX + i : startX;
      const y = dir === 'V' ? startY + i : startY;
      const key = `${x},${y}`;

      if (x === anchorX && y === anchorY) {
        if (this.grid.get(key)?.char !== word[i]) return false;
        continue;
      }

      if (this.grid.has(key)) return false;

      // 단어가 평행하게 딱 달라붙지 않도록 주변 간격 체크
      if (dir === 'H') {
        if (this.grid.has(`${x},${y - 1}`) || this.grid.has(`${x},${y + 1}`)) return false;
      } else {
        if (this.grid.has(`${x - 1},${y}`) || this.grid.has(`${x + 1},${y}`)) return false;
      }
    }

    // 단어 양 끝 바로 앞뒤에 다른 글자가 붙어있는지 확인
    const prevKey = dir === 'H' ? `${startX - 1},${startY}` : `${startX},${startY - 1}`;
    const nextKey = dir === 'H' ? `${startX + word.length},${startY}` : `${startX},${startY + word.length}`;
    if (this.grid.has(prevKey) || this.grid.has(nextKey)) return false;

    return true;
  }

  placeWord(word, startX, startY, dir, isSeed = false, anchor = null) {
    const wordIdx = this.placedWords.length;
    this.placedWords.push({ word, dir, startX, startY });
    this.usedWords.add(word);

    // 보드에 타일 렌더링
    for (let i = 0; i < word.length; i++) {
      const x = dir === 'H' ? startX + i : startX;
      const y = dir === 'V' ? startY + i : startY;
      const key = `${x},${y}`;

      let tileEl = document.getElementById(`tile-${x}-${y}`);
      const isCross = (anchor && x === anchor.x && y === anchor.y);

      if (!tileEl) {
        tileEl = document.createElement('div');
        tileEl.id = `tile-${x}-${y}`;
        tileEl.className = `tile ${isSeed ? 'seed' : 'active-word spawn-pop'}`;
        if (isCross) tileEl.classList.add('cross');
        tileEl.textContent = word[i];
        tileEl.style.left = `${x * TILE_SIZE}px`;
        tileEl.style.top = `${y * TILE_SIZE}px`;
        this.boardEl.appendChild(tileEl);

        this.grid.set(key, { char: word[i], wordIndex: wordIdx, el: tileEl });
      } else {
        tileEl.classList.add('cross');
      }
    }

    this.lastFocus = { x: startX + (dir === 'H' ? Math.floor(word.length / 2) : 0), y: startY + (dir === 'V' ? Math.floor(word.length / 2) : 0) };

    // 히스토리 리스트에 등록
    const li = document.createElement('li');
    li.className = `history-item ${isSeed ? 'seed-item' : ''}`;
    li.textContent = isSeed ? `[${this.placedWords.length > 1 ? '확장' : '시작'}] ${word}` : word;
    this.historyListEl.appendChild(li);
  }

  centerCameraOn(gridX, gridY) {
    const vWidth = this.viewportEl.clientWidth;
    const vHeight = this.viewportEl.clientHeight;
    this.camera.x = vWidth / 2 - (gridX * TILE_SIZE + TILE_SIZE / 2) * this.camera.zoom;
    this.camera.y = vHeight / 2 - (gridY * TILE_SIZE + TILE_SIZE / 2) * this.camera.zoom;
    this.updateBoardTransform();
  }

  updateBoardTransform() {
    this.boardEl.style.transform = `translate(${this.camera.x}px, ${this.camera.y}px) scale(${this.camera.zoom})`;
  }

  updateStats() {
    this.wordCountEl.textContent = this.connectedCount;
    this.scoreEl.textContent = this.score;
  }

  // type: error(빨강) | warn(주황) | ok(초록) | info(파랑)
  showToast(msg, type = 'error', duration = 2600) {
    this.bubbleEl.textContent = msg;
    this.bubbleEl.className = `bubble-notice ${type} show`;
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      this.bubbleEl.classList.remove('show');
    }, duration);
  }

  showHint() {
    if (this.state !== 'playing') return;
    if (this.timeLeft <= HINT_COST) {
      this.showToast(`⏱ 남은 시간이 ${HINT_COST}초 이하라 힌트를 쓸 수 없어요`, 'warn');
      return;
    }
    // 현재 보드에 교차 가능한 남은 단어 중 무작위로 하나 추천
    const list = this.getAvailableWords();
    if (list.length === 0) {
      this.showToast("현재 연결할 수 있는 남은 단어가 없습니다!", 'warn');
      return;
    }
    const item = list[Math.floor(Math.random() * list.length)];
    this.addTime(-HINT_COST);
    this.inputEl.value = item.word;
    this.inputEl.focus();
    this.showToast(`💡 추천 단어: "${item.word}"  (-${HINT_COST}초)\nEnter를 누르면 연결돼요`, 'info', 3000);
    if (this.timeLeft <= 0) this.endGame('time');
  }

  // 지금 보드에 연결 가능한(아직 안 쓴) 사전 단어 전체
  getAvailableWords() {
    return TRICKCAL_DICTIONARY.filter(
      item => !this.usedWords.has(item.word) && this.findPlacement(item.word)
    );
  }

  // 게임 종료: 결과 화면 + 놓친(연결 가능했던) 단어 표시
  endGame(reason = 'time') {
    clearInterval(this.timerInterval);
    this.state = 'over';
    this.inputEl.disabled = true;
    this.inputEl.blur();
    this.endTitleEl.textContent = reason === 'stuck' ? '막다른 길!' : '시간 종료!';
    this.endReasonEl.textContent = reason === 'stuck'
      ? '보드를 확장한 뒤에도 더 이을 수 있는 단어가 없어 게임이 끝났어요.'
      : '';

    const isRecord = this.score > this.bestScore;
    if (isRecord) {
      this.bestScore = this.score;
      this.saveBest(this.bestScore);
    }

    document.getElementById('endScore').textContent = this.score;
    document.getElementById('endWords').textContent = this.connectedCount;
    document.getElementById('endBest').textContent = this.bestScore;
    document.getElementById('newRecord').hidden = !isRecord;
    this.renderMissedWords();
    this.endScreenEl.classList.add('show');
  }

  renderMissedWords() {
    const list = this.getAvailableWords();
    document.getElementById('missedCount').textContent = list.length;
    const box = document.getElementById('missedList');
    box.innerHTML = '';

    if (list.length === 0) {
      box.textContent = '더 이어 붙일 수 있는 단어가 없었어요. 보드를 끝까지 채웠어요!';
      return;
    }

    // 카테고리별로 묶고, 긴 단어부터 표시
    const groups = new Map();
    for (const item of list) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
    }
    for (const [cat, items] of groups) {
      items.sort((a, b) => b.word.length - a.word.length);
      const head = document.createElement('div');
      head.className = 'missed-cat';
      head.textContent = `${cat} (${items.length})`;
      box.appendChild(head);
      for (const item of items) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = item.word;
        const tip = item.title || (item.owner ? `${item.owner}의 ${cat}` : '');
        if (tip) chip.title = tip;
        box.appendChild(chip);
      }
    }
  }
}

// 브라우저 로드 시 게임 인스턴스 시작
window.addEventListener('DOMContentLoaded', () => {
  window.game = new CrosswordGame();
});