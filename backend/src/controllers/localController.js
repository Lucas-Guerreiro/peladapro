const db = require('../config/database');

exports.listarTodos = async (req, res) => {
  const gestorId = req.usuarioId;
  const tipo = req.usuarioTipo;

  if (tipo !== 'gestor' && tipo !== 'ambos') {
    return res.status(403).json({ error: 'Acesso negado. Apenas gestores podem gerenciar locais.' });
  }

  try {
    const { rows } = await db.query(
      'SELECT id, nome, endereco FROM locais WHERE gestor_id = $1 ORDER BY nome ASC',
      [gestorId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar locais', detail: err.message });
  }
};

exports.criar = async (req, res) => {
  const gestorId = req.usuarioId;
  const tipo = req.usuarioTipo;
  const { nome, endereco } = req.body;

  if (tipo !== 'gestor' && tipo !== 'ambos') {
    return res.status(403).json({ error: 'Acesso negado. Apenas gestores podem criar locais.' });
  }

  if (!nome) {
    return res.status(400).json({ error: 'O nome do local é obrigatório.' });
  }

  try {
    const { rows } = await db.query(
      'INSERT INTO locais (nome, endereco, gestor_id) VALUES ($1, $2, $3) RETURNING id, nome, endereco',
      [nome, endereco || null, gestorId]
    );
    res.status(201).json({ message: 'Local criado com sucesso!', local: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar local', detail: err.message });
  }
};

exports.atualizar = async (req, res) => {
  const gestorId = req.usuarioId;
  const tipo = req.usuarioTipo;
  const { id } = req.params;
  const { nome, endereco } = req.body;

  if (tipo !== 'gestor' && tipo !== 'ambos') {
    return res.status(403).json({ error: 'Acesso negado. Apenas gestores podem atualizar locais.' });
  }

  if (!nome) {
    return res.status(400).json({ error: 'O nome do local é obrigatório.' });
  }

  try {
    const { rows } = await db.query(
      'UPDATE locais SET nome = $1, endereco = $2 WHERE id = $3 AND gestor_id = $4 RETURNING id, nome, endereco',
      [nome, endereco || null, id, gestorId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Local não encontrado ou você não tem permissão para editá-lo.' });
    }

    res.json({ message: 'Local atualizado com sucesso!', local: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar local', detail: err.message });
  }
};

exports.deletar = async (req, res) => {
  const gestorId = req.usuarioId;
  const tipo = req.usuarioTipo;
  const { id } = req.params;

  if (tipo !== 'gestor' && tipo !== 'ambos') {
    return res.status(403).json({ error: 'Acesso negado. Apenas gestores podem excluir locais.' });
  }

  try {
    const { rowCount } = await db.query(
      'DELETE FROM locais WHERE id = $1 AND gestor_id = $2',
      [id, gestorId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Local não encontrado ou você não tem permissão para excluí-lo.' });
    }

    res.json({ message: 'Local excluído com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir local', detail: err.message });
  }
};
