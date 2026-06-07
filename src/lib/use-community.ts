/**
 * Hook: useCommunityDrinks — ładuje drinki z Supabase, 
 * sync z localStorage, obsługuje polubienia i komentarze.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase, getSessionId, publishDrink, uploadDrinkPhoto, likeDrink, addComment, getCommunityDrinks, claimDrink } from "./supabase";

export interface CommunityDrink {
  id: string;
  name: string;
  author_name: string;
  author_email?: string;
  ingredients: { id: string; name: string; color: string; ml: number }[];
  total_ml: number;
  strength_label: string;
  strength_value: number;
  color: string;
  photo_url?: string;
  likes: number;
  claimed_count: number;
  is_drink_of_month: boolean;
  created_at: string;
}

const LS_KEY = "sh-my-drinks";
const LS_SESSION = "sh-session-id";

// Zapamiętaj drink w localStorage (bez logowania)
function saveToLocal(drink: Partial<CommunityDrink>) {
  if (typeof localStorage === "undefined") return;
  const existing = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  existing.push({ ...drink, saved_at: new Date().toISOString() });
  localStorage.setItem(LS_KEY, JSON.stringify(existing));
}

// Pobierz zapisane drinki z localStorage
export function getLocalDrinks(): Partial<CommunityDrink>[] {
  if (typeof localStorage === "undefined") return [];
  return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
}

export function useCommunityDrinks(initialLimit = 6) {
  const [drinks, setDrinks] = useState<CommunityDrink[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    const newOffset = reset ? 0 : offset;
    const data = await getCommunityDrinks(initialLimit, newOffset);
    if (reset) {
      setDrinks(data as CommunityDrink[]);
    } else {
      setDrinks((prev) => [...prev, ...(data as CommunityDrink[])]);
    }
    setHasMore(data.length >= initialLimit);
    setOffset(newOffset + data.length);
    setLoading(false);
  }, [offset, initialLimit]);

  useEffect(() => { load(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => { if (hasMore && !loading) load(); }, [hasMore, loading, load]);

  const publish = useCallback(async (drink: {
    name: string;
    author_name: string;
    author_email?: string;
    ingredients: { id: string; name: string; color: string; ml: number }[];
    total_ml: number;
    strength_label: string;
    strength_value: number;
    color: string;
    photo?: File;
  }) => {
    let photo_url: string | undefined;

    // Najpierw publikuj drink (żeby mieć ID)
    const result = await publishDrink({
      name: drink.name,
      author_name: drink.author_name,
      author_email: drink.author_email,
      ingredients: drink.ingredients,
      total_ml: drink.total_ml,
      strength_label: drink.strength_label,
      strength_value: drink.strength_value,
      color: drink.color,
    });

    if (!result) return null;

    // Upload zdjęcie jeśli jest
    if (drink.photo && result.id) {
      photo_url = await uploadDrinkPhoto(drink.photo, result.id) || undefined;
      if (photo_url) {
        await supabase.from("community_drinks").update({ photo_url }).eq("id", result.id);
      }
    }

    // Zapisz w localStorage
    saveToLocal({ ...result, photo_url });

    // Odśwież listę
    load(true);
    return result;
  }, [load]);

  const like = useCallback(async (drinkId: string) => {
    const success = await likeDrink(drinkId);
    if (success) {
      setDrinks((prev) => prev.map((d) => d.id === drinkId ? { ...d, likes: d.likes + 1 } : d));
    }
    return success;
  }, []);

  const comment = useCallback(async (drinkId: string, author: string, content: string) => {
    return await addComment(drinkId, author, content);
  }, []);

  const claim = useCallback(async (drinkId: string, name: string) => {
    const order = await claimDrink(drinkId, name);
    if (order) {
      setDrinks((prev) => prev.map((d) => d.id === drinkId ? { ...d, claimed_count: (d as any).claimed_count ? (d as any).claimed_count + 1 : 1 } : d));
    }
    return order;
  }, []);

  return { drinks, loading, hasMore, loadMore, publish, like, comment, claim };
}
