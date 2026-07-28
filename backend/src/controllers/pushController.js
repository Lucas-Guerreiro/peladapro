const webPush = require('web-push');
const db = require('../config/database');

// Configuração VAPID (Variáveis de Ambiente com Fallback para Chaves de Produção)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BBHhVX4ytVoGJ8grXixb8SNqArPtcmrwAAoyb2R2d_mZfKsSsYwlCyO6rWfLIXKtN23pTDIMNmM0nuKXdToij2Y';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'fi_VonIxZn0XfXg8QGhEnht4so3wNgsHB1lLz9UByHQ';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:contato@thorneios.com.br';

webPush.setVapidDetails(
  vapidEmail,
  vapidPublicKey,
  vapidPrivateKey
);

// Array em memória para fallback de subscriptions
const memorySubscriptions = new Map();

// 1. Retornar VAPID Public Key para o Frontend
exports.getVapidPublicKey = (req, res) => {
  res.json({ publicKey: vapidPublicKey });
};

// 2. Registrar nova Subscription de Push Notification
exports.registerSubscription = async (req, res) => {
  const subscription = req.body;
  const usuario_id = req.usuarioId || null;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription inválida ou incompleta.' });
  }

  try {
    // Guarda na memória
    memorySubscriptions.set(subscription.endpoint, { subscription, usuario_id });

    // Salva no banco PostgreSQL (Supabase)
    const query = `
      INSERT INTO push_subscriptions (usuario_id, endpoint, keys)
      VALUES ($1, $2, $3)
      ON CONFLICT (endpoint) 
      DO UPDATE SET usuario_id = EXCLUDED.usuario_id, keys = EXCLUDED.keys, created_at = CURRENT_TIMESTAMP
      RETURNING id`;
    
    await db.query(query, [
      usuario_id,
      subscription.endpoint,
      JSON.stringify(subscription.keys || {})
    ]);

    res.status(201).json({ message: 'Push notification registrado com sucesso no PeladaPro!' });
  } catch (err) {
    console.warn('[PushController] Erro ao salvar no banco, mantendo em memória:', err.message);
    res.status(201).json({ message: 'Push notification registrado em memória local.' });
  }
};

// 3. Disparar Notificação Push para todas as Subscriptions registradas
exports.sendNotification = async (req, res) => {
  const { title, body, url, icon, payload } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Título e corpo da notificação são obrigatórios.' });
  }

  const notificationPayload = JSON.stringify({
    title: title || 'PeladaPro ⚽',
    body: body,
    icon: icon || '/assets/icons/icon-192.png',
    url: url || '/#/jogador/convocacao',
    ...payload
  });

  let subscriptionsList = [];

  // Busca do banco Supabase
  try {
    const { rows } = await db.query('SELECT endpoint, keys FROM push_subscriptions');
    subscriptionsList = rows.map(r => {
      let keysObj = r.keys;
      if (typeof keysObj === 'string') {
        try { keysObj = JSON.parse(keysObj); } catch(e) {}
      }
      return { endpoint: r.endpoint, keys: keysObj };
    });
  } catch(e) {
    console.warn('[PushController] Falha ao consultar Supabase, usando memória fallback:', e.message);
  }

  // Se o banco retornou vazio, utiliza a memória fallback
  if (subscriptionsList.length === 0) {
    memorySubscriptions.forEach(v => subscriptionsList.push(v.subscription));
  }

  if (subscriptionsList.length === 0) {
    return res.status(200).json({ message: 'Nenhum dispositivo registrado para receber notificações.', sentCount: 0 });
  }

  let successCount = 0;
  let failureCount = 0;

  const pushPromises = subscriptionsList.map(async (sub) => {
    try {
      await webPush.sendNotification(sub, notificationPayload);
      successCount++;
    } catch (err) {
      failureCount++;
      console.warn('[PushController] Erro ao enviar notificação para dispositivo:', sub.endpoint, err.statusCode);

      // Se a subscription expirou ou foi cancelada pelo usuário (HTTP 404 ou 410)
      if (err.statusCode === 404 || err.statusCode === 410) {
        memorySubscriptions.delete(sub.endpoint);
        try {
          await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
        } catch(e) {}
      }
    }
  });

  await Promise.all(pushPromises);

  res.json({
    message: `Notificações disparadas! Sucesso: ${successCount}, Falhas: ${failureCount}`,
    successCount,
    failureCount
  });
};
