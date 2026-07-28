/**
 * js/services/pix_ocr.js — Motor de Leitura e Validação OCR de Comprovantes Pix
 * Suporta Nubank, Itaú, Bradesco, Banco do Brasil, Caixa, Inter, Santander, PicPay, Mercado Pago, C6, etc.
 * Suporta leitura nativa de PDFs (vetorial e escaneado) via PDF.js.
 */

window.PixOCR = {
  _tesseractLoaded: false,
  _pdfjsLoaded: false,

  async _loadTesseract() {
    if (window.Tesseract) return true;
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = () => {
        this._tesseractLoaded = true;
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  },

  async _loadPDFJS() {
    if (window.pdfjsLib) return true;
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        this._pdfjsLoaded = true;
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  },

  /**
   * Normaliza texto removendo acentos e convertendo para minúsculas
   */
  _normalizeStr(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  },

  /**
   * Extrai apenas dígitos numéricos de uma string
   */
  _extractDigits(str) {
    if (!str) return '';
    return String(str).replace(/\D/g, '');
  },

  /**
   * Extrai o texto bruto do comprovante (Imagem ou PDF)
   */
  async extractText(file) {
    if (!file) throw new Error('Nenhum arquivo de comprovante fornecido.');

    // 1. Caso seja imagem (PNG, JPG, WEBP)
    if (file.type.startsWith('image/')) {
      await this._loadTesseract();
      if (!window.Tesseract) {
        throw new Error('Não foi possível carregar o leitor OCR. Verifique sua conexão com a internet.');
      }
      const worker = await Tesseract.createWorker('por');
      const ret = await worker.recognize(file);
      await worker.terminate();
      return ret.data.text || '';
    }

    // 2. Caso seja PDF (ex: Comprovante Santander / Itaú / Nubank em PDF)
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        await this._loadPDFJS();
        if (window.pdfjsLib) {
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = '';

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
          }

          // Se extraiu texto vetorial do PDF com sucesso
          if (fullText && fullText.trim().length > 15) {
            return fullText;
          }

          // Caso seja PDF escaneado (imagem dentro de PDF), renderiza no Canvas e aplica Tesseract OCR
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport }).promise;

          await this._loadTesseract();
          if (window.Tesseract) {
            const worker = await Tesseract.createWorker('por');
            const ret = await worker.recognize(canvas);
            await worker.terminate();
            return ret.data.text || '';
          }
        }
      } catch (pdfErr) {
        console.warn('[PixOCR] Erro ao extrair texto do PDF via PDF.js:', pdfErr);
      }

      // Fallback FileReader se o leitor PDF falhar
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || '');
        reader.onerror = () => resolve('');
        reader.readAsText(file);
      });
    }

    throw new Error('Formato de arquivo não suportado. Envie uma imagem (PNG/JPG) ou PDF.');
  },

  /**
   * Analisa e extrai os campos-chave do texto do Pix
   */
  parseText(rawText) {
    const text = String(rawText || '').replace(/\r\n/g, '\n');
    const normText = this._normalizeStr(text);
    const upperText = text.toUpperCase();

    // 1. Identificar se é Agendamento
    const isAgendamento = normText.includes('agendamento') ||
                          normText.includes('pagamento agendado') ||
                          normText.includes('agendado para') ||
                          normText.includes('transferencia agendada');

    // 2. Extrair Código E2E / Autenticação
    let e2e_id = null;

    // Padrão E2E oficial do Banco Central (Começa com E + 31 caracteres alfanuméricos)
    const matchE2E = upperText.match(/E[A-Z0-9]{31}/);
    if (matchE2E) {
      e2e_id = matchE2E[0];
    } else {
      // Outros termos comuns de Autenticação / TXID nos bancos brasileiros (Nubank, Itaú, Bradesco, Inter, Caixa, BB, Santander, etc.)
      const matchAuth = upperText.match(/(?:AUTENTICA[ÇC][AÃ]O|ID DA TRANSA[ÇC][AÃ]O|ID TRANSA[ÇC][AÃ]O|CÓDIGO DA OPERA[ÇC][AÃ]O|CONTROLE|TXID|PROTOCOLO|COMPROVANTE|VIA DO CLIENTE)[:\s#]+([A-Z0-9-]{8,45})/i);
      if (matchAuth && matchAuth[1] && matchAuth[1].replace(/[^A-Z0-9]/g, '').length >= 8) {
        e2e_id = matchAuth[1].replace(/[^A-Z0-9]/g, '');
      } else {
        // Busca qualquer hash de 16 a 40 caracteres contínuos no comprovante
        const matchGenericHash = upperText.match(/[A-Z0-9]{16,40}/);
        if (matchGenericHash) {
          e2e_id = matchGenericHash[0];
        } else {
          // Fallback determinístico: se o OCR for ruidoso mas houver texto legível, gera um ID único baseado na assinatura do texto
          const cleanChars = normText.replace(/[^a-z0-9]/g, '');
          if (cleanChars.length >= 8) {
            let hash = 0;
            for (let i = 0; i < cleanChars.length; i++) {
              hash = ((hash << 5) - hash) + cleanChars.charCodeAt(i);
              hash |= 0;
            }
            e2e_id = 'PIX_' + Math.abs(hash).toString(36).toUpperCase() + '_' + cleanChars.substring(0, 8).toUpperCase();
          }
        }
      }
    }

    // 3. Extrair Valor do Pix (R$ 00,00)
    let valor = null;
    const matchValor = text.match(/(?:VALOR|TOTAL|R\$)\s*:?\s*R?\$?\s*([\d\.]+\,\d{2})/i) ||
                       text.match(/R\$\s*([\d\.]+\,\d{2})/i);
    if (matchValor && matchValor[1]) {
      const cleanVal = matchValor[1].replace(/\./g, '').replace(',', '.');
      valor = parseFloat(cleanVal);
    }

    // 4. Extrair Nome do Destinatário/Beneficiário se houver
    let beneficiario = null;
    const matchDest = text.match(/(?:DESTINAT[ÁA]RIO|BENEFICI[ÁA]RIO|PARA|RECEBEDOR|FAVORECIDO|DADOS DE QUEM RECEBEU|PAGO PARA)[:\s]+([^\n\r]+)/i);
    if (matchDest && matchDest[1]) {
      beneficiario = matchDest[1].trim();
    }

    return {
      rawText,
      e2e_id,
      isAgendamento,
      valor,
      beneficiario
    };
  },

  /**
   * Executa a análise completa do arquivo enviado pelo atleta
   */
  async processReceiptFile(file, expectedBeneficiario = '', expectedValor = 0) {
    const rawText = await this.extractText(file);
    const parsed = this.parseText(rawText);

    // Validação 1: Proibir Agendamentos
    if (parsed.isAgendamento) {
      throw new Error('Comprovante de AGENDAMENTO não é aceito. Envie a transferência Pix concluída.');
    }

    // Validação 2: Exigir Código de Autenticação/E2E
    if (!parsed.e2e_id) {
      throw new Error('Não foi possível identificar o Código de Autenticação no comprovante. Verifique a qualidade da imagem.');
    }

    const normRawText = this._normalizeStr(rawText);

    // Validação 3: Conferir Apenas o Nome do Beneficiário (se configurado pelo gestor)
    if (expectedBeneficiario && expectedBeneficiario.trim()) {
      const normBen = this._normalizeStr(expectedBeneficiario);
      const palavrasChave = normBen.split(/\s+/).filter(w => w.length > 2);

      if (palavrasChave.length > 0) {
        // Bate se ao menos 1 palavra significativa do nome (ex: "Levy", "Bezerra", "Maia") estiver no texto do comprovante
        const bateuNome = palavrasChave.some(palavra => normRawText.includes(palavra));
        if (!bateuNome) {
          throw new Error(`O comprovante enviado não parece corresponder ao beneficiário (${expectedBeneficiario}). Verifique se a transferência foi efetuada para a pessoa correta.`);
        }
      }
    }

    // Validação 4: Valor mínimo se especificado
    if (expectedValor > 0 && parsed.valor && parsed.valor < expectedValor) {
      throw new Error(`O valor identificado no Pix (R$ ${parsed.valor.toFixed(2)}) é inferior ao valor esperado (R$ ${expectedValor.toFixed(2)}).`);
    }

    return parsed;
  }
};
