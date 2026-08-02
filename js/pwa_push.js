/**
 * js/pwa_push.js — Gerenciador de Push Notifications no Frontend
 */

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

window.PWAPush = {
  vapidPublicKey: 'BBHhVX4ytVoGJ8grXixb8SNqArPtcmrwAAoyb2R2d_mZfKsSsYwlCyO6rWfLIXKtN23pTDIMNmM0nuKXdToij2Y',

  init() {
    // 1. Verificar suporte do navegador
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      console.warn('📱 [PWAPush] Navegador não suporta Push Notifications.');
      return;
    }

    // 2. Buscar VAPID Public Key do backend
    this.fetchVapidKey();

    // 3. Se a permissão já foi concedida, registra/sincroniza em segundo plano
    if (Notification.permission === 'granted') {
      this.subscribeUserSilently();
    } else if (Notification.permission === 'default' && !sessionStorage.getItem('push_btn_dismissed')) {
      // Exibe o botão flutuante se permissão ainda não foi decidida
      this.showFloatingButton();
    }
  },

  async fetchVapidKey() {
    try {
      const res = await fetch('/api/push/vapid-public-key');
      if (res.ok) {
        const data = await res.json();
        if (data.publicKey) this.vapidPublicKey = data.publicKey;
      }
    } catch(e) {
      console.warn('[PWAPush] Usando VAPID key local fallback:', e);
    }
  },

  showFloatingButton() {
    if (document.getElementById('pwa-push-floating-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'pwa-push-floating-btn';
    btn.innerHTML = '🔔 Ativar Notificações';
    btn.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: #0284C7;
      color: #FFFFFF;
      border: none;
      border-radius: 8px;
      padding: 12px 18px;
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      font-size: 13px;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
      z-index: 99999;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: transform 0.2s, background 0.2s;
      animation: pushPulse 2s infinite;
    `;

    if (!document.getElementById('push-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'push-pulse-style';
      style.innerHTML = `
        @keyframes pushPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    btn.onclick = () => this.requestPermissionAndSubscribe();
    document.body.appendChild(btn);
  },

  hideFloatingButton() {
    const btn = document.getElementById('pwa-push-floating-btn');
    if (btn) btn.remove();
  },

  async requestPermissionAndSubscribe() {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await this.subscribeUser();
        this.hideFloatingButton();
        if (window.App && window.App.showToast) {
          window.App.showToast('Notificações ativadas no PeladaPro! 🎉', 'success');
        } else if (window.Utils) {
          window.Utils.toast('Notificações ativadas no PeladaPro! 🎉', 'success');
        }
      } else {
        sessionStorage.setItem('push_btn_dismissed', 'true');
        this.hideFloatingButton();
        console.log('[PWAPush] Permissão de notificação negada.');
      }
    } catch (err) {
      console.error('[PWAPush] Erro ao solicitar permissão de notificação:', err);
    }
  },

  async subscribeUserSilently() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const existingSubscription = await reg.pushManager.getSubscription();
      if (existingSubscription) {
        await this.sendSubscriptionToBackend(existingSubscription);
      } else {
        await this.subscribeUser();
      }
    } catch(e) {
      console.warn('[PWAPush] Erro ao sincronizar silent push:', e);
    }
  },

  async subscribeUser() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(this.vapidPublicKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      console.log('📱 [PWAPush] Subscription gerada:', subscription);
      await this.sendSubscriptionToBackend(subscription);
    } catch (err) {
      console.error('📱 [PWAPush] Erro ao gerar Push Subscription:', err);
    }
  },

  async sendSubscriptionToBackend(subscription) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      console.log('📱 [PWAPush] Tentando registrar subscrição no backend...', { temToken: !!token });
      const res = await fetch('/api/push/register', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(subscription)
      });
      const data = await res.json();
      if (res.ok) {
        console.log('📱 [PWAPush] Servidor confirmou registro com sucesso:', data.message || data);
      } else {
        console.warn('📱 [PWAPush] Servidor recusou registro:', res.status, data.error || data.message || data);
      }
    } catch (err) {
      console.error('📱 [PWAPush] Erro de rede ao enviar subscription para o backend:', err);
    }
  },

  async sendTestNotification() {
    try {
      if (Notification.permission !== 'granted') {
        alert('Por favor, ative as notificações primeiro clicando no botão 🔔 Ativar Notificações.');
        return;
      }
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          title: 'Pelada Confirmada! ⚽',
          body: 'Notificação de teste do PeladaPro enviada com sucesso!',
          url: '/#/jogador/convocacao'
        })
      });
      const data = await res.json();
      if (window.App && window.App.showToast) {
        window.App.showToast(`Notificação disparada para ${data.successCount || 1} dispositivo(s)! 🚀`, 'success');
      } else {
        alert(`Notificação disparada para ${data.successCount || 1} dispositivo(s)! 🚀`);
      }
    } catch(e) {
      console.error(e);
      alert('Erro ao disparar notificação de teste.');
    }
  }
};

// Inicialização automática
document.addEventListener('DOMContentLoaded', () => {
  window.PWAPush.init();
});
