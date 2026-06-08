/**
 * Menu API — CRUD operacje na menu restauracji z auto-tłumaczeniem.
 * Używa Supabase jako bazy danych.
 */

import { supabase } from "./supabase";
import { translateToAll, type Lang } from "./translate";

// ─── Typy ─────────────────────────────────────────────────────────────────────

export interface MenuCategory {
  id: string;
  name_it: string;
  name_pl?: string;
  name_en?: string;
  name_de?: string;
  name_fr?: string;
  name_es?: string;
  icon: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  original_name: string;
  price: number;
  price_note?: string;
  image_url?: string;
  ingredients_it?: string;
  ingredients_pl?: string;
  ingredients_en?: string;
  ingredients_de?: string;
  ingredients_fr?: string;
  ingredients_es?: string;
  allergens?: string;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ─── Kategorie ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<MenuCategory[]> {
  const { data, error } = await supabase
    .from("menu_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) console.error("getCategories error:", error);
  return (data as MenuCategory[]) || [];
}

export async function createCategory(nameIt: string, icon = "✦"): Promise<MenuCategory | null> {
  // Auto-tłumaczenie nazwy na wszystkie języki
  const translations = await translateToAll(nameIt);
  
  const { data, error } = await supabase
    .from("menu_categories")
    .insert({
      name_it: nameIt,
      name_pl: translations.pl,
      name_en: translations.en,
      name_de: translations.de,
      name_fr: translations.fr,
      name_es: translations.es,
      icon,
    })
    .select()
    .single();

  if (error) console.error("createCategory error:", error);
  return data as MenuCategory | null;
}

export async function updateCategory(id: string, updates: Partial<MenuCategory>): Promise<void> {
  // Jeśli zmieniono nazwę IT → przetłumacz od nowa
  if (updates.name_it) {
    const translations = await translateToAll(updates.name_it);
    updates.name_pl = translations.pl;
    updates.name_en = translations.en;
    updates.name_de = translations.de;
    updates.name_fr = translations.fr;
    updates.name_es = translations.es;
  }
  await supabase.from("menu_categories").update(updates).eq("id", id);
}

export async function deleteCategory(id: string): Promise<void> {
  await supabase.from("menu_categories").delete().eq("id", id);
}

// ─── Pozycje menu ─────────────────────────────────────────────────────────────

export async function getMenuItemsByCategory(categoryId?: string): Promise<MenuItem[]> {
  let q = supabase.from("menu_items").select("*").order("sort_order", { ascending: true });
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data, error } = await q;
  if (error) console.error("getMenuItems error:", error);
  return (data as MenuItem[]) || [];
}

export async function getAllMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (error) console.error("getAllMenuItems error:", error);
  return (data as MenuItem[]) || [];
}

/**
 * Tworzy nową pozycję menu z auto-tłumaczeniem składników.
 */
export async function createMenuItem(item: {
  category_id: string;
  original_name: string;
  price: number;
  price_note?: string;
  ingredients_it?: string;
  allergens?: string;
  is_featured?: boolean;
  image_url?: string;
}): Promise<MenuItem | null> {
  // Auto-tłumaczenie składników
  let translations: Record<Lang, string> = { it: "", pl: "", en: "", de: "", fr: "", es: "" };
  if (item.ingredients_it) {
    translations = await translateToAll(item.ingredients_it);
  }

  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      category_id: item.category_id,
      original_name: item.original_name,
      price: item.price,
      price_note: item.price_note || null,
      ingredients_it: item.ingredients_it || null,
      ingredients_pl: translations.pl || null,
      ingredients_en: translations.en || null,
      ingredients_de: translations.de || null,
      ingredients_fr: translations.fr || null,
      ingredients_es: translations.es || null,
      allergens: item.allergens || null,
      is_featured: item.is_featured || false,
      image_url: item.image_url || null,
    })
    .select()
    .single();

  if (error) console.error("createMenuItem error:", error);
  return data as MenuItem | null;
}

/**
 * Aktualizuje pozycję menu. Jeśli zmieniono składniki IT → auto-tłumaczenie.
 */
export async function updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<void> {
  // Jeśli zmieniono składniki IT → przetłumacz od nowa
  if (updates.ingredients_it) {
    const translations = await translateToAll(updates.ingredients_it);
    updates.ingredients_pl = translations.pl;
    updates.ingredients_en = translations.en;
    updates.ingredients_de = translations.de;
    updates.ingredients_fr = translations.fr;
    updates.ingredients_es = translations.es;
  }
  await supabase.from("menu_items").update(updates).eq("id", id);
}

export async function deleteMenuItem(id: string): Promise<void> {
  await supabase.from("menu_items").delete().eq("id", id);
}

/**
 * Uploaduje zdjęcie dania do Supabase Storage i aktualizuje menu_item.
 */
export async function uploadMenuItemImage(id: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `menu/${id}.${ext}`;
  
  const { error } = await supabase.storage
    .from("assets")
    .upload(path, file, { upsert: true });
  
  if (error) {
    console.error("Upload image error:", error);
    return null;
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slatelpipxtqveydgslc.supabase.co"}/storage/v1/object/public/assets/${path}`;
  await supabase.from("menu_items").update({ image_url: url }).eq("id", id);
  return url;
}
