const db = require('../config/database');

const verificarRegra2Horas = async (peladaId) => {
  try {
    const query = `SELECT data, horario FROM peladas WHERE id = $1`;
    const { rows } = await db.query(query, [peladaId]);

    if (rows.length === 0) return false;

    const row = rows[0];
    if (!row.data) return false;

    let year, month, day;
    if (row.data instanceof Date) {
      year = row.data.getFullYear();
      month = String(row.data.getMonth() + 1).padStart(2, '0');
      day = String(row.data.getDate()).padStart(2, '0');
    } else {
      const parts = String(row.data).split('T')[0].split('-');
      year = parts[0];
      month = parts[1];
      day = parts[2];
    }

    let timeStr = row.horario ? String(row.horario).trim() : '19:00';
    const timeParts = timeStr.split(':');
    const horaStr = String(timeParts[0] || '19').padStart(2, '0');
    const minStr = String(timeParts[1] || '00').padStart(2, '0');

    // Suporte aos fusos horários do Brasil: Manaus (-04:00) e Brasília (-03:00)
    const peladaManaus = new Date(`${year}-${month}-${day}T${horaStr}:${minStr}:00-04:00`);
    const peladaBrasilia = new Date(`${year}-${month}-${day}T${horaStr}:${minStr}:00-03:00`);
    const agora = new Date();

    if (isNaN(peladaManaus.getTime()) && isNaN(peladaBrasilia.getTime())) {
      console.warn('[verificarRegra2Horas] Data/hora inválida para a pelada ID:', peladaId, row.data, row.horario);
      return true; // Em caso de parse inválido, permite o estorno
    }

    const diffMsManaus = peladaManaus.getTime() - agora.getTime();
    const diffMsBrasilia = peladaBrasilia.getTime() - agora.getTime();
    
    // Considera o maior tempo restante entre os fusos brasileiros (Manaus -04:00 ou Brasília -03:00)
    const diffHoras = Math.max(diffMsManaus, diffMsBrasilia) / (1000 * 60 * 60);
    console.log(`[verificarRegra2Horas] Pelada #${peladaId} - Horas restantes calculadas (Manaus/Brasília):`, diffHoras.toFixed(2));

    return diffHoras >= 2; // Retorna true se faltar 2h ou mais em relação ao fuso local
  } catch (err) {
    console.error('[verificarRegra2Horas] Erro ao verificar regra das 2 horas:', err);
    return true; // Na dúvida, permite estorno ao atleta
  }
};

module.exports = { verificarRegra2Horas };
