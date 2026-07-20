import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Pelada,
  PeladaPresenca,
  Partida,
  EventoPartida,
  MvpPartida,
} from '../lib/supabase';

type PeladaWithProfile = Pelada & {
  profiles?: {
    id: string;
    nome: string;
    avatar_url?: string | null;
  } | null;
};

type PresencaWithProfile = PeladaPresenca & {
  profiles?: {
    id: string;
    nome: string;
    avatar_url?: string | null;
  } | null;
};

type CreatePeladaInput = Partial<Pelada> & {
  grupo_id?: string;
  titulo?: string;
  data?: string;
  local?: string;
};

type UpdatePeladaInput = Partial<Pelada>;

/**
 * Hook para gerenciar peladas de um grupo.
 */
export function usePeladas(grupoId?: string) {
  const [peladas, setPeladas] = useState<PeladaWithProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('peladas')
        .select(
          `*,
          profiles:criado_por (
            id,
            nome,
            avatar_url
          )`
        )
        .order('data', { ascending: false });

      if (grupoId) {
        query = query.eq('grupo_id', grupoId);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      setPeladas((data as PeladaWithProfile[]) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar peladas';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [grupoId]);

  const createPelada = useCallback(
    async (data: CreatePeladaInput): Promise<Pelada | null> => {
      try {
        const { data: created, error: insertError } = await supabase
          .from('peladas')
          .insert(data)
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        await refresh();
        return created as Pelada;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar pelada';
        setError(message);
        return null;
      }
    },
    [refresh]
  );

  const updatePelada = useCallback(
    async (id: string, data: UpdatePeladaInput): Promise<Pelada | null> => {
      try {
        const { data: updated, error: updateError } = await supabase
          .from('peladas')
          .update(data)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        await refresh();
        return updated as Pelada;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar pelada';
        setError(message);
        return null;
      }
    },
    [refresh]
  );

  const deletePelada = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const { error: deleteError } = await supabase
          .from('peladas')
          .delete()
          .eq('id', id);

        if (deleteError) {
          throw deleteError;
        }

        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir pelada';
        setError(message);
        return false;
      }
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    peladas,
    loading,
    error,
    refresh,
    createPelada,
    updatePelada,
    deletePelada,
  };
}

/**
 * Hook para gerenciar presenças em uma pelada.
 */
export function usePeladaPresencas(peladaId?: string) {
  const [presencas, setPresencas] = useState<PresencaWithProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!peladaId) {
      setPresencas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('pelada_presencas')
        .select(
          `*,
          profiles:usuario_id (
            id,
            nome,
            avatar_url
          )`
        )
        .eq('pelada_id', peladaId)
        .order('created_at', { ascending: true });

      if (queryError) {
        throw queryError;
      }

      setPresencas((data as PresencaWithProfile[]) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar presenças';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [peladaId]);

  const confirmarPresenca = useCallback(
    async (usuarioId: string): Promise<boolean> => {
      if (!peladaId) {
        return false;
      }

      try {
        const { error: upsertError } = await supabase
          .from('pelada_presencas')
          .upsert(
            {
              pelada_id: peladaId,
              usuario_id: usuarioId,
              status: 'confirmado',
            },
            { onConflict: 'pelada_id,usuario_id' }
          );

        if (upsertError) {
          throw upsertError;
        }

        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao confirmar presença';
        setError(message);
        return false;
      }
    },
    [peladaId, refresh]
  );

  const recusarPresenca = useCallback(
    async (usuarioId: string): Promise<boolean> => {
      if (!peladaId) {
        return false;
      }

      try {
        const { error: upsertError } = await supabase
          .from('pelada_presencas')
          .upsert(
            {
              pelada_id: peladaId,
              usuario_id: usuarioId,
              status: 'ausente',
            },
            { onConflict: 'pelada_id,usuario_id' }
          );

        if (upsertError) {
          throw upsertError;
        }

        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao recusar presença';
        setError(message);
        return false;
      }
    },
    [peladaId, refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    presencas,
    loading,
    error,
    confirmarPresenca,
    recusarPresenca,
    refresh,
  };
}

/**
 * Hook para gerenciar partidas dentro de uma pelada.
 */
export function usePartidas(peladaId?: string) {
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!peladaId) {
      setPartidas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('partidas')
        .select('*')
        .eq('pelada_id', peladaId)
        .order('created_at', { ascending: true });

      if (queryError) {
        throw queryError;
      }

      setPartidas((data as Partida[]) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar partidas';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [peladaId]);

  const iniciarPartida = useCallback(
    async (timeASlug: string, timeBSlug: string): Promise<Partida | null> => {
      if (!peladaId) {
        return null;
      }

      try {
        const { data: created, error: insertError } = await supabase
          .from('partidas')
          .insert({
            pelada_id: peladaId,
            time_a_slug: timeASlug,
            time_b_slug: timeBSlug,
            placar_a: 0,
            placar_b: 0,
            status: 'em_andamento',
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        await refresh();
        return created as Partida;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao iniciar partida';
        setError(message);
        return null;
      }
    },
    [peladaId, refresh]
  );

  const registrarGol = useCallback(
    async (partidaId: string, jogadorId: string, time: 'a' | 'b'): Promise<boolean> => {
      try {
        const { error: eventoError } = await supabase.from('evento_partidas').insert({
          partida_id: partidaId,
          jogador_id: jogadorId,
          tipo: 'gol',
          time,
        });

        if (eventoError) {
          throw eventoError;
        }

        const placarField = time === 'a' ? 'placar_a' : 'placar_b';
        const { error: incrementError } = await supabase.rpc('increment_placar', {
          partida_id_param: partidaId,
          placar_field: placarField,
        });

        if (incrementError) {
          // Fallback: atualiza manualmente caso a RPC não exista
          const { data: partida, error: fetchError } = await supabase
            .from('partidas')
            .select('placar_a, placar_b')
            .eq('id', partidaId)
            .single();

          if (fetchError) {
            throw fetchError;
          }

          const novoPlacar =
            time === 'a'
              ? (partida?.placar_a ?? 0) + 1
              : (partida?.placar_b ?? 0) + 1;

          const { error: updateError } = await supabase
            .from('partidas')
            .update({ [placarField]: novoPlacar })
            .eq('id', partidaId);

          if (updateError) {
            throw updateError;
          }
        }

        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar gol';
        setError(message);
        return false;
      }
    },
    [refresh]
  );

  const registrarAssistencia = useCallback(
    async (partidaId: string, jogadorId: string): Promise<boolean> => {
      try {
        const { error: eventoError } = await supabase.from('evento_partidas').insert({
          partida_id: partidaId,
          jogador_id: jogadorId,
          tipo: 'assistencia',
        });

        if (eventoError) {
          throw eventoError;
        }

        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar assistência';
        setError(message);
        return false;
      }
    },
    [refresh]
  );

  const registrarCartao = useCallback(
    async (partidaId: string, jogadorId: string): Promise<boolean> => {
      try {
        const { error: eventoError } = await supabase.from('evento_partidas').insert({
          partida_id: partidaId,
          jogador_id: jogadorId,
          tipo: 'cartao',
        });

        if (eventoError) {
          throw eventoError;
        }

        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar cartão';
        setError(message);
        return false;
      }
    },
    [refresh]
  );

  const finalizarPartida = useCallback(
    async (partidaId: string, placarA: number, placarB: number): Promise<boolean> => {
      try {
        const { error: updateError } = await supabase
          .from('partidas')
          .update({
            placar_a: placarA,
            placar_b: placarB,
            status: 'finalizada',
            finalizada_em: new Date().toISOString(),
          })
          .eq('id', partidaId);

        if (updateError) {
          throw updateError;
        }

        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao finalizar partida';
        setError(message);
        return false;
      }
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    partidas,
    loading,
    error,
    iniciarPartida,
    registrarGol,
    registrarAssistencia,
    registrarCartao,
    finalizarPartida,
    refresh,
  };
}

/**
 * Busca as próximas peladas (data >= hoje).
 */
export async function fetchProximasPeladas(limit: number = 10): Promise<PeladaWithProfile[]> {
  try {
    const hoje = new Date().toISOString();

    const { data, error } = await supabase
      .from('peladas')
      .select(
        `*,
        profiles:criado_por (
          id,
          nome,
          avatar_url
        )`
      )
      .gte('data', hoje)
      .order('data', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data as PeladaWithProfile[]) ?? [];
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar próximas peladas';
    throw new Error(message);
  }
}

/**
 * Busca peladas de uma data específica (formato YYYY-MM-DD).
 */
export async function fetchPeladasByDate(data: string): Promise<PeladaWithProfile[]> {
  try {
    const inicioDia = `${data}T00:00:00.000Z`;
    const fimDia = `${data}T23:59:59.999Z`;

    const { data: result, error } = await supabase
      .from('peladas')
      .select(
        `*,
        profiles:criado_por (
          id,
          nome,
          avatar_url
        )`
      )
      .gte('data', inicioDia)
      .lte('data', fimDia)
      .order('data', { ascending: true });

    if (error) {
      throw error;
    }

    return (result as PeladaWithProfile[]) ?? [];
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar peladas por data';
    throw new Error(message);
  }
}

export type {
  Pelada,
  PeladaPresenca,
  Partida,
  EventoPartida,
  MvpPartida,
  PeladaWithProfile,
  PresencaWithProfile,
};