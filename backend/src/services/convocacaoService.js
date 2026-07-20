const db = require('../config/database');

const verificarRegra2Horas = async (peladaId) => {
  const query = `
    SELECT (data || ' ' || horario)::TIMESTAMPTZ as data_hora 
    FROM peladas WHERE id = $1`;
  const { rows } = await db.query(query, [peladaId]);
  
  if (rows.length === 0) return false;

  const dataPelada = new Date(rows[0].data_hora);
  const agora = new Date();
  const diffHoras = (dataPelada - agora) / (1000 * 60 * 60);
  
  return diffHoras >= 2; // Retorna true se faltar 2h ou mais
};

module.exports = { verificarRegra2Horas };
