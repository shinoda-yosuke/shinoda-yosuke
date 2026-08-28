// Message log. kind: info | good | bad | floor | sys
export function msg(g, text, kind = 'info') {
  g.logCount = (g.logCount || 0) + 1;
  g.log.push({ n: g.logCount, t: g.turn, text, kind });
  if (g.log.length > 200) g.log.splice(0, g.log.length - 200);
}
