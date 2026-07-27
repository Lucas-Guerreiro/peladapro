// ==========================================================================
// MODAL: ATLETA (atleta.js)
// ==========================================================================

window.App.initModalAtleta = function(data = {}) {
  const title = document.getElementById("athlete-modal-title");
  const formId = document.getElementById("athlete-edit-id");
  const name = document.getElementById("athlete-name");
  const apelido = document.getElementById("athlete-apelido");
  const email = document.getElementById("athlete-email");
  const dob = document.getElementById("athlete-dob");
  const cpf = document.getElementById("athlete-cpf");
  const whatsapp = document.getElementById("athlete-whatsapp");
  const isGk = document.getElementById("athlete-is-gk");
  const starSelector = document.getElementById("athlete-stars-selector");
  const photoInput = document.getElementById("athlete-photo-input");
  const photoPreview = document.getElementById("athlete-photo-preview");
  const photoOverlay = document.getElementById("athlete-photo-overlay");

  let photoBase64 = "";

  const stars = document.querySelectorAll("#athlete-stars-selector .rating-star");
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

  // Hover da foto
  if (photoPreview && photoOverlay) {
    photoPreview.onmouseenter = () => { photoOverlay.style.opacity = "1"; };
    photoPreview.onmouseleave = () => { photoOverlay.style.opacity = "0"; };
  }

  // Upload da foto
  if (photoInput && photoPreview) {
    photoInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        // Validação básica de tamanho (ex: 2MB)
        if (file.size > 2 * 1024 * 1024) {
          window.App.showToast("Escolha uma imagem menor que 2MB.", "error");
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          photoBase64 = event.target.result;
          photoPreview.style.backgroundImage = `url('${photoBase64}')`;
        };
        reader.readAsDataURL(file);
      }
    };
  }

  if (data.playerId || data.id) {
    const targetId = data.playerId || data.id;
    title.textContent = "Editar Atleta";
    const players = JSON.parse(localStorage.getItem("players")) || [];
    const p = players.find(x => x.id === targetId);
    
    if (p) {
      formId.value = p.id;
      name.value = p.nome || "";
      apelido.value = p.apelido || "";
      if (email) {
        email.value = p.email || "";
        email.disabled = false;
      }
      if (p.data_nascimento) {
        dob.value = p.data_nascimento.substring(0, 10);
      } else {
        dob.value = "";
      }
      cpf.value = p.cpf || "";
      whatsapp.value = p.whatsapp || "";
      isGk.checked = !!p.goleiro;
      
      const rating = p.autoavaliacao || 0;
      starSelector.dataset.value = rating;
      stars.forEach((s, idx) => {
        s.style.color = idx < rating ? "var(--warning)" : "#ccc";
      });

      photoBase64 = p.foto || p.photo || "";
      if (photoBase64) {
        photoPreview.style.backgroundImage = `url('${photoBase64}')`;
      } else {
        photoPreview.style.backgroundImage = `url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=80')`;
      }
    }
  } else {
    title.textContent = "Cadastrar Novo Atleta";
    formId.value = "";
    name.value = "";
    apelido.value = "";
    if (email) {
      email.value = "";
      email.disabled = false;
    }
    dob.value = "";
    cpf.value = "";
    whatsapp.value = "";
    isGk.checked = false;
    photoBase64 = "";
    photoPreview.style.backgroundImage = `url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=80')`;
  }

  initModalMasks(cpf, whatsapp);

  document.getElementById("btn-close-athlete-modal").onclick = window.App.closeModal;
  document.getElementById("btn-save-athlete").onclick = () => handleSaveAthlete(photoPreview);
};

function initModalMasks(cpf, whatsapp) {
  cpf.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (v.length > 9) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
    else if (v.length > 6) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
    else if (v.length > 3) v = `${v.slice(0, 3)}.${v.slice(3)}`;
    e.target.value = v;
  });

  whatsapp.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    else if (v.length > 0) v = `(${v}`;
    e.target.value = v;
  });
}

async function handleSaveAthlete(photoPreview) {
  const id = document.getElementById("athlete-edit-id").value;
  const name = document.getElementById("athlete-name").value.trim();
  const apelido = document.getElementById("athlete-apelido").value.trim();
  const email = document.getElementById("athlete-email").value.trim();
  const dob = document.getElementById("athlete-dob").value;
  const cpf = document.getElementById("athlete-cpf").value;
  const whatsapp = document.getElementById("athlete-whatsapp").value;
  const isGk = document.getElementById("athlete-is-gk").checked;
  const rating = parseInt(document.getElementById("athlete-stars-selector").dataset.value) || 0;

  // Extrair base64 do background-image se houver
  let photoVal = "";
  if (photoPreview && photoPreview.style.backgroundImage) {
    const match = photoPreview.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
    if (match && match[1] && !match[1].startsWith("http")) {
      photoVal = match[1];
    }
  }

  if (!name || !email) {
    window.App.showToast("Por favor, preencha o Nome Completo e o E-mail.", "error");
    return;
  }

  // --- Salvar no Banco do Supabase se for o próprio jogador logado -----------
  const isSelfUpdate = (window.Auth && window.Auth.currentUser && String(window.Auth.currentUser.id) === String(id));
  if (isSelfUpdate) {
    try {
      window.App.showToast("Salvando perfil no Supabase...", "info");
      
      const res = await Api.atualizarPerfil({
        nome: name,
        apelido: apelido,
        cpf: cpf,
        data_nascimento: dob,
        whatsapp: whatsapp,
        goleiro: isGk,
        autoavaliacao: rating,
        foto: photoVal || undefined
      });

      if (res.error) {
        window.App.showToast(res.error, "error");
        return;
      }

      window.App.showToast("Perfil atualizado no Supabase com sucesso!", "success");
      
      // Sincroniza dados atualizados do backend para o local do front
      const token = localStorage.getItem('token');
      if (token && window.Auth._syncDataFromBackend) {
        await window.Auth._syncDataFromBackend(token);
      }

      // Atualiza a sessão ativa local
      window.Auth.currentUser = {
        ...window.Auth.currentUser,
        nome: name,
        apelido: apelido,
        cpf: cpf,
        data_nascimento: dob,
        whatsapp: whatsapp,
        goleiro: isGk,
        autoavaliacao: rating,
        foto: photoVal || window.Auth.currentUser.foto
      };

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

  // --- Fluxo Legado de LocalStorage (apenas para Gestor gerenciar outros atletas no front local) ---
  const players = JSON.parse(localStorage.getItem("players")) || [];

  if (id) {
    try {
      window.App.showToast("Atualizando atleta no banco...", "info");
      const token = localStorage.getItem('token');
      if (!token) {
        window.App.showToast("Sessão expirada ou inválida. Por favor, faça login novamente.", "error");
        return;
      }

      const res = await fetch(`http://localhost:3000/api/usuarios/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nome: name,
          apelido: apelido,
          cpf: cpf,
          data_nascimento: dob,
          whatsapp: whatsapp,
          goleiro: isGk,
          autoavaliacao: rating,
          foto: photoVal || undefined
        })
      });

      const responseData = await res.json();

      if (!res.ok) {
        window.App.showToast(responseData.error || "Erro ao atualizar atleta no banco.", "error");
        return;
      }

      window.App.showToast("Atleta atualizado com sucesso!", "success");

      // Recarrega a lista de atletas sincronizada do backend no front
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

      const res = await fetch('http://localhost:3000/api/usuarios', {
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
          foto: photoVal || undefined
        })
      });

      const responseData = await res.json();

      if (!res.ok) {
        window.App.showToast(responseData.error || "Erro ao cadastrar atleta no banco.", "error");
        return;
      }

      window.App.showToast("Atleta cadastrado com sucesso!", "success");

      // Recarrega a lista de atletas sincronizada do backend no front
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

  localStorage.setItem("players", JSON.stringify(players));
  window.App.closeModal();

  if (window.App.renderManagerAthletesList && typeof window.App.renderManagerAthletesList === 'function') {
    window.App.renderManagerAthletesList();
  }
}
