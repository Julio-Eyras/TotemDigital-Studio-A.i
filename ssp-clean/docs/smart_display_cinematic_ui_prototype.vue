<template>
  <div class="app" :data-theme="theme.name">
    <!-- Floating Theme Selector -->
    <div class="theme-menu glass">
      <div
        v-for="t in themes"
        :key="t.name"
        class="theme-item"
        @click="applyTheme(t)"
      >
        {{ t.name }}
      </div>
    </div>

    <!-- Main HUD -->
    <div class="hud">
      <div class="glass panel left">
        <h2>Status</h2>
        <p>Smart Display Online</p>
        <div class="orb"></div>
      </div>

      <div class="glass panel center">
        <h1>SMART DISPLAY</h1>
        <p class="subtitle">Cinematic Interface Prototype</p>
        <button class="neon-btn">EXECUTE</button>
      </div>

      <div class="glass panel right">
        <h2>Metrics</h2>
        <ul>
          <li>FPS: 60</li>
          <li>Sync: OK</li>
          <li>Theme: {{ theme.name }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue'

const themes = [
  {
    name: 'Minority Report',
    vars: {
      '--accent': '#00e5ff',
      '--bg': '#eef6fa',
      '--glass-opacity': '0.35'
    }
  },
  {
    name: 'Oblivion',
    vars: {
      '--accent': '#bcdfff',
      '--bg': '#f4f7f9',
      '--glass-opacity': '0.25'
    }
  },
  {
    name: 'Iron Man',
    vars: {
      '--accent': '#ff3c00',
      '--bg': '#05080c',
      '--glass-opacity': '0.28'
    }
  },
  {
    name: 'Blade Runner',
    vars: {
      '--accent': '#ff8a00',
      '--bg': '#0b0614',
      '--glass-opacity': '0.32'
    }
  },
  {
    name: 'Matrix',
    vars: {
      '--accent': '#00ff66',
      '--bg': '#000000',
      '--glass-opacity': '0.22'
    }
  }
]

const theme = reactive({ ...themes[0] })

function applyTheme(t) {
  Object.assign(theme, t)
  Object.entries(t.vars).forEach(([key, val]) => {
    document.documentElement.style.setProperty(key, val)
  })
}

onMounted(() => applyTheme(theme))
</script>

<style>
:root {
  --accent: #00e5ff;
  --bg: #0b0f14;
  --glass-opacity: 0.35;
}

* {
  box-sizing: border-box;
  font-family: 'Orbitron', 'Inter', sans-serif;
}

body {
  margin: 0;
}

.app {
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at top, var(--accent), var(--bg));
  color: white;
  overflow: hidden;
}

.glass {
  background: rgba(20, 30, 40, var(--glass-opacity));
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 18px;
  box-shadow: 0 0 40px rgba(0,0,0,0.4);
}

.hud {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  height: 100%;
  padding: 40px;
  gap: 30px;
}

.panel {
  padding: 30px;
}

.panel.center {
  text-align: center;
}

.subtitle {
  opacity: 0.7;
  margin-bottom: 30px;
}

.neon-btn {
  padding: 14px 34px;
  background: transparent;
  border: 1px solid var(--accent);
  color: var(--accent);
  font-size: 16px;
  letter-spacing: 2px;
  border-radius: 40px;
  box-shadow: 0 0 20px var(--accent);
  cursor: pointer;
}

.orb {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent), transparent 70%);
  margin-top: 20px;
}

.theme-menu {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 10px;
}

.theme-item {
  cursor: pointer;
  padding: 6px 14px;
  opacity: 0.7;
}

.theme-item:hover {
  opacity: 1;
  color: var(--accent);
}
</style>
