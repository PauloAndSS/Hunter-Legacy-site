export const mod = (n) => Math.floor((Number(n ?? 10) - 10) / 2);
export const prof = (s) =>
  s.level <= 20 ? 2 + Math.floor((Math.max(1, s.level) - 1) / 4) : Number(s.proficiency || 6);
