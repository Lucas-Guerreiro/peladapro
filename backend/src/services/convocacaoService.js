const db = require('../config/database');

const verificarRegra2Horas = async (peladaId) => {
  try {
    const query = `SELECT data, horario FROM peladas WHERE id = $1`;
    const { rows } = await db.query(query, [peladaId]);

    if (rows.length === 0) return false;

    const row = rows[0];
    if (!row.data) return false;

    let dataStr = '';
    if (row.data instanceof Date) {
      dataStr = row.data.toISOString().split('T')[0];
    } else {
      dataStr = String(row.data).split('T')[0];
    }

    let timeStr = row.horario ? String(row.horario).trim() : '19:00';
    if (timeStr.length === 5) timeStr += ':00';

    const peladaDateTime = new Date(`${dataStr}T${timeStr}`);
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
