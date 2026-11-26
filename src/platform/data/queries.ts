import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Story, StoryInput, TakeWithFeedback } from "./types";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export function useStories() {
  return useQuery({
    queryKey: ["stories"],
    queryFn: async () => unwrap<Story[]>(await supabase.from("stories").select("*").order("updated_at", { ascending: false })),
  });
}

export function useSaveStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<StoryInput> & { id?: string }) => {
      const q = id ? supabase.from("stories").update(input).eq("id", id) : supabase.from("stories").insert(input);
      return unwrap(await q.select().single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stories"] }),
  });
}

export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from("stories").delete().eq("id", id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stories"] }),
  });
}

export function useTakes() {
  return useQuery({
    queryKey: ["takes"],
    queryFn: async () =>
      unwrap<TakeWithFeedback[]>(
        await supabase.from("takes").select("*, feedback(*)").order("created_at", { ascending: false }).limit(200),
      ),
  });
}
