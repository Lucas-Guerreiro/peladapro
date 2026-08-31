// ==========================================================================
// MODAL: ATLETA (atleta.js)
// ==========================================================================

window.App.initModalAtleta = function (data = {}) {
  const title = document.getElementById("athlete-modal-title");
  const formId = document.getElementById("athlete-edit-id");
  const name = document.getElementById("athlete-name");
  const apelido = document.getElementById("athlete-apelido");
  const email = document.getElementById("athlete-email");
  const password = document.getElementById("athlete-password");
  const dob = document.getElementById("athlete-dob");
  const cpf = document.getElementById("athlete-cpf");
  const whatsapp = document.getElementById("athlete-whatsapp");
  const isGk = document.getElementById("athlete-is-gk");
  const teamEl = document.getElementById("athlete-team");
  const starSelector = document.getElementById("athlete-stars-selector");
  const photoInput = document.getElementById("athlete-photo-input");
  const photoPreview = document.getElementById("athlete-photo-preview");
  const photoOverlay = document.getElementById("athlete-photo-overlay");
  const saveBtn = document.getElementById("btn-save-athlete");
  const closeBtn = document.getElementById("btn-close-athlete-modal");

  let photoBase64 = "";
  let isNewPhotoUploaded = false;

  // O seletor de estrelas e tipo de vínculo só devem ser exibidos quando acessado pelo perfil de GESTOR
  const ratingContainer = document.getElementById("athlete-rating-container");
  const tipoContainer = document.getElementById("athlete-tipo-container");
  const tipoSelect = document.getElementById("athlete-tipo");
  const isGestor = (window.Auth && (window.Auth._selectedRole === 'gestor' || (window.Auth.currentUser && window.Auth.currentUser.gestor)));
  
  if (ratingContainer) {
    ratingContainer.style.display = isGestor ? "block" : "none";
  }
  if (tipoContainer) {
    tipoContainer.style.display = isGestor ? "block" : "none";
  }

  if (password) password.value = "";

  const stars = document.querySelectorAll("#athlete-stars-selector .rating-star");
  if (stars && starSelector) {
    stars.forEach(s => s.style.color = "#ccc");
    starSelector.dataset.value = 0;

    stars.forEach(star => {
      star.onclick = () => {
        const val = parseInt(star.getAttribute("data-value"));
        starSelector.dataset.value = val;
        stars.forEach((s, idx) => {
          s.style.color = idx < val ? "var(--warning)" : "#ccc";
        });
      };
    });
  }

  // Hover da foto
  if (photoPreview && photoOverlay) {
    photoPreview.onmouseenter = () => { photoOverlay.style.opacity = "1"; };
    photoPreview.onmouseleave = () => { photoOverlay.style.opacity = "0"; };
  }

  // Upload e compressão automática da foto do atleta
  if (photoInput && photoPreview) {
    photoInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        window.App.showToast("Processando e otimizando imagem...", "info");
        compressImage(file, 500, 0.8, (compressedBase64) => {
          photoBase64 = compressedBase64;
          isNewPhotoUploaded = true;
          photoPreview.style.backgroundImage = `url('${photoBase64}')`;
          window.App.showToast("Foto otimizada com sucesso!", "success");
        });
      }
    };
  }

  if (data.playerId || data.id) {
    const targetId = data.playerId || data.id;
    if (title) title.textContent = "Editar Atleta";
    
    // Se for edição do próprio atleta logado, prioriza sempre Auth.currentUser atualizado
    let p = null;
    if (window.Auth && window.Auth.currentUser && String(window.Auth.currentUser.id) === String(targetId)) {
      p = window.Auth.currentUser;
    } else {
      const players = JSON.parse(localStorage.getItem("players")) || [];
      p = players.find(x => String(x.id) === String(targetId));
      if (!p && window.Auth && window.Auth.currentUser && String(window.Auth.currentUser.id) === String(targetId)) {
        p = window.Auth.currentUser;
      }
    }

    if (p) {
      if (formId) formId.value = p.id;
      if (name) name.value = p.nome || "";
      if (apelido) apelido.value = p.apelido || "";
      if (email) {
        email.value = p.email || "";
        email.disabled = false;
      }
      if (dob) {
        if (p.data_nascimento) {
          dob.value = String(p.data_nascimento).substring(0, 10);
        } else {
          dob.value = "";
        }
      }
      if (cpf) cpf.value = p.cpf || "";
      if (whatsapp) whatsapp.value = p.whatsapp || "";
      if (isGk) isGk.checked = !!p.goleiro;
      if (teamEl) teamEl.value = p.time_coracao || "";
      if (tipoSelect) tipoSelect.value = (p.tipo === 'convidado') ? 'convidado' : 'jogador';

      const rating = p.autoavaliacao || 0;
      if (starSelector) starSelector.dataset.value = rating;
      if (stars) {
        stars.forEach((s, idx) => {
          s.style.color = idx < rating ? "var(--warning)" : "#ccc";
        });
      }

      photoBase64 = p.foto || p.photo || "";
      const btnDownloadModalPhoto = document.getElementById("btn-download-modal-photo");
      if (photoPreview) {
        if (photoBase64 && !photoBase64.includes("unsplash.com")) {
          photoPreview.style.backgroundImage = `url('${photoBase64}')`;
          if (btnDownloadModalPhoto) {
            btnDownloadModalPhoto.style.display = "inline-flex";
            btnDownloadModalPhoto.onclick = () => window.Utils.downloadImage(photoBase64, p.nome || "Atleta");
          }
        } else {
          photoPreview.style.backgroundImage = `url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=80')`;
          if (btnDownloadModalPhoto) btnDownloadModalPhoto.style.display = "none";
        }
      }
    }
  } else {
    const btnDownloadModalPhoto = document.getElementById("btn-download-modal-photo");
    if (btnDownloadModalPhoto) btnDownloadModalPhoto.style.display = "none";
    if (title) title.textContent = "Cadastrar Novo Atleta";
    if (formId) formId.value = "";
    if (name) name.value = "";
    if (apelido) apelido.value = "";
    if (email) {
      email.value = "";
      email.disabled = false;
    }
    if (dob) dob.value = "";
    if (cpf) cpf.value = "";
    if (whatsapp) whatsapp.value = "";
    if (isGk) isGk.checked = false;
    if (teamEl) teamEl.value = "";
    if (tipoSelect) tipoSelect.value = "jogador";
    if (starSelector) starSelector.dataset.value = 0;
    if (stars) stars.forEach(s => s.style.color = "#ccc");
    if (photoPreview) photoPreview.style.backgroundImage = `url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=80')`;
  }

  initModalMasks(cpf, whatsapp);

  // --- Função para Salvar Atleta ------------------------------------------
  if (saveBtn) {
    saveBtn.onclick = async (e) => {
      e.preventDefault();
      await handleSaveAthlete(isNewPhotoUploaded, photoBase64);
    };
  }

  if (closeBtn) {
    closeBtn.onclick = () => window.App.closeModal();
  }
};

function initModalMasks(cpf, whatsapp) {
  if (cpf) {
    cpf.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 11);
      if (v.length > 9) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
      else if (v.length > 6) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
      else if (v.length > 3) v = `${v.slice(0, 3)}.${v.slice(3)}`;
      e.target.value = v;
    });
  }

  if (whatsapp) {
    whatsapp.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 11);
      if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
      else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      else if (v.length > 0) v = `(${v}`;
      e.target.value = v;
    });
  }
}

async function handleSaveAthlete(isNewPhotoUploaded, photoBase64) {
  const id = document.getElementById("athlete-edit-id")?.value;
  const name = document.getElementById("athlete-name")?.value;
  const apelido = document.getElementById("athlete-apelido")?.value;
  const email = document.getElementById("athlete-email")?.value;
  const password = document.getElementById("athlete-password")?.value;
  const dob = document.getElementById("athlete-dob")?.value;
  const cpf = document.getElementById("athlete-cpf")?.value;
  const whatsappInput = document.getElementById("athlete-whatsapp");
  const whatsapp = whatsappInput ? whatsappInput.value : "";
  const isGkEl = document.getElementById("athlete-is-gk");
  const isGk = isGkEl ? isGkEl.checked : false;
  const teamEl = document.getElementById("athlete-team");
  const teamVal = teamEl ? teamEl.value : "";
  const tipoEl = document.getElementById("athlete-tipo");
  const tipoVal = tipoEl ? tipoEl.value : undefined;
  const starSelector = document.getElementById("athlete-stars-selector");
  const rating = (starSelector && starSelector.dataset.value) ? parseInt(starSelector.dataset.value) : 0;

  // Só envia foto se o usuário explicitamente fez upload de um NOVO arquivo de imagem
  let photoVal = undefined;
  if (isNewPhotoUploaded && photoBase64) {
    photoVal = photoBase64;
  }

  if (!name || !email) {
    window.App.showToast("Por favor, preencha o Nome Completo e o E-mail.", "error");
    return;
  }

  if (password && password.length < 6) {
    window.App.showToast("A senha deve ter no mínimo 6 caracteres.", "error");
    return;
  }

  // --- Salvar no Banco se for o próprio jogador logado -----------
  const isSelfUpdate = (window.Auth && window.Auth.currentUser && String(window.Auth.currentUser.id) === String(id));
  if (isSelfUpdate) {
    try {
      window.App.showToast("Salvando perfil...", "info");

      const res = await Api.atualizarPerfil({
        nome: name,
        apelido: apelido,
        email: email,
        senha: password || undefined,
        cpf: cpf,
        data_nascimento: dob,
        whatsapp: whatsapp,
        goleiro: isGk,
        autoavaliacao: rating,
        foto: photoVal,
        time_coracao: teamVal
      });

      if (res.error) {
        window.App.showToast(res.error, "error");
        return;
      }

      window.App.showToast("Perfil atualizado com sucesso! 🎉", "success");

      // Sincroniza dados atualizados do backend para o local do front
      const token = localStorage.getItem('token');
      if (token && window.Auth._syncDataFromBackend) {
        await window.Auth._syncDataFromBackend(token);
      }

      // Atualiza a sessão ativa local com a resposta autoritativa do servidor
      if (res.usuario) {
        window.Auth.currentUser = {
          ...window.Auth.currentUser,
          ...res.usuario
        };
        localStorage.setItem('currentUser', JSON.stringify(window.Auth.currentUser));
      }

      const headerName = document.getElementById("header-user-name");
      if (headerName) headerName.textContent = name;

      window.App.closeModal();

      // Se estiver ativo na dashboard, força a re-renderização
      if (window.App.initDashboard && typeof window.App.initDashboard === 'function') {
        window.App.initDashboard();
      }
      return;
    } catch (err) {
      console.error(err);
      window.App.showToast("Erro ao conectar no banco para salvar perfil.", "error");
      return;
    }
  }

  // --- Fluxo de atualização por Gestor ---
  if (id) {
    try {
      window.App.showToast("Atualizando atleta no banco...", "info");
      const token = localStorage.getItem('token');
      if (!token) {
        window.App.showToast("Sessão expirada ou inválida. Por favor, faça login novamente.", "error");
        return;
      }

      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nome: name,
          apelido: apelido,
          email: email,
          senha: password || undefined,
          cpf: cpf,
          data_nascimento: dob,
          whatsapp: whatsapp,
          goleiro: isGk,
          autoavaliacao: rating,
          foto: photoVal || undefined,
          time_coracao: teamVal,
          tipo: tipoVal
        })
      });

      const responseData = await res.json();

      if (!res.ok) {
        window.App.showToast(responseData.error || "Erro ao atualizar atleta no banco.", "error");
        return;
      }

      window.App.showToast("Atleta atualizado com sucesso! 🎉", "success");

      if (window.App.syncAthletesList) {
        await window.App.syncAthletesList();
      }

      window.App.closeModal();
      return;
    } catch (err) {
      console.error(err);
      window.App.showToast("Erro ao conectar no servidor para atualizar atleta.", "error");
      return;
    }
  } else {
    // Sincronização direta com o backend para criação de novo atleta
    try {
      window.App.showToast("Salvando atleta no banco...", "info");
      const token = localStorage.getItem('token');
      if (!token) {
        window.App.showToast("Sessão expirada ou inválida. Por favor, faça login novamente.", "error");
        return;
      }

      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nome: name,
          apelido: apelido,
          email: email,
          cpf: cpf,
          data_nascimento: dob,
          whatsapp: whatsapp,
          goleiro: isGk,
          autoavaliacao: rating,
          foto: photoVal || undefined,
          time_coracao: teamVal,
          tipo: tipoVal
        })
      });

      const responseData = await res.json();

      if (!res.ok) {
        window.App.showToast(responseData.error || "Erro ao cadastrar atleta no banco.", "error");
        return;
      }

      window.App.showToast("Atleta cadastrado com sucesso! 🎉", "success");

      if (window.App.syncAthletesList) {
        await window.App.syncAthletesList();
      }

      window.App.closeModal();
      return;
    } catch (err) {
      console.error(err);
      window.App.showToast("Erro ao conectar no servidor para cadastrar atleta.", "error");
      return;
    }
  }
}

window.App.handleSaveAthleteProxy = async function(e) {
  if (e) e.preventDefault();
  await handleSaveAthlete();
};

function compressImage(file, maxDimension, quality, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const base64 = canvas.toDataURL('image/jpeg', quality);
      callback(base64);
    };
    img.onerror = () => {
      callback(e.target.result);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
