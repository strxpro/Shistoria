/**
 * Assets — mapowanie modeli 3D.
 * 
 * Gdy pliki GLB zostaną uploadowane do Supabase Storage (bucket: assets),
 * zmień USE_SUPABASE na true i modele będą ładowane z CDN zamiast z /public.
 * 
 * Upload modeli do Supabase:
 *   1. Otwórz Supabase Dashboard → Storage → assets
 *   2. Utwórz folder "models"
 *   3. Upload wszystkie pliki .glb z /public
 *   4. Zmień USE_SUPABASE = true poniżej
 */

const USE_SUPABASE = false; // Zmień na true po uploadzie modeli
const SUPABASE_URL = "https://slatelpipxtqveydgslc.supabase.co";
const BUCKET = "assets";

// Mapowanie nazw plików → ścieżki w storage
const MODEL_MAP: Record<string, string> = {
  "shaker-shistoria.glb": "models/shaker-shistoria.glb",
  "WINOILIKIERY.glb": "models/WINOILIKIERY.glb",
  "wodkarum.glb": "models/wodkarum.glb",
  "whiskigin.glb": "models/whiskigin.glb",
  "puszka.glb": "models/puszka.glb",
  "szkloniskieglb.glb": "models/szkloniskieglb.glb",
  "szklowysokie.glb": "models/szklowysokie.glb",
  "sok.glb": "models/sok.glb",
  "sok2.glb": "models/sok2.glb",
};

/**
 * Pobierz URL do modelu 3D.
 * Jeśli USE_SUPABASE = true → ładuj z CDN Supabase.
 * Inaczej → ładuj z /public (lokalnie).
 */
export function getModelUrl(filename: string): string {
  if (!USE_SUPABASE) return `/${filename}`;
  
  const path = MODEL_MAP[filename] || `models/${filename}`;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * Instrukcja uploadowania modeli do Supabase CLI:
 * 
 * ```bash
 * # Zainstaluj Supabase CLI
 * npm install -g supabase
 * 
 * # Upload wszystkich GLB
 * for file in public/*.glb; do
 *   supabase storage cp "$file" "ss://assets/models/$(basename $file)"
 * done
 * ```
 * 
 * Lub przez Dashboard:
 * 1. https://supabase.com/dashboard/project/slatelpipxtqveydgslc/storage/buckets/assets
 * 2. Utwórz folder "models"  
 * 3. Drag & drop pliki .glb
 */
