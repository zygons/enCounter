const fs = require('fs');
const css = fs.readFileSync('programs/app/css/theme-fantasy.css', 'utf8');
const m = css.match(/body\.theme-fantasy \.combatant-card\.combatant-row\.current::before\s*\{([^}]*)\}/g) || [];
if (!m.some(block => /background:\s*var\(--fantasy-turn-accent\)/.test(block))) {
  throw new Error('Fantasy current-turn pseudo marker must override inherited background with fantasy accent.');
}
if (!m.some(block => /box-shadow:\s*0 0 9px rgba\(242, 167, 43/.test(block))) {
  throw new Error('Fantasy current-turn pseudo marker must override inherited cyan glow.');
}
console.log('PASS fantasy current-turn marker owns background and glow');
