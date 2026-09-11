// ==========================================================================
// MODAL: DISPUTA DE PÊNALTIS (penaltis.js)
// ==========================================================================

window.App.initModalPenaltis = function (data) {
  const teamA = (data && data.teamA) || "Time A";
  const teamB = (data && data.teamB) || "Time B";
  const scoreA = (data && data.scoreA !== undefined) ? data.scoreA : 0;
  const scoreB = (data && data.scoreB !== undefined) ? data.scoreB : 0;
  const onConfirm = (data && typeof data.onConfirm === 'function') ? data.onConfirm : null;

  let penA = 3;
  let penB = 2;

  const matchTitleEl = document.getElementById("penaltis-match-title");
  const teamANameEl = document.getElementById("penaltis-team-a-name");
  const teamBNameEl = document.getElementById("penaltis-team-b-name");
  const valAEl = document.getElementById("penaltis-score-a-val");
  const valBEl = document.getElementById("penaltis-score-b-val");
  const errorMsgEl = document.getElementById("penaltis-error-msg");

  const btnClose = document.getElementById("btn-close-penaltis");
  const btnCancel = document.getElementById("btn-cancel-penaltis");
  const btnConfirm = document.getElementById("btn-confirm-penaltis");

  const btnAMinus = document.getElementById("btn-penaltis-a-minus");
  const btnAPlus = document.getElementById("btn-penaltis-a-plus");
  const btnBMinus = document.getElementById("btn-penaltis-b-minus");
  const btnBPlus = document.getElementById("btn-penaltis-b-plus");

  if (matchTitleEl) matchTitleEl.textContent = `${teamA} ${scoreA} x ${scoreB} ${teamB}`;
  if (teamANameEl) teamANameEl.textContent = teamA;
  if (teamBNameEl) teamBNameEl.textContent = teamB;

  const updateDisplay = () => {
    if (valAEl) valAEl.textContent = penA;
    if (valBEl) valBEl.textContent = penB;
    if (errorMsgEl) {
      if (penA === penB) {
        errorMsgEl.style.display = "block";
      } else {
        errorMsgEl.style.display = "none";
      }
    }
  };

  if (btnAMinus) btnAMinus.onclick = () => { if (penA > 0) { penA--; updateDisplay(); } };
  if (btnAPlus) btnAPlus.onclick = () => { penA++; updateDisplay(); };
  if (btnBMinus) btnBMinus.onclick = () => { if (penB > 0) { penB--; updateDisplay(); } };
  if (btnBPlus) btnBPlus.onclick = () => { penB++; updateDisplay(); };

  if (btnClose) btnClose.onclick = () => window.App.closeModal();
  if (btnCancel) btnCancel.onclick = () => window.App.closeModal();

  if (btnConfirm) {
    btnConfirm.onclick = () => {
      if (penA === penB) {
        if (errorMsgEl) errorMsgEl.style.display = "block";
        if (window.App.showToast) window.App.showToast("A disputa de pênaltis deve ter um vencedor!", "warning");
        return;
      }
      const winner = penA > penB ? teamA : teamB;
      window.App.closeModal();
      if (onConfirm) {
        onConfirm(penA, penB, winner);
      }
    };
  }

  updateDisplay();
};
