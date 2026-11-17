// One sky per night: the garden's palette, its name and its moon shift as the five
// nights pass, so each night reads differently at a glance. The renderer picks the
// theme for the current wave; the title screen uses the first night's dusk.

export const NIGHT_THEMES = [
  {
    name: 'Dusk',
    skyTop: '#1a1440',
    skyBottom: '#2a1e4d',
    grass: '#14233a',
    moon: '#ffe9a8',
    moonSize: 1,
  },
  {
    name: 'Deep Night',
    skyTop: '#0b1030',
    skyBottom: '#141a3d',
    grass: '#101d2e',
    moon: '#f4ead8',
    moonSize: 1,
  },
  {
    name: 'Violet Hour',
    skyTop: '#160b33',
    skyBottom: '#2a1547',
    grass: '#1a1433',
    moon: '#e8d8ff',
    moonSize: 1.1,
  },
  {
    name: 'Blood Moon',
    skyTop: '#1c0b1e',
    skyBottom: '#33122a',
    grass: '#221028',
    moon: '#ff9a7a',
    moonSize: 1.25,
  },
  {
    name: 'The Longest Night',
    skyTop: '#070a18',
    skyBottom: '#101736',
    grass: '#0c1626',
    moon: '#fff6d8',
    moonSize: 1.4,
  },
];

/** The theme for a wave number (1-based); later waves keep the last night's sky. */
export function themeForWave(wave) {
  return NIGHT_THEMES[Math.min(Math.max(wave, 1), NIGHT_THEMES.length) - 1];
}
