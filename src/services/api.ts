import { supabase } from '../lib/supabase';

// ============================================================
// Types
// ============================================================

export interface Jogador {
  id: string;
  nome: string;
  posicao?: string;
  foto_url?: string;
}

export interface EstatisticasJogador {
  jogos: number;
  gols: number;
  assistencias: number;
  presenca: number;
}

export interface Conquista {
  id: string;
  titulo: string;
  descricao?: string;
  icone?: string;
  data_conquista: string;
}

export interface RankingItem {
  jogador_id: string;
  nome: string;
  pontos: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols: number;
}

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
}

export interface UploadResult {
  path: string;
}

// ============================================================
// Storage
// ============================================================

/**
 * Faz o upload de uma imagem para o Supabase Storage.
 * @param filePath Caminho dentro do bucket onde o arquivo será armazenado.
 * @param bucket Nome do bucket no Supabase Storage.
 * @param file Arquivo a ser enviado (File, Blob ou ArrayBuffer).
 * @returns Objeto com o caminho do arquivo ou null em caso de erro.
 */
export async function uploadImage(
  filePath: string,
  bucket: string,
  file: any,
): Promise<UploadResult | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Erro ao fazer upload da imagem:', error.message);
      return null;
    }

    return data as UploadResult;
  } catch (err) {
    console.error('Erro inesperado no upload da imagem:', err);
    return null;
  }
}

/**
 * Retorna a URL pública de uma imagem armazenada no Supabase Storage.
 * @param path Caminho do arquivo dentro do bucket.
 * @param bucket Nome do bucket no Supabase Storage.
 * @returns URL pública da imagem ou string vazia em caso de erro.
 */
export function getImageUrl(path: string, bucket: string): string {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error('Erro ao obter URL pública da imagem:', err);
    return '';
  }
}

// ============================================================
// Jogadores
// ============================================================

/**
 * Busca jogadores pelo nome utilizando ilike.
 * @param searchTerm Termo de busca.
 * @returns Lista de jogadores encontrados.
 */
export async function searchJogadores(searchTerm: string): Promise<Jogador[]> {
  try {
    const { data, error } = await supabase
      .from('jogadores')
      .select('id, nome, posicao, foto_url')
      .ilike('nome', `%${searchTerm}%`)
      .order('nome', { ascending: true });

    if (error) {
      console.error('Erro ao buscar jogadores:', error.message);
      return [];
    }

    return (data ?? []) as Jogador[];
  } catch (err) {
    console.error('Erro inesperado ao buscar jogadores:', err);
    return [];
  }
}

/**
 * Obtém as estatísticas de um jogador (jogos, gols, assistências e presença %).
 * @param jogadorId ID do jogador.
 * @returns Estatísticas do jogador ou null em caso de erro.
 */
export async function getEstatisticasJogador(
  jogadorId: string,
): Promise<EstatisticasJogador | null> {
  try {
    const { data, error } = await supabase
      .from('estatisticas_jogadores')
      .select('jogos, gols, assistencias, presenca')
      .eq('jogador_id', jogadorId)
      .single();

    if (error) {
      console.error('Erro ao buscar estatísticas do jogador:', error.message);
      return null;
    }

    return data as EstatisticasJogador;
  } catch (err) {
    console.error('Erro inesperado ao buscar estatísticas:', err);
    return null;
  }
}

/**
 * Obtém as conquistas de um jogador com JOIN na tabela conquistas.
 * @param jogadorId ID do jogador.
 * @returns Lista de conquistas do jogador.
 */
export async function getConquistasJogador(jogadorId: string): Promise<Conquista[]> {
  try {
    const { data, error } = await supabase
      .from('jogador_conquistas')
      .select(
        `
        id,
        data_conquista,
        conquistas (
          id,
          titulo,
          descricao,
          icone
        )
      `,
      )
      .eq('jogador_id', jogadorId)
      .order('data_conquista', { ascending: false });

    if (error) {
      console.error('Erro ao buscar conquistas do jogador:', error.message);
      return [];
    }

    const conquistas: Conquista[] = (data ?? []).map((item: any) => ({
      id: item.conquistas?.id ?? '',
      titulo: item.conquistas?.titulo ?? '',
      descricao: item.conquistas?.descricao ?? undefined,
      icone: item.conquistas?.icone ?? undefined,
      data_conquista: item.data_conquista,
    }));

    return conquistas;
  } catch (err) {
    console.error('Erro inesperado ao buscar conquistas:', err);
    return [];
  }
}

// ============================================================
// Grupos / Ranking
// ============================================================

/**
 * Obtém o ranking de um grupo ordenado por pontos.
 * @param grupoId ID do grupo.
 * @param limit Limite opcional de registros retornados.
 * @returns Lista do ranking do grupo.
 */
export async function getRankingGrupo(
  grupoId: string,
  limit?: number,
): Promise<RankingItem[]> {
  try {
    let query = supabase
      .from('ranking_grupos')
      .select(
        'jogador_id, nome, pontos, jogos, vitorias, empates, derrotas, gols',
      )
      .eq('grupo_id', grupoId)
      .order('pontos', { ascending: false });

    if (limit !== undefined && limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar ranking do grupo:', error.message);
      return [];
    }

    return (data ?? []) as RankingItem[];
  } catch (err) {
    console.error('Erro inesperado ao buscar ranking:', err);
    return [];
  }
}

/**
 * Obtém o saldo de um usuário em um grupo a partir da tabela saldo_grupos.
 * @param grupoId ID do grupo.
 * @param usuarioId ID do usuário.
 * @returns Saldo do usuário ou 0 em caso de erro.
 */
export async function getSaldoUsuario(
  grupoId: string,
  usuarioId: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('saldo_grupos')
      .select('saldo')
      .eq('grupo_id', grupoId)
      .eq('usuario_id', usuarioId)
      .single();

    if (error) {
      console.error('Erro ao buscar saldo do usuário:', error.message);
      return 0;
    }

    return data?.saldo ?? 0;
  } catch (err) {
    console.error('Erro inesperado ao buscar saldo:', err);
    return 0;
  }
}

/**
 * Marca uma transação como paga.
 * @param transacaoId ID da transação.
 * @returns true se a operação foi bem-sucedida, false caso contrário.
 */
export async function cobrarPagamento(transacaoId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('transacoes')
      .update({
        status: 'pago',
        pago_em: new Date().toISOString(),
      })
      .eq('id', transacaoId);

    if (error) {
      console.error('Erro ao marcar pagamento como pago:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Erro inesperado ao cobrar pagamento:', err);
    return false;
  }
}

// ============================================================
// Notificações
// ============================================================

/**
 * Obtém as notificações não lidas de um usuário.
 * @param usuarioId ID do usuário.
 * @returns Lista de notificações não lidas.
 */
export async function getNotificacoes(usuarioId: string): Promise<Notificacao[]> {
  try {
    const { data, error } = await supabase
      .from('notificacoes')
      .select('id, titulo, mensagem, lida, created_at')
      .eq('usuario_id', usuarioId)
      .eq('lida', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar notificações:', error.message);
      return [];
    }

    return (data ?? []) as Notificacao[];
  } catch (err) {
    console.error('Erro inesperado ao buscar notificações:', err);
    return [];
  }
}

/**
 * Marca uma notificação como lida.
 * @param notificacaoId ID da notificação.
 * @returns true se a operação foi bem-sucedida, false caso contrário.
 */
export async function marcarNotificacaoLida(
  notificacaoId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', notificacaoId);

    if (error) {
      console.error('Erro ao marcar notificação como lida:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Erro inesperado ao marcar notificação como lida:', err);
    return false;
  }
}

// ============================================================
// Formatação
// ============================================================

/**
 * Formata um valor numérico como moeda brasileira (R$ X.XXX,XX).
 * @param value Valor a ser formatado.
 * @returns String formatada no padrão BRL.
 */
export function formatCurrency(value: number): string {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  } catch (err) {
    console.error('Erro ao formatar moeda:', err);
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }
}

/**
 * Formata uma data no padrão brasileiro (dd/mm/aaaa).
 * @param date Data em formato ISO ou string reconhecida pelo Date.
 * @returns String formatada ou vazia em caso de erro.
 */
export function formatDate(date: string): string {
  try {
    const parsedDate = new Date(date);

    if (isNaN(parsedDate.getTime())) {
      return '';
    }

    const day = String(parsedDate.getDate()).padStart(2, '0');
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const year = parsedDate.getFullYear();

    return `${day}/${month}/${year}`;
  } catch (err) {
    console.error('Erro ao formatar data:', err);
    return '';
  }
}