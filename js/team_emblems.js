// ==========================================================================
// js/team_emblems.js — Emblemas SVG dos Times
// 10 shields de futebol variados. Atribuição por índice fixo.
// ==========================================================================

window.TeamEmblems = (function() {

  // Paleta de cores para cada emblema
  var EMBLEM_THEMES = [
    { bg: '#1565C0', accent: '#FFD600', border: '#0D47A1' },   // 0 Azul + Dourado
    { bg: '#2E7D32', accent: '#FFFFFF', border: '#1B5E20' },   // 1 Verde + Branco
    { bg: '#C62828', accent: '#FFD600', border: '#B71C1C' },   // 2 Vermelho + Dourado
    { bg: '#212121', accent: '#FFD600', border: '#000000' },   // 3 Preto + Dourado
    { bg: '#6A1B9A', accent: '#E1BEE7', border: '#4A148C' },   // 4 Roxo + Lilas
    { bg: '#E65100', accent: '#FFFFFF', border: '#BF360C' },   // 5 Laranja + Branco
    { bg: '#0D47A1', accent: '#90CAF9', border: '#01579B' },   // 6 Azul Marinho + Celeste
    { bg: '#F9A825', accent: '#212121', border: '#F57F17' },   // 7 Dourado + Preto
    { bg: '#37474F', accent: '#ECEFF1', border: '#263238' },   // 8 Cinza + Branco
    { bg: '#880E4F', accent: '#F8BBD9', border: '#560027' },   // 9 Vinho + Rosa
  ];

  // Gera SVG de shield com o tema fornecido
  function buildShieldSVG(theme, index) {
    var bg = theme.bg;
    var accent = theme.accent;
    var border = theme.border;

    var decorations = [
      // 0 - Faixa horizontal + estrela no topo
      '<line x1="10" y1="34" x2="54" y2="34" stroke="' + accent + '" stroke-width="4"/><polygon points="32,12 34.5,19 42,19 36,23.5 38.5,31 32,26.5 25.5,31 28,23.5 22,19 29.5,19" fill="' + accent + '"/>',
      // 1 - Faixa vertical + bola
      '<rect x="29" y="10" width="6" height="44" fill="' + accent + '" opacity="0.5"/><circle cx="32" cy="32" r="9" fill="none" stroke="' + accent + '" stroke-width="2.5"/>',
      // 2 - Cruz + bola
      '<line x1="10" y1="32" x2="54" y2="32" stroke="' + accent + '" stroke-width="4"/><line x1="32" y1="12" x2="32" y2="54" stroke="' + accent + '" stroke-width="4"/><circle cx="32" cy="32" r="7" fill="' + bg + '" stroke="' + accent + '" stroke-width="2"/>',
      // 3 - Estrela grande
      '<polygon points="32,10 35.5,22 48,22 38,30 41.5,42 32,34 22.5,42 26,30 16,22 28.5,22" fill="' + accent + '"/>',
      // 4 - Ondas diagonais + circulo
      '<line x1="10" y1="22" x2="54" y2="42" stroke="' + accent + '" stroke-width="5" opacity="0.6"/><line x1="10" y1="32" x2="54" y2="52" stroke="' + accent + '" stroke-width="3" opacity="0.4"/><circle cx="32" cy="32" r="8" fill="none" stroke="' + accent + '" stroke-width="2.5"/>',
      // 5 - Relampago
      '<polygon points="36,10 26,30 33,30 28,54 42,28 35,28" fill="' + accent + '"/>',
      // 6 - Losango
      '<polygon points="32,14 48,32 32,50 16,32" fill="none" stroke="' + accent + '" stroke-width="3"/><polygon points="32,20 44,32 32,44 20,32" fill="' + accent + '" opacity="0.35"/>',
      // 7 - Trofeu
      '<rect x="27" y="38" width="10" height="5" fill="' + accent + '"/><rect x="23" y="43" width="18" height="3" fill="' + accent + '"/><path d="M20,14 Q20,30 32,34 Q44,30 44,14 Z" fill="' + accent + '" opacity="0.85"/><path d="M20,18 Q14,18 14,26 Q14,30 20,30" fill="none" stroke="' + accent + '" stroke-width="2.5"/><path d="M44,18 Q50,18 50,26 Q50,30 44,30" fill="none" stroke="' + accent + '" stroke-width="2.5"/>',
      // 8 - 4 quadrantes
      '<rect x="10" y="12" width="22" height="20" fill="' + accent + '" opacity="0.25"/><rect x="32" y="32" width="22" height="22" fill="' + accent + '" opacity="0.25"/><line x1="32" y1="12" x2="32" y2="54" stroke="' + accent + '" stroke-width="2.5"/><line x1="10" y1="32" x2="54" y2="32" stroke="' + accent + '" stroke-width="2.5"/>',
      // 9 - Coracao
      '<path d="M32,42 Q18,30 18,22 A10,10 0 0,1 32,16 A10,10 0 0,1 46,22 Q46,30 32,42Z" fill="' + accent + '"/>',
    ];

    var deco = decorations[index] || decorations[0];

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 68" width="100%" height="100%">' +
      '<path d="M32,2 L58,14 L58,38 Q58,56 32,66 Q6,56 6,38 L6,14 Z" fill="' + bg + '" stroke="' + border + '" stroke-width="2.5"/>' +
      '<path d="M32,7 L53,17 L53,38 Q53,52 32,61 Q11,52 11,38 L11,17 Z" fill="none" stroke="' + accent + '" stroke-width="1.5" opacity="0.4"/>' +
      deco +
      '</svg>';
  }

  var EMBLEMS = EMBLEM_THEMES.map(function(theme, idx) {
    return buildShieldSVG(theme, idx);
  });

  return {
    total: EMBLEMS.length,
    themes: EMBLEM_THEMES,

    get: function(index) {
      var idx = ((index || 0) % EMBLEMS.length + EMBLEMS.length) % EMBLEMS.length;
      return EMBLEMS[idx];
    },

    forTeam: function(team) {
      if (team) {
        var customUrl = team.emblema_url || team.emblemaUrl;
        if (customUrl) {
          return '<img src="' + customUrl + '" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));" alt="Emblema">';
        }
      }
      var idx = (team && team.emblema !== undefined && team.emblema !== null) ? team.emblema : 0;

      // Verifica se a galeria de emblemas customizados do grupo possui imagem para este índice
      var groupList = window._groupEmblemsList || [];
      if (!groupList || groupList.length === 0) {
        try { groupList = JSON.parse(localStorage.getItem("groupEmblems")) || []; } catch(e) {}
      }

      if (Array.isArray(groupList) && groupList.length > 0) {
        var gItem = groupList[idx % groupList.length];
        if (gItem && gItem.imagem_url) {
          return '<img src="' + gItem.imagem_url + '" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));" alt="Emblema">';
        }
      }

      return this.get(idx);
    },

    getTheme: function(index) {
      var idx = ((index || 0) % EMBLEM_THEMES.length + EMBLEM_THEMES.length) % EMBLEM_THEMES.length;
      return EMBLEM_THEMES[idx];
    },

    // Renderiza seletor visual de emblemas com Galeria Salva do Grupo + Padrões do Sistema
    renderSelector: function(currentTeam, callbackName, uploadCallbackName, customEmblemsList, selectCustomCallbackName, deleteCustomCallbackName) {
      uploadCallbackName = uploadCallbackName || 'handleCustomEmblemUpload';
      selectCustomCallbackName = selectCustomCallbackName || 'selectCustomEmblemFromLibrary';
      deleteCustomCallbackName = deleteCustomCallbackName || 'deleteCustomEmblemFromLibrary';

      var currentUrl = currentTeam ? (currentTeam.emblema_url || currentTeam.emblemaUrl) : null;
      var currentIdx = (currentTeam && !currentUrl && currentTeam.emblema !== undefined && currentTeam.emblema !== null) ? currentTeam.emblema : 0;

      var html = '<div style="margin-bottom: 14px; padding: 12px; background: #F8FAFC; border-radius: 12px; border: 1.5px dashed #0284C7; text-align: center;">' +
        '<label style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; font-weight: 700; color: #0284C7; background: #E0F2FE; padding: 8px 16px; border-radius: 8px; transition: all 0.2s;">' +
          '<span>➕ Adicionar Novo Emblema à Galeria</span>' +
          '<input type="file" accept="image/*" style="display: none;" onchange="' + uploadCallbackName + '(event)">' +
        '</label>' +
        '<div style="font-size: 11px; color: #64748B; margin-top: 6px;">Envie uma foto/escudo que ficará salvo para todos os sorteios do grupo</div>' +
      '</div>';

      // 1. Galeria de Emblemas Salvos do Grupo
      if (Array.isArray(customEmblemsList) && customEmblemsList.length > 0) {
        html += '<div style="font-size: 12px; font-weight: 700; color: #0F172A; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">' +
          '<span>🛡️ Emblemas Gravados do Grupo (' + customEmblemsList.length + '):</span>' +
        '</div>' +
        '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 4px; margin-bottom: 16px; max-height: 160px; overflow-y: auto;">';

        for (var k = 0; k < customEmblemsList.length; k++) {
          var item = customEmblemsList[k];
          var isSelected = (currentUrl === item.imagem_url);
          html += '<div style="position: relative; width: 62px; height: 68px;">' +
            '<div onclick="' + selectCustomCallbackName + '(\'' + item.id + '\')" ' +
            'title="' + (item.nome || 'Emblema') + '" ' +
            'style="width: 100%; height: 100%; cursor: pointer; border-radius: 10px; padding: 6px; ' +
            'border: 2.5px solid ' + (isSelected ? '#00E676' : '#CBD5E1') + '; ' +
            'background: ' + (isSelected ? 'rgba(0,230,118,0.1)' : '#FFFFFF') + '; ' +
            'box-shadow: ' + (isSelected ? '0 0 0 2px #A7F3D0' : '0 2px 4px rgba(0,0,0,0.08)') + '; ' +
            'transition: all 0.15s; display: flex; align-items: center; justify-content: center;">' +
            '<img src="' + item.imagem_url + '" style="width: 100%; height: 100%; object-fit: contain;">' +
            '</div>' +
            '<button title="Remover da galeria" onclick="event.stopPropagation(); ' + deleteCustomCallbackName + '(' + item.id + ')" ' +
            'style="position: absolute; top: -5px; right: -5px; background: #EF4444; color: #FFF; border: none; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">✕</button>' +
          '</div>';
        }
        html += '</div>';
      }

      // 2. Escudos Pré-definidos do Sistema
      html += '<div style="font-size: 12px; font-weight: 600; color: #64748B; margin-bottom: 8px;">🎨 Ou escolha um escudo padrão do sistema:</div>' +
      '<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; padding: 4px;">';

      for (var i = 0; i < EMBLEMS.length; i++) {
        var isActive = (!currentUrl && currentIdx === i);
        html += '<div data-emblem-idx="' + i + '" ' +
          'onclick="' + callbackName + '(' + i + ')" ' +
          'style="width: 52px; height: 58px; cursor: pointer; border-radius: 8px; padding: 4px; ' +
          'border: 2.5px solid ' + (isActive ? '#0284C7' : '#E2E8F0') + '; ' +
          'background: ' + (isActive ? '#E0F2FE' : '#F8FAFC') + '; ' +
          'box-shadow: ' + (isActive ? '0 0 0 2px #BAE6FD' : 'none') + '; ' +
          'transition: all 0.15s; display: flex; align-items: center; justify-content: center;" ' +
          'onmouseover="this.style.borderColor=\'#0284C7\'; this.style.background=\'#E0F2FE\';" ' +
          'onmouseout="this.style.borderColor=\'' + (isActive ? '#0284C7' : '#E2E8F0') + '\'; this.style.background=\'' + (isActive ? '#E0F2FE' : '#F8FAFC') + '\';">' +
          EMBLEMS[i] +
          '</div>';
      }
      html += '</div>';
      return html;
    },

    // Redimensiona imagem para base64 leve (max 180x180)
    compressImage: function(file, callback) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var canvas = document.createElement('canvas');
          var maxDim = 180;
          var width = img.width;
          var height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          var base64 = canvas.toDataURL('image/png');
          callback(base64);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };
})();
