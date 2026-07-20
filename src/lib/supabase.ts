import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ktppxvhxtpuoikcephsy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Br3p7pqTGri1GQ-GS9KbkA_dMrSOUtg';

// ===================== Table Row Types =====================

export interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  avatar_url: string | null;
  push_token: string | null;
  created_at: Date;
  updated_at: Date | null;
}

export interface Conquista {
  id: string;
  slug: string | null;
  nome: string | null;
  icone: string | null;
  descricao: string | null;
}

export interface UsuarioConquista {
  id: string;
  usuario_id: string | null;
  conquista_slug: string | null;
  conquistado_em: Date | null;
}

export interface Grupo {
  id: string;
  nome: string | null;
  foto_url: string | null;
  modalidade: string | null;
  regras: string | null;
  jogadores_por_time: number | null;
  created_at: Date;
  updated_at: Date | null;
}

export interface GrupoMembro {
  id: string;
  grupo_id: string | null;
  usuario_id: string | null;
  papel: string | null;
  created_at: Date;
}

export interface Pelada {
  id: string;
  grupo_id: string | null;
  data: Date | null;
  local: string | null;
  status: string | null;
  modalidade: string | null;
  valor: number | null;
  duracao_minutos: number | null;
  criador_id: string | null;
  created_at: Date;
  updated_at: Date | null;
}

export interface PeladaPresenca {
  id: string;
  pelada_id: string | null;
  usuario_id: string | null;
  status: string | null;
  created_at: Date;
}

export interface Quadra {
  id: string;
  nome: string | null;
  endereco: string | null;
  rating: number | null;
  foto_url: string | null;
  ativa: boolean | null;
  created_at: Date;
}

export interface Partida {
  id: string;
  pelada_id: string | null;
  time_a_slug: string | null;
  time_b_slug: string | null;
  placar_a: number | null;
  placar_b: number | null;
  status: string | null;
  created_at: Date;
  updated_at: Date | null;
}

export interface TimePartida {
  id: string;
  partida_id: string | null;
  time_slug: string | null;
  jogador_id: string | null;
}

export interface EventoPartida {
  id: string;
  partida_id: string | null;
  tipo: string | null;
  jogador_id: string | null;
  minuto: number | null;
  created_at: Date;
}

export interface MvpPartida {
  id: string;
  partida_id: string | null;
  jogador_id: string | null;
  rating: number | null;
  created_at: Date;
}

export interface Ranking {
  id: string;
  grupo_id: string | null;
  jogador_id: string | null;
  pontuacao: number | null;
  gols: number | null;
  assistencias: number | null;
  presenca: number | null;
  created_at: Date;
  updated_at: Date | null;
}

export interface Transacao {
  id: string;
  grupo_id: string | null;
  pelada_id: string | null;
  pagador_id: string | null;
  valor: number | null;
  status: string | null;
  created_at: Date;
}

export interface Notificacao {
  id: string;
  usuario_id: string | null;
  tipo: string | null;
  titulo: string | null;
  mensagem: string | null;
  lida: boolean | null;
  created_at: Date;
}

export interface SaldoGrupo {
  id: string;
  grupo_id: string | null;
  usuario_id: string | null;
  saldo: number | null;
  updated_at: Date | null;
}

export interface RankingPeriodo {
  id: string;
  grupo_id: string | null;
  jogador_id: string | null;
  periodo: string | null;
  pontuacao: number | null;
  gols: number | null;
  assistencias: number | null;
  created_at: Date;
}

// ===================== Database Type =====================

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
      };
      conquistas: {
        Row: Conquista;
        Insert: Partial<Conquista>;
        Update: Partial<Conquista>;
      };
      usuario_conquistas: {
        Row: UsuarioConquista;
        Insert: Partial<UsuarioConquista>;
        Update: Partial<UsuarioConquista>;
      };
      grupos: {
        Row: Grupo;
        Insert: Partial<Grupo>;
        Update: Partial<Grupo>;
      };
      grupo_membros: {
        Row: GrupoMembro;
        Insert: Partial<GrupoMembro>;
        Update: Partial<GrupoMembro>;
      };
      peladas: {
        Row: Pelada;
        Insert: Partial<Pelada>;
        Update: Partial<Pelada>;
      };
      pelada_presencas: {
        Row: PeladaPresenca;
        Insert: Partial<PeladaPresenca>;
        Update: Partial<PeladaPresenca>;
      };
      quadras: {
        Row: Quadra;
        Insert: Partial<Quadra>;
        Update: Partial<Quadra>;
      };
      partidas: {
        Row: Partida;
        Insert: Partial<Partida>;
        Update: Partial<Partida>;
      };
      times_partida: {
        Row: TimePartida;
        Insert: Partial<TimePartida>;
        Update: Partial<TimePartida>;
      };
      eventos_partida: {
        Row: EventoPartida;
        Insert: Partial<EventoPartida>;
        Update: Partial<EventoPartida>;
      };
      mvp_partida: {
        Row: MvpPartida;
        Insert: Partial<MvpPartida>;
        Update: Partial<MvpPartida>;
      };
      ranking: {
        Row: Ranking;
        Insert: Partial<Ranking>;
        Update: Partial<Ranking>;
      };
      transacoes: {
        Row: Transacao;
        Insert: Partial<Transacao>;
        Update: Partial<Transacao>;
      };
      notificacoes: {
        Row: Notificacao;
        Insert: Partial<Notificacao>;
        Update: Partial<Notificacao>;
      };
      saldo_grupos: {
        Row: SaldoGrupo;
        Insert: Partial<SaldoGrupo>;
        Update: Partial<SaldoGrupo>;
      };
      ranking_periodo: {
        Row: RankingPeriodo;
        Insert: Partial<RankingPeriodo>;
        Update: Partial<RankingPeriodo>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

// ===================== Supabase Client =====================

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export default supabase;