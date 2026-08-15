// Utilitários de manipulação de cores para o card de atleta FUT
// Funções para escurecimento dinâmico e garantia de contraste legível

/**
 * Escurece uma cor HEX pela porcentagem indicada (default 20%)
 * Retorna string HEX escurecida
 */
export function darken(hex, percent = 20) {
  if (!hex || typeof hex !== 'string') return '#0A1F16';
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return '#0A1F16';

  const num = parseInt(clean, 16);
  const factor = Math.max(0, Math.min(1, (100 - percent) / 100));

  let r = Math.floor(((num >> 16) & 255) * factor);
  let g = Math.floor(((num >> 8) & 255) * factor);
  let b = Math.floor((num & 255) * factor);

  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Retorna #FFFFFF ou #0F172A para contraste perfeito sobre a cor informada
 * Baseado no cálculo YIQ de luminância perceptiva
 */
export function getContrastColor(hex) {
  if (!hex || typeof hex !== 'string') return '#FFFFFF';
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return '#FFFFFF';

  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#0F172A' : '#FFFFFF';
}
