/* ==========================================================================
   트릭컬 낱말 러시 게임 엔진
   - 2D Crossword 교차 매칭 알고리즘
   - 배경 캔버스: 별빛 + 단어 입력 시 날아오르는 사도 일러스트 파티클
   - Web Audio API 내장 효과음
   ========================================================================== */

const TILE_SIZE = 52; // 타일 크기 (픽셀)
const INIT_TIME = 60; // 초기 제한 시간 (초)

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
    let img = this.imageCache.get(imageSrc);
    if (!img) {
      img = new Image();
      img.src = imageSrc;
      img.onerror = () => {
        // 이미지가 없으면 기본 대체 이미지 로드 시도
        img.src = 'images/default.png';
      };
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

    // 카메라 뷰포트 상태
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    this.initDOM();
    this.initEvents();
    this.startNewGame();
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
  }

  initEvents() {
    // 폼 제출 (단어 등록)
    document.getElementById('wordForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitWord(this.inputEl.value.trim());
    });

    // 힌트 버튼
    document.getElementById('btnHint').addEventListener('click', () => this.showHint());

    // 사운드 토글
    const btnSound = document.getElementById('btnSound');
    btnSound.addEventListener('click', () => {
      this.sound.muted = !this.sound.muted;
      btnSound.textContent = this.sound.muted ? '🔇' : '🔊';
    });

    // 보드 드래그 패닝
    this.viewportEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('#bubbleNotice')) return;
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.camera.x, y: e.clientY - this.camera.y };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.camera.x = e.clientX - this.dragStart.x;
      this.camera.y = e.clientY - this.dragStart.y;
      this.updateBoardTransform();
    });

    window.addEventListener('mouseup', () => { this.isDragging = false; });

    // 휠 줌
    this.viewportEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.camera.zoom = Math.min(Math.max(0.5, this.camera.zoom * zoomFactor), 1.8);
      this.updateBoardTransform();
    }, { passive: false });
  }

  startNewGame() {
    this.grid.clear();
    this.placedWords = [];
    this.usedWords.clear();
    this.boardEl.innerHTML = '';
    this.historyListEl.innerHTML = '';
    this.score = 0;
    this.timeLeft = INIT_TIME;
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
      this.timerTextEl.textContent = this.timeLeft;
      const pct = (this.timeLeft / INIT_TIME) * 100;
      this.timerBarEl.style.width = `${Math.max(0, pct)}%`;

      if (this.timeLeft <= 0) {
        clearInterval(this.timerInterval);
        this.showToast('시간 종료! 최종 점수: ' + this.score);
        this.inputEl.disabled = true;
      }
    }, 1000);
  }

  // 단어 검증 및 교차 자동 매칭
  submitWord(input) {
    if (!input) return;
    this.inputEl.value = '';

    // 사전 등록 여부 확인
    const entry = TRICKCAL_DICTIONARY.find(item => item.word === input);
    if (!entry) {
      this.showToast(`사전에 없는 단어입니다: "${input}"`);
      this.sound.playError();
      return;
    }

    // 이미 배치된 단어인지 확인
    if (this.usedWords.has(input)) {
      this.showToast(`이미 보드에 연결된 단어입니다: "${input}"`);
      this.sound.playError();
      return;
    }

    // 교차 가능한 좌표 탐색
    const placement = this.findPlacement(input);
    if (!placement) {
      this.showToast(`보드 위의 글자와 교차하여 놓을 수 있는 빈자리가 없습니다!`);
      this.sound.playError();
      return;
    }

    // 단어 배치
    this.placeWord(input, placement.x, placement.y, placement.dir, false, placement.anchor);

    // 사운드 및 점수 부여
    this.sound.playSuccess();
    this.sound.playPop();
    this.score += input.length * 100;
    this.timeLeft = Math.min(INIT_TIME, this.timeLeft + 5); // 성공 시 5초 보너스
    this.updateStats();

    // 배경에 해당 사도 일러스트 날리기
    this.canvasManager.spawnFlyingApostle(entry.image, entry.word);

    // 사도 명대사가 있다면 토스트로 잠깐 노출
    if (entry.quote) {
      this.showToast(`[${entry.word}] "${entry.quote}"`);
    }

    // 카메라를 새로 연결된 단어로 부드럽게 이동
    this.centerCameraOn(placement.x + Math.floor(input.length / 2), placement.y);
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

    // 히스토리 리스트에 등록
    const li = document.createElement('li');
    li.className = `history-item ${isSeed ? 'seed-item' : ''}`;
    li.textContent = isSeed ? `[시작] ${word}` : word;
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
    this.wordCountEl.textContent = this.placedWords.length;
    this.scoreEl.textContent = this.score;
  }

  showToast(msg) {
    this.bubbleEl.textContent = msg;
    this.bubbleEl.classList.add('show');
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      this.bubbleEl.classList.remove('show');
    }, 2400);
  }

  showHint() {
    // 아직 사용되지 않은 단어 중 현재 보드에 교차 가능한 단어 하나 찾기
    for (const item of TRICKCAL_DICTIONARY) {
      if (!this.usedWords.has(item.word)) {
        const p = this.findPlacement(item.word);
        if (p) {
          this.inputEl.value = item.word;
          this.showToast(`추천 단어: "${item.word}" (엔터를 누르면 연결됩니다)`);
          return;
        }
      }
    }
    this.showToast("현재 연결할 수 있는 남은 단어가 없습니다!");
  }
}

// 브라우저 로드 시 게임 인스턴스 시작
window.addEventListener('DOMContentLoaded', () => {
  window.game = new CrosswordGame();
});