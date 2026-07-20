import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Grupo, GrupoMembro } from '../lib/supabase';

export type GrupoPapel = 'admin' | 'membro';

export interface GrupoWithCount extends Grupo {
  membros_count?: number;
}

export interface GrupoMembroWithProfile extends GrupoMembro {
  profiles?: {
    id: string;
    nome?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface Quadra {
  id: string;
  nome: string;
  endereco?: string | null;
  grupo_id?: string | null;
  created_at?: string;
}

export interface CreateGrupoInput {
  nome: string;
  modalidade?: string | null;
  jogadores_por_time?: number | null;
  regras?: string | null;
}

export interface UpdateGrupoInput {
  nome?: string;
  modalidade?: string | null;
  jogadores_por_time?: number | null;
  regras?: string | null;
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Usuário não autenticado');
  }

  return user.id;
}

export function useGrupos() {
  const [grupos, setGrupos] = useState<GrupoWithCount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('grupos')
        .select(
          `
            *,
            membros_count:grupo_membros(count)
          `
        )
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const normalized = ((data ?? []) as unknown as GrupoWithCount[]).map((g) => ({
        ...g,
        membros_count: Array.isArray(g.membros_count) && g.membros_count.length > 0
          ? Number(g.membros_count[0]?.count ?? 0)
          : 0,
      }));

      setGrupos(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar grupos';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createGrupo = useCallback(
    async (
      nome: string,
      modalidade?: string | null,
      jogadoresPorTime?: number | null,
      regras?: string | null
    ): Promise<Grupo | null> => {
      try {
        setError(null);
        const usuarioId = await getCurrentUserId();

        const payload: CreateGrupoInput = {
          nome,
          modalidade: modalidade ?? null,
          jogadores_por_time: jogadoresPorTime ?? null,
          regras: regras ?? null,
        };

        const { data: novoGrupo, error: insertError } = await supabase
          .from('grupos')
          .insert(payload)
          .select()
          .single();

        if (insertError || !novoGrupo) {
          throw insertError ?? new Error('Falha ao criar grupo');
        }

        const { error: membroError } = await supabase
          .from('grupo_membros')
          .insert({
            grupo_id: novoGrupo.id,
            usuario_id: usuarioId,
            papel: 'admin',
          });

        if (membroError) {
          // Tenta reverter a criação do grupo em caso de falha ao adicionar o admin
          await supabase.from('grupos').delete().eq('id', novoGrupo.id);
          throw membroError;
        }

        await refresh();
        return novoGrupo as Grupo;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar grupo';
        setError(message);
        return null;
      }
    },
    [refresh]
  );

  const updateGrupo = useCallback(
    async (id: string, data: UpdateGrupoInput): Promise<boolean> => {
      try {
        setError(null);

        const { error: updateError } = await supabase
          .from('grupos')
          .update(data)
          .eq('id', id);

        if (updateError) {
          throw updateError;
        }

        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar grupo';
        setError(message);
        return false;
      }
    },
    [refresh]
  );

  const deleteGrupo = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setError(null);

        const { error: deleteError } = await supabase
          .from('grupos')
          .delete()
          .eq('id', id);

        if (deleteError) {
          throw deleteError;
        }

        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir grupo';
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
    grupos,
    loading,
    error,
    refresh,
    createGrupo,
    updateGrupo,
    deleteGrupo,
  };
}

export function useGrupoMembros(grupoId?: string) {
  const [membros, setMembros] = useState<GrupoMembroWithProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    if (!grupoId) {
      setMembros([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('grupo_membros')
        .select(
          `
            *,
            profiles:usuario_id (
              id,
              nome,
              avatar_url
            )
          `
        )
        .eq('grupo_id', grupoId)
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setMembros((data ?? []) as unknown as GrupoMembroWithProfile[]);
    } catch (err) {
      setMembros([]);
    } finally {
      setLoading(false);
    }
  }, [grupoId]);

  const convidarMembro = useCallback(
    async (usuarioId: string): Promise<boolean> => {
      if (!grupoId) {
        return false;
      }

      try {
        const { error: insertError } = await supabase
          .from('grupo_membros')
          .insert({
            grupo_id: grupoId,
            usuario_id: usuarioId,
            papel: 'membro',
          });

        if (insertError) {
          throw insertError;
        }

        await refresh();
        return true;
      } catch (err) {
        return false;
      }
    },
    [grupoId, refresh]
  );

  const removerMembro = useCallback(
    async (membroId: string): Promise<boolean> => {
      try {
        const { error: deleteError } = await supabase
          .from('grupo_membros')
          .delete()
          .eq('id', membroId);

        if (deleteError) {
          throw deleteError;
        }

        await refresh();
        return true;
      } catch (err) {
        return false;
      }
    },
    [refresh]
  );

  const alterarPapel = useCallback(
    async (membroId: string, papel: GrupoPapel): Promise<boolean> => {
      try {
        const { error: updateError } = await supabase
          .from('grupo_membros')
          .update({ papel })
          .eq('id', membroId);

        if (updateError) {
          throw updateError;
        }

        await refresh();
        return true;
      } catch (err) {
        return false;
      }
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    membros,
    loading,
    convidarMembro,
    removerMembro,
    alterarPapel,
    refresh,
  };
}

export function useQuadras(grupoId?: string) {
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase.from('quadras').select('*').order('created_at', { ascending: false });

      if (grupoId) {
        query = query.eq('grupo_id', grupoId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setQuadras((data ?? []) as Quadra[]);
    } catch (err) {
      setQuadras([]);
    } finally {
      setLoading(false);
    }
  }, [grupoId]);

  const createQuadra = useCallback(
    async (nome: string, endereco?: string | null): Promise<Quadra | null> => {
      try {
        const payload: Partial<Quadra> = {
          nome,
          endereco: endereco ?? null,
        };

        if (grupoId) {
          payload.grupo_id = grupoId;
        }

        const { data, error: insertError } = await supabase
          .from('quadras')
          .insert(payload)
          .select()
          .single();

        if (insertError || !data) {
          throw insertError ?? new Error('Falha ao criar quadra');
        }

        await refresh();
        return data as Quadra;
      } catch (err) {
        return null;
      }
    },
    [grupoId, refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    quadras,
    loading,
    createQuadra,
  };
}