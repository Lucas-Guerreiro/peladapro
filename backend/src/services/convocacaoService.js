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
    const hora = parseInt(timeParts[0] || 0, 10);
    const min = parseInt(timeParts[1] || 0, 10);

    const peladaDateTime = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), hora, min, 0);
    const agora = new Date();

    if (isNaN(peladaDateTime.getTime())) {
      console.warn('[verificarRegra2Horas] Data/hora inválida para a pelada ID:', peladaId, row.data, row.horario);
      return true; // Em caso de parse inválido, permite o estorno
    }

    const diffMs = peladaDateTime.getTime() - agora.getTime();
    const diffHoras = diffMs / (1000 * 60 * 60);

    return diffHoras >= 2; // Retorna true se faltar 2h ou mais
  } catch (err) {
    console.error('[verificarRegra2Horas] Erro ao verificar regra das 2 horas:', err);
    return true; // Na dúvida, permite estorno ao atleta
  }
};

module.exports = { verificarRegra2Horas };
