// Convert RGB to relative luminance
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio
function getContrastRatio(l1, l2) {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// Current colors
const fg = { r: 34, g: 34, b: 34 };  // #222222
const bg = { r: 245, g: 240, b: 217 };  // #f5f0d9

const fgLum = getLuminance(fg.r, fg.g, fg.b);
const bgLum = getLuminance(bg.r, bg.g, bg.b);
const currentRatio = getContrastRatio(fgLum, bgLum);

console.log('Current contrast:');
console.log('  Foreground: rgb(' + fg.r + ', ' + fg.g + ', ' + fg.b + ') = #' + fg.r.toString(16).padStart(2,'0') + fg.g.toString(16).padStart(2,'0') + fg.b.toString(16).padStart(2,'0'));
console.log('  Background: rgb(' + bg.r + ', ' + bg.g + ', ' + bg.b + ') = #f5f0d9');
console.log('  Contrast ratio:', currentRatio.toFixed(2) + ':1');
console.log('  WCAG AA (4.5:1):', currentRatio >= 4.5 ? 'PASS' : 'FAIL');

// Issue states #797979 on #f1f1f1
const issueFg = { r: 0x79, g: 0x79, b: 0x79 };
const issueBg = { r: 0xf1, g: 0xf1, b: 0xf1 };
const issueFgLum = getLuminance(issueFg.r, issueFg.g, issueFg.b);
const issueBgLum = getLuminance(issueBg.r, issueBg.g, issueBg.b);
const issueRatio = getContrastRatio(issueFgLum, issueBgLum);

console.log('\nIssue states:');
console.log('  Foreground: #797979');
console.log('  Background: #f1f1f1');
console.log('  Contrast ratio:', issueRatio.toFixed(2) + ':1');
console.log('  WCAG AA (4.5:1):', issueRatio >= 4.5 ? 'PASS' : 'FAIL');
