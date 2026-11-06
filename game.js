(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const shell = document.querySelector('.game-shell');
  const startOverlay = document.getElementById('startOverlay');
  const upgradeOverlay = document.getElementById('upgradeOverlay');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const upgradeOptions = document.getElementById('upgradeOptions');
  const keys = new Set();
  function readBest() { try { return Math.max(0, Number(localStorage.getItem('night-market-best')) || 0); } catch { return 0; } }
  const state = {
    mode: 'menu', time: 0, wave: 1, kills: 0, level: 1, xp: 0, xpNeeded: 6, lastFrame: 0,
    spawnClock: 0, attackClock: 0, bossClock: 0, enemies: [], shots: [], drops: [], particles: [], floating: [],
    score: 0, best: readBest(), sound: true, joystick: { active: false, pointerId: null, dx: 0, dy: 0 },
    player: { x: 480, y: 300, radius: 17, speed: 205, hp: 4, maxHp: 4, damage: 1, fireRate: 0.55, shotSpeed: 430, dash: 0, invulnerable: 0, facing: 1 },
    boss: null, upgrades: { magnet: 90, dash: 1 },
  };
  const ui = {
    time: document.getElementById('timeStat'), wave: document.getElementById('waveStat'), kills: document.getElementById('killStat'),
    level: document.getElementById('levelText'), hearts: document.getElementById('hearts'), hpCount: document.getElementById('hpCount'),
    health: document.querySelector('.health-hud'), joystick: document.getElementById('joystick'), joystickKnob: document.getElementById('joystickKnob'), xpFill: document.getElementById('xpFill'),
    xpLabel: document.getElementById('xpLabel'), best: document.getElementById('bestStat'), bossHud: document.getElementById('bossHud'), bossFill: document.getElementById('bossFill'),
  };
  const C = { ink: '#173a33', paper: '#f5eedb', mint: '#a9e3bc', lime: '#d7ed6d', coral: '#ff8875' };
  const deck = [
    { icon: '✦', title: '加大奶泡', copy: '攻击伤害 +1', apply: () => { state.player.damage += 1; } },
    { icon: '➤', title: '轻装上阵', copy: '移动速度 +12%', apply: () => { state.player.speed *= 1.12; } },
    { icon: '☄', title: '连环奶弹', copy: '攻击速度 +18%', apply: () => { state.player.fireRate *= 0.82; } },
    { icon: '♥', title: '加一条命', copy: '生命上限 +1，并回复 1 点', apply: () => { state.player.maxHp++; state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1); updateHud(); } },
    { icon: '✹', title: '磁吸小挎包', copy: '经验糖果吸引范围 +90', apply: () => { state.upgrades.magnet += 90; } },
    { icon: '⚡', title: '奶龙滑步', copy: '冲刺冷却缩短 20%', apply: () => { state.upgrades.dash *= 0.8; } },
  ];
  const stars = Array.from({ length: 48 }, (_, i) => ({ x: (i * 197 + 31) % canvas.width, y: (i * 113 + 17) % canvas.height, size: i % 5 === 0 ? 2 : 1, phase: i * 0.73 % 7 }));
  function formatTime(seconds) { const t = Math.floor(seconds); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function saveBest(value) { try { localStorage.setItem('night-market-best', String(value)); } catch { /* Optional persistence. */ } }
  function updateHud() {
    ui.time.textContent = formatTime(state.time); ui.wave.textContent = String(state.wave); ui.kills.textContent = String(state.kills);
    ui.level.textContent = `Lv. ${state.level}`; ui.xpFill.style.width = `${Math.min(100, state.xp / state.xpNeeded * 100)}%`;
    ui.xpLabel.textContent = `经验 ${state.xp} / ${state.xpNeeded}`;
    ui.hpCount.textContent = `${state.player.hp} / ${state.player.maxHp}`;
    ui.hearts.setAttribute('aria-label', `生命值 ${state.player.hp} / ${state.player.maxHp}`);
    ui.hearts.innerHTML = Array.from({ length: state.player.maxHp }, (_, i) => `<span class="${i >= state.player.hp ? 'lost' : ''}">${i < state.player.hp ? '♥' : '♡'}</span>`).join('');
    ui.best.textContent = formatTime(state.best);
    if (state.boss) { ui.bossHud.classList.remove('hidden'); ui.bossFill.style.width = `${Math.max(0, state.boss.hp / state.boss.maxHp * 100)}%`; }
    else ui.bossHud.classList.add('hidden');
  }
  function showDamageFeedback(damage) {
    ui.health.classList.remove('damaged');
    requestAnimationFrame(() => {
      ui.health.classList.add('damaged');
      window.setTimeout(() => ui.health.classList.remove('damaged'), 380);
    });
    floatText(state.player.x, state.player.y - 27, `-${damage} ♥`, C.coral, 15);
  }
  function resetJoystick() {
    state.joystick.active = false;
    state.joystick.pointerId = null;
    state.joystick.dx = 0;
    state.joystick.dy = 0;
    ui.joystick.classList.remove('active');
    ui.joystick.setAttribute('aria-valuetext', '居中');
    ui.joystickKnob.style.transform = 'translate(-50%, -50%)';
  }
  function startGame() {
    Object.assign(state, { mode: 'playing', time: 0, wave: 1, kills: 0, level: 1, xp: 0, xpNeeded: 6, spawnClock: 0.7, attackClock: 0, bossClock: 0, enemies: [], shots: [], drops: [], particles: [], floating: [], boss: null });
    Object.assign(state.player, { x: canvas.width / 2, y: canvas.height / 2, speed: 205, hp: 4, maxHp: 4, damage: 1, fireRate: 0.55, shotSpeed: 430, dash: 0, invulnerable: 1, facing: 1 });
    state.upgrades = { magnet: 90, dash: 1 }; keys.clear(); resetJoystick();
    startOverlay.classList.add('hidden'); upgradeOverlay.classList.add('hidden'); gameOverOverlay.classList.add('hidden'); shell.classList.add('is-running'); updateHud();
  }
  function endGame() {
    state.mode = 'gameover'; state.best = Math.max(state.best, state.time); saveBest(state.best); updateHud();
    document.getElementById('resultText').textContent = `奶团龙坚持了 ${formatTime(state.time)}，夜市热度 ${Math.floor(state.score)}。下一波会更难。`;
    document.getElementById('resultKills').textContent = String(state.kills); document.getElementById('resultWave').textContent = `第 ${state.wave} 波`;
    gameOverOverlay.classList.remove('hidden'); shell.classList.remove('is-running'); playTone(150, 0.2, 'sawtooth');
  }
  function openUpgrade() {
    state.mode = 'upgrade'; const choices = [...deck].sort(() => Math.random() - 0.5).slice(0, 3);
    upgradeOptions.replaceChildren(...choices.map((item) => {
      const button = document.createElement('button'); button.className = 'upgrade-card'; button.type = 'button';
      button.innerHTML = `<span class="upgrade-icon" aria-hidden="true">${item.icon}</span><strong>${item.title}</strong><small>${item.copy}</small>`;
      button.addEventListener('click', () => { item.apply(); upgradeOverlay.classList.add('hidden'); state.mode = 'playing'; updateHud(); }); return button;
    }));
    upgradeOverlay.classList.remove('hidden'); playTone(640, 0.08, 'sine');
  }
  function gainXp(amount) {
    state.xp += amount;
    if (state.xp >= state.xpNeeded) { state.xp -= state.xpNeeded; state.level++; state.xpNeeded = Math.ceil(state.xpNeeded * 1.38 + 2); updateHud(); openUpgrade(); }
    else updateHud();
  }
  function spawnEnemy(kind) {
    const edge = Math.floor(Math.random() * 4); const margin = 30;
    const x = edge === 0 || edge === 2 ? rand(0, canvas.width) : edge === 1 ? canvas.width + margin : -margin;
    const y = edge === 1 || edge === 3 ? rand(0, canvas.height) : edge === 0 ? -margin : canvas.height + margin;
    const scale = 1 + Math.max(0, state.wave - 1) * 0.095;
    const stats = kind === 'boss' ? { radius: 34, hp: 28 + state.wave * 5, speed: 60 + state.wave * 1.7, damage: 2, xp: 10 }
      : kind === 'tank' ? { radius: 22, hp: 3 * scale, speed: 43 + Math.min(state.wave * 1.4, 28), damage: 1, xp: 3 }
      : { radius: kind === 'runner' ? 13 : 16, hp: (kind === 'runner' ? 1.5 : 2) * scale, speed: (kind === 'runner' ? 105 : 70) + Math.min(state.wave * 2.2, 45), damage: 1, xp: kind === 'runner' ? 2 : 1 };
    const enemy = { x, y, kind, ...stats, maxHp: stats.hp, hit: 0, phase: Math.random() * Math.PI * 2 };
    if (kind === 'boss') state.boss = enemy; state.enemies.push(enemy);
  }
  function spawnBoss() { if (state.boss) return; spawnEnemy('boss'); floatText(canvas.width / 2, 90, '催单王来袭！', '#ffb2a1', 18); playTone(210, 0.22, 'triangle'); }
  function nearestEnemy() {
    let target = null; let bestDist = Infinity;
    for (const enemy of state.enemies) { const d = (enemy.x - state.player.x) ** 2 + (enemy.y - state.player.y) ** 2; if (d < bestDist) { bestDist = d; target = enemy; } }
    return target;
  }
  function shoot() {
    const target = nearestEnemy(); if (!target) return;
    const dx = target.x - state.player.x; const dy = target.y - state.player.y; const length = Math.hypot(dx, dy) || 1;
    state.shots.push({ x: state.player.x, y: state.player.y, vx: dx / length * state.player.shotSpeed, vy: dy / length * state.player.shotSpeed, radius: 6, damage: state.player.damage, life: 1.8 });
    state.player.facing = dx >= 0 ? 1 : -1; playTone(510, 0.035, 'sine');
  }
  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) { const angle = rand(0, Math.PI * 2); const speed = rand(35, 155); state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: rand(0.25, 0.7), maxLife: 0.7, size: rand(2, 5), color }); }
  }
  function floatText(x, y, text, color = '#f5eedb', size = 12) { state.floating.push({ x, y, text, color, size, life: 0.85 }); }
  function killEnemy(index) {
    const enemy = state.enemies[index]; burst(enemy.x, enemy.y, enemy.kind === 'boss' ? C.coral : '#f1b878', enemy.kind === 'boss' ? 28 : 10);
    state.drops.push({ x: enemy.x, y: enemy.y, radius: enemy.kind === 'boss' ? 8 : 5, value: enemy.xp, pulse: 0 });
    if (enemy.kind === 'boss') { state.boss = null; floatText(enemy.x, enemy.y - 30, '首领击退！', C.lime, 15); }
    state.enemies.splice(index, 1); state.kills++; state.score += 25; playTone(enemy.kind === 'boss' ? 790 : 310, enemy.kind === 'boss' ? 0.14 : 0.06, 'triangle');
  }
  function movePlayer(dt) {
    const p = state.player; let dx = 0; let dy = 0;
    if (keys.has('arrowleft') || keys.has('a')) dx--;
    if (keys.has('arrowright') || keys.has('d')) dx++;
    if (keys.has('arrowup') || keys.has('w')) dy--;
    if (keys.has('arrowdown') || keys.has('s')) dy++;
    if (state.joystick.active) { dx += state.joystick.dx; dy += state.joystick.dy; }
    const length = Math.hypot(dx, dy);
    if (length > 0) { dx /= length; dy /= length; p.x += dx * p.speed * dt; p.y += dy * p.speed * dt; if (dx) p.facing = dx > 0 ? 1 : -1; }
    p.x = Math.max(p.radius + 5, Math.min(canvas.width - p.radius - 5, p.x)); p.y = Math.max(p.radius + 30, Math.min(canvas.height - p.radius - 30, p.y));
    p.dash = Math.max(0, p.dash - dt); p.invulnerable = Math.max(0, p.invulnerable - dt);
  }
  function dash() {
    if (state.mode !== 'playing' || state.player.dash > 0) return;
    const p = state.player; let dx = 0; let dy = 0;
    if (keys.has('arrowleft') || keys.has('a')) dx--;
    if (keys.has('arrowright') || keys.has('d')) dx++;
    if (keys.has('arrowup') || keys.has('w')) dy--;
    if (keys.has('arrowdown') || keys.has('s')) dy++;
    if (state.joystick.active) { dx += state.joystick.dx; dy += state.joystick.dy; }
    if (!dx && !dy) { const target = nearestEnemy(); dx = target ? p.x - target.x : p.facing; dy = target ? p.y - target.y : 0; }
    const length = Math.hypot(dx, dy) || 1;
    p.x = Math.max(p.radius, Math.min(canvas.width - p.radius, p.x + dx / length * 100)); p.y = Math.max(p.radius + 20, Math.min(canvas.height - p.radius - 20, p.y + dy / length * 100));
    p.dash = 1.25 * state.upgrades.dash; p.invulnerable = Math.max(p.invulnerable, 0.32); burst(p.x, p.y, C.mint, 8); playTone(850, 0.07, 'sine');
  }
  function update(dt) {
    if (state.mode !== 'playing') return;
    state.time += dt;
    const waveNow = 1 + Math.floor(state.time / 24);
    if (waveNow !== state.wave) {
      state.wave = waveNow; floatText(canvas.width / 2, 120, `第 ${state.wave} 波`, C.lime, 17);
      if (state.wave % 5 === 0) { state.bossWave = state.wave; spawnBoss(); }
    }
    state.spawnClock -= dt;
    if (state.spawnClock <= 0) {
      const kind = state.wave >= 3 && Math.random() < 0.25 ? 'tank' : Math.random() < 0.28 ? 'runner' : 'mouse';
      spawnEnemy(kind); state.spawnClock = Math.max(0.27, 1.05 - state.wave * 0.045) * rand(0.72, 1.22);
    }
    movePlayer(dt); state.attackClock -= dt;
    if (state.attackClock <= 0) { shoot(); state.attackClock = state.player.fireRate; }
    for (const enemy of state.enemies) {
      const dx = state.player.x - enemy.x; const dy = state.player.y - enemy.y; const length = Math.hypot(dx, dy) || 1;
      const pace = enemy.kind === 'boss' && length < 115 ? 0.28 : 1;
      enemy.x += dx / length * enemy.speed * pace * dt; enemy.y += dy / length * enemy.speed * pace * dt; enemy.phase += dt * 4; enemy.hit = Math.max(0, enemy.hit - dt);
      if (length < enemy.radius + state.player.radius && state.player.invulnerable <= 0) {
        state.player.hp = Math.max(0, state.player.hp - enemy.damage); state.player.invulnerable = 0.82; burst(state.player.x, state.player.y, C.coral, 12); updateHud(); showDamageFeedback(enemy.damage); playTone(130, 0.13, 'sawtooth');
        if (state.player.hp <= 0) { endGame(); return; }
      }
    }
    for (let i = state.shots.length - 1; i >= 0; i--) {
      const shot = state.shots[i]; shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
      let remove = shot.life <= 0 || shot.x < -15 || shot.x > canvas.width + 15 || shot.y < -15 || shot.y > canvas.height + 15;
      for (let j = state.enemies.length - 1; j >= 0 && !remove; j--) {
        const enemy = state.enemies[j];
        if (Math.hypot(shot.x - enemy.x, shot.y - enemy.y) < shot.radius + enemy.radius) {
          enemy.hp -= shot.damage; enemy.hit = 0.11; burst(shot.x, shot.y, C.lime, 3); remove = true;
          if (enemy.hp <= 0) killEnemy(j);
        }
      }
      if (remove) state.shots.splice(i, 1);
    }
    for (let i = state.drops.length - 1; i >= 0; i--) {
      const drop = state.drops[i]; drop.pulse += dt * 4;
      const dx = state.player.x - drop.x; const dy = state.player.y - drop.y; const distance = Math.hypot(dx, dy);
      if (distance < state.upgrades.magnet && distance > 1) { drop.x += dx / distance * 190 * dt; drop.y += dy / distance * 190 * dt; }
      if (distance < state.player.radius + drop.radius + 4) {
        gainXp(drop.value); state.drops.splice(i, 1); burst(drop.x, drop.y, C.lime, 5);
        if (state.mode !== 'playing') break;
      }
    }
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floating.length - 1; i >= 0; i--) {
      const text = state.floating[i]; text.y -= 24 * dt; text.life -= dt; if (text.life <= 0) state.floating.splice(i, 1);
    }
    state.score += dt * 3; updateHud();
  }
  function drawBackground(timestamp) {
    ctx.fillStyle = '#294e40'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#315746';
    for (let y = 0; y < canvas.height; y += 72) for (let x = (Math.floor(y / 72) % 2) * 36; x < canvas.width; x += 72) ctx.fillRect(x + 2, y + 2, 68, 68);
    ctx.strokeStyle = '#afc18425'; ctx.lineWidth = 2;
    for (let x = 30; x < canvas.width; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 25, canvas.height); ctx.stroke(); }
    for (const star of stars) {
      const glow = 0.35 + (Math.sin(timestamp / 600 + star.phase) + 1) * 0.2;
      ctx.fillStyle = `rgba(236,239,193,${glow})`; ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.fillStyle = '#142f28'; ctx.fillRect(0, 0, canvas.width, 22); ctx.fillRect(0, canvas.height - 22, canvas.width, 22);
    ctx.fillStyle = '#e0cf9a'; for (let x = 18; x < canvas.width; x += 48) { ctx.fillRect(x, 9, 18, 2); ctx.fillRect(x, canvas.height - 11, 18, 2); }
  }
  function drawDragon(timestamp) {
    const p = state.player; if (p.invulnerable > 0 && Math.floor(timestamp / 75) % 2 === 0) return;
    const bob = Math.sin(timestamp / 120) * 1.7;
    ctx.save(); ctx.translate(p.x, p.y + bob); ctx.scale(p.facing, 1);
    if (p.dash > 0) { ctx.fillStyle = '#c9ffe755'; ctx.beginPath(); ctx.ellipse(-23, 0, 26, 13, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#173a33'; ctx.beginPath(); ctx.ellipse(0, 15, 17, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#99d9ad'; ctx.beginPath(); ctx.ellipse(0, 1, 16, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d7efc5'; ctx.beginPath(); ctx.ellipse(3, 7, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dbed78'; ctx.beginPath(); ctx.moveTo(-9, -12); ctx.quadraticCurveTo(-15, -29, -5, -23); ctx.quadraticCurveTo(1, -22, 0, -13); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, -13); ctx.quadraticCurveTo(12, -30, 17, -19); ctx.quadraticCurveTo(18, -12, 12, -9); ctx.fill();
    ctx.fillStyle = '#173a33'; ctx.beginPath(); ctx.arc(5, -1, 2, 0, Math.PI * 2); ctx.arc(14, -1, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e98876'; ctx.beginPath(); ctx.ellipse(11, 5, 2.6, 1.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#80bb91'; ctx.beginPath(); ctx.moveTo(-13, 4); ctx.quadraticCurveTo(-28, -1, -23, -10); ctx.quadraticCurveTo(-18, -6, -13, -3); ctx.fill(); ctx.restore();
  }
  function drawMouse(enemy, timestamp) {
    const bob = Math.sin(timestamp / 110 + enemy.phase) * 1.5;
    ctx.save(); ctx.translate(enemy.x, enemy.y + bob);
    ctx.fillStyle = '#593d32'; ctx.beginPath(); ctx.ellipse(0, enemy.radius * 0.7, enemy.radius, enemy.radius * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    if (enemy.kind === 'tank' || enemy.kind === 'boss') {
      ctx.fillStyle = enemy.kind === 'boss' ? '#e48b68' : '#d19a6c';
      ctx.beginPath(); ctx.arc(-enemy.radius * 0.58, -enemy.radius * 0.62, enemy.radius * 0.4, 0, Math.PI * 2); ctx.arc(enemy.radius * 0.58, -enemy.radius * 0.62, enemy.radius * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8a996'; ctx.beginPath(); ctx.arc(-enemy.radius * 0.58, -enemy.radius * 0.62, enemy.radius * 0.22, 0, Math.PI * 2); ctx.arc(enemy.radius * 0.58, -enemy.radius * 0.62, enemy.radius * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = enemy.hit ? '#fff1c8' : enemy.kind === 'boss' ? '#e88965' : '#d6a06c'; ctx.beginPath(); ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2); ctx.fill();
      if (enemy.kind === 'boss') {
        ctx.fillStyle = '#b64537'; ctx.beginPath(); ctx.roundRect(-enemy.radius * 0.82, -enemy.radius * 0.18, enemy.radius * 1.64, enemy.radius * 0.42, 4); ctx.fill();
        ctx.fillStyle = '#fff0d6'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('急急', 0, -2);
        ctx.fillStyle = '#703f32'; ctx.beginPath(); ctx.arc(-7, 1, 2, 0, Math.PI * 2); ctx.arc(7, 1, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e9c862'; ctx.fillRect(-18, -enemy.radius - 9, 10, 9); ctx.fillRect(8, -enemy.radius - 9, 10, 9); ctx.fillRect(-5, -enemy.radius - 13, 10, 13);
      } else {
        ctx.fillStyle = '#3e342b'; ctx.beginPath(); ctx.arc(-6, -2, 2, 0, Math.PI * 2); ctx.arc(6, -2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#df7669'; ctx.beginPath(); ctx.arc(0, 4, 3, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = enemy.hit ? '#fff1c8' : '#e8b17c'; ctx.beginPath(); ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e49386'; ctx.beginPath(); ctx.arc(-8, -9, 6, 0, Math.PI * 2); ctx.arc(8, -9, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#342e25'; ctx.beginPath(); ctx.arc(-5, -1, 1.6, 0, Math.PI * 2); ctx.arc(5, -1, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c94e45'; ctx.beginPath(); ctx.roundRect(-9, 6, 18, 8, 3); ctx.fill(); ctx.fillStyle = '#f7d8b2'; ctx.fillRect(-5, 8, 10, 2);
    }
    if (enemy.kind !== 'boss' && enemy.hp < enemy.maxHp) {
      ctx.fillStyle = '#193b32'; ctx.fillRect(-enemy.radius, -enemy.radius - 8, enemy.radius * 2, 3);
      ctx.fillStyle = C.coral; ctx.fillRect(-enemy.radius, -enemy.radius - 8, enemy.radius * 2 * Math.max(0, enemy.hp / enemy.maxHp), 3);
    }
    ctx.restore();
  }
  function draw(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground(timestamp);
    for (const drop of state.drops) {
      const pulse = 1 + Math.sin(drop.pulse) * 0.18; ctx.save(); ctx.translate(drop.x, drop.y); ctx.scale(pulse, pulse);
      ctx.fillStyle = '#e1ed80'; ctx.beginPath(); ctx.arc(0, 0, drop.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#55794d'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('糖', 0, 0.5); ctx.restore();
    }
    for (const shot of state.shots) { ctx.fillStyle = '#f0d978'; ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff7bf'; ctx.beginPath(); ctx.arc(shot.x - 1, shot.y - 2, 2, 0, Math.PI * 2); ctx.fill(); }
    for (const enemy of state.enemies) drawMouse(enemy, timestamp);
    for (const p of state.particles) { ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    for (const text of state.floating) { ctx.globalAlpha = Math.max(0, Math.min(1, text.life * 1.7)); ctx.fillStyle = text.color; ctx.font = `900 ${text.size}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(text.text, text.x, text.y); ctx.globalAlpha = 1; }
    drawDragon(timestamp);
    if (state.mode === 'menu') {
      ctx.fillStyle = '#f0d978'; ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, 56 + Math.sin(timestamp / 350) * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#264d3e'; ctx.font = '900 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('夜市开张 · 来战', canvas.width / 2, canvas.height / 2 + 5);
    }
  }
  function frame(timestamp) {
    const dt = Math.min((timestamp - (state.lastFrame || timestamp)) / 1000, 0.035);
    state.lastFrame = timestamp; update(dt); draw(timestamp); requestAnimationFrame(frame);
  }
  let audioContext = null;
  function playTone(frequency, duration, type) {
    if (!state.sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
      oscillator.type = type; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
    } catch { /* Audio is optional. */ }
  }
  document.getElementById('startButton').addEventListener('click', startGame);
  document.getElementById('retryButton').addEventListener('click', startGame);
  document.getElementById('dashButton').addEventListener('pointerdown', (event) => { event.preventDefault(); dash(); });
  document.getElementById('soundButton').addEventListener('click', (event) => {
    state.sound = !state.sound; event.currentTarget.textContent = state.sound ? '♫' : '♪';
    event.currentTarget.setAttribute('aria-label', state.sound ? '关闭音效' : '开启音效');
  });
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(key)) event.preventDefault();
    keys.add(key); if (key === ' ' && !event.repeat) dash();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); resetJoystick(); });
  function updateJoystick(event) {
    const rect = ui.joystick.getBoundingClientRect();
    const knob = ui.joystickKnob.getBoundingClientRect();
    const maxDistance = (rect.width - knob.width) / 2 - 4;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const scale = distance > maxDistance ? maxDistance / distance : 1;
    const offsetX = dx * scale;
    const offsetY = dy * scale;
    const strength = distance < 8 ? 0 : Math.min(1, distance / maxDistance);
    state.joystick.dx = distance < 8 ? 0 : dx / distance * strength;
    state.joystick.dy = distance < 8 ? 0 : dy / distance * strength;
    ui.joystickKnob.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
    ui.joystick.classList.toggle('active', strength > 0);
    const directions = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
    const direction = strength > 0 ? directions[Math.round((Math.atan2(state.joystick.dy, state.joystick.dx) * 4 / Math.PI + 8) % 8)] : '居中';
    ui.joystick.setAttribute('aria-valuetext', direction);
  }
  ui.joystick.addEventListener('pointerdown', (event) => {
    if (state.mode !== 'playing' || state.joystick.active) return;
    event.preventDefault();
    event.stopPropagation();
    state.joystick.active = true;
    state.joystick.pointerId = event.pointerId;
    ui.joystick.setPointerCapture(event.pointerId);
    updateJoystick(event);
  });
  ui.joystick.addEventListener('pointermove', (event) => {
    if (state.joystick.active && event.pointerId === state.joystick.pointerId) updateJoystick(event);
  });
  ui.joystick.addEventListener('pointerup', (event) => {
    if (event.pointerId === state.joystick.pointerId) resetJoystick();
  });
  ui.joystick.addEventListener('pointercancel', (event) => {
    if (event.pointerId === state.joystick.pointerId) resetJoystick();
  });
  ui.joystick.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === state.joystick.pointerId) resetJoystick();
  });
  ui.best.textContent = formatTime(state.best); updateHud(); requestAnimationFrame(frame);
})();
