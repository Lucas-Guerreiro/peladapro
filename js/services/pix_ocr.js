/**
 * js/services/pix_ocr.js — Motor de Leitura e Validação OCR de Comprovantes Pix
 */

window.PixOCR = {
  _tesseractLoaded: false,

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

  /**
   * Extrai o texto bruto do comprovante (Imagem ou PDF)
   */
  async extractText(file) {
    if (!file) throw new Error('Nenhum arquivo de comprovante fornecido.');

    // 1. Caso seja imagem (PNG, JPG, WEBP)
    if (file.type.startsWith('image/')) {
      await this._loadTesseract();
      if (!window.Tesseract) {
        throw new Error('Não foi possível carregar o leitor OCR. Verifique sua conexão.');
      }
      const worker = await Tesseract.createWorker('por');
      const ret = await worker.recognize(file);
      await worker.terminate();
      return ret.data.text || '';
    }

    // 2. Caso seja PDF, lê usando FileReader como texto bruto se legível
    if (file.type === 'application/pdf') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result || '';
          resolve(text);
        };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo PDF.'));
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
    const upperText = text.toUpperCase();

    // 1. Identificar se é Agendamento
    const isAgendamento = upperText.includes('AGENDAMENTO') ||
                          upperText.includes('PAGAMENTO AGENDADO') ||
                          upperText.includes('AGENDADO PARA');

    // 2. Extrair Código E2E / Autenticação (Ex: E000000002026... ou hashes alfanuméricos de 20 a 44 caracteres)
    let e2e_id = null;
    
    // Busca padrão E2E do Pix (começa com E e possui 31 dígitos após)
    const matchE2E = upperText.match(/E\d{31}/);
    if (matchE2E) {
      e2e_id = matchE2E[0];
    } else {
      // Busca ID de Transação / Autenticação alfanumérico padrão bancário (ex: A1B2C3D4E5F6G7H8)
      const matchAuth = upperText.match(/(?:AUTENTICA[ÇC][AÃ]O|ID DA TRANSA[ÇC][AÃ]O|CÓDIGO|TXID)[:\s]+([A-Z0-9-]{12,45})/i);
      if (matchAuth && matchAuth[1]) {
        e2e_id = matchAuth[1].replace(/[^A-Z0-9]/g, '');
      } else {
        // Fallback: Busca qualquer sequência contínua hex/alfanumerica de 20 a 36 caracteres no comprovante
        const matchGenericHash = upperText.match(/[A-Z0-9]{24,36}/);
        if (matchGenericHash) {
          e2e_id = matchGenericHash[0];
        }
      }
    }

    // 3. Extrair Valor do Pix (R$ 00,00)
    let valor = null;
    const matchValor = text.match(/(?:VALOR|R\$)\s*:?\s*R?\$?\s*([\d\.]+\,\d{2})/i);
    if (matchValor && matchValor[1]) {
      const cleanVal = matchValor[1].replace(/\./g, '').replace(',', '.');
      valor = parseFloat(cleanVal);
    }

    // 4. Extrair Nome do Destinatário/Beneficiário se houver
    let beneficiario = null;
    const matchDest = text.match(/(?:DESTINAT[ÁA]RIO|BENEFICI[ÁA]RIO|PARA|RECEBEDOR)[:\s]+([^\n\r]+)/i);
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
      throw new Error('Não foi possível identificar o Código de Autenticação/E2E no comprovante. Verifique a imagem.');
    }

    // Validação 3: Conferir Nome do Beneficiário (se configurado pelo gestor)
    if (expectedBeneficiario && expectedBeneficiario.trim()) {
      const expNorm = expectedBeneficiario.trim().toLowerCase();
      const rawNorm = rawText.toLowerCase();
      
      // Busca se o nome cadastrado ou parte dele está presente no texto
      const palavrasChave = expNorm.split(' ').filter(w => w.length > 2);
      const bateuNome = palavrasChave.some(palavra => rawNorm.includes(palavra));

      if (!bateuNome) {
        throw new Error(`O comprovante enviado não parece ter sido pago para ${expectedBeneficiario}.`);
      }
    }

    // Validação 4: Valor mínimo se especificado
    if (expectedValor > 0 && parsed.valor && parsed.valor < expectedValor) {
      throw new Error(`O valor identificado no Pix (R$ ${parsed.valor.toFixed(2)}) é inferior ao valor esperado (R$ ${expectedValor.toFixed(2)}).`);
    }

    return parsed;
  }
};
