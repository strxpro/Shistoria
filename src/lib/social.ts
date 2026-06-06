/**
 * Social Media Integration — przygotowany stub.
 * 
 * Do podłączenia:
 * 1. Instagram Graph API — wymaga Facebook App + Instagram Business Account
 * 2. Facebook Page API — wymaga Page Access Token
 * 
 * Konfiguracja (dodaj w .env.local):
 *   NEXT_PUBLIC_FB_PAGE_ID=xxx
 *   FB_PAGE_ACCESS_TOKEN=xxx
 *   IG_BUSINESS_ACCOUNT_ID=xxx
 */

export interface SocialPost {
  caption: string;
  imageUrl?: string;
  platforms: ("instagram" | "facebook")[];
}

export interface SocialConfig {
  facebook: {
    pageId: string;
    accessToken: string;
  } | null;
  instagram: {
    businessAccountId: string;
    accessToken: string; // Same as FB page token
  } | null;
}

// Pobierz konfigurację z env
export function getSocialConfig(): SocialConfig {
  return {
    facebook: process.env.NEXT_PUBLIC_FB_PAGE_ID ? {
      pageId: process.env.NEXT_PUBLIC_FB_PAGE_ID,
      accessToken: process.env.FB_PAGE_ACCESS_TOKEN || "",
    } : null,
    instagram: process.env.IG_BUSINESS_ACCOUNT_ID ? {
      businessAccountId: process.env.IG_BUSINESS_ACCOUNT_ID,
      accessToken: process.env.FB_PAGE_ACCESS_TOKEN || "",
    } : null,
  };
}

/**
 * Publikuj post na Facebooku.
 * Wymaga: FB_PAGE_ACCESS_TOKEN w env.
 */
export async function postToFacebook(post: SocialPost): Promise<{ success: boolean; id?: string; error?: string }> {
  const config = getSocialConfig();
  if (!config.facebook) return { success: false, error: "Facebook not configured" };

  try {
    const params: Record<string, string> = {
      message: post.caption,
      access_token: config.facebook.accessToken,
    };
    if (post.imageUrl) params.url = post.imageUrl;

    const endpoint = post.imageUrl
      ? `https://graph.facebook.com/v18.0/${config.facebook.pageId}/photos`
      : `https://graph.facebook.com/v18.0/${config.facebook.pageId}/feed`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    if (data.id) return { success: true, id: data.id };
    return { success: false, error: data.error?.message || "Unknown error" };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Publikuj na Instagramie (wymaga business account + hosted image URL).
 * Flow: 1) Stwórz media container  2) Publish container
 */
export async function postToInstagram(post: SocialPost): Promise<{ success: boolean; id?: string; error?: string }> {
  const config = getSocialConfig();
  if (!config.instagram) return { success: false, error: "Instagram not configured" };
  if (!post.imageUrl) return { success: false, error: "Instagram requires an image" };

  try {
    // Step 1: Create media container
    const createRes = await fetch(
      `https://graph.facebook.com/v18.0/${config.instagram.businessAccountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: post.imageUrl,
          caption: post.caption,
          access_token: config.instagram.accessToken,
        }),
      }
    );
    const createData = await createRes.json();
    if (!createData.id) return { success: false, error: createData.error?.message || "Failed to create media" };

    // Step 2: Publish
    const publishRes = await fetch(
      `https://graph.facebook.com/v18.0/${config.instagram.businessAccountId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: config.instagram.accessToken,
        }),
      }
    );
    const publishData = await publishRes.json();
    if (publishData.id) return { success: true, id: publishData.id };
    return { success: false, error: publishData.error?.message || "Failed to publish" };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Publikuj event na wszystkich wybranych platformach.
 * Używane z panelu admina po kliknięciu "Pubblica".
 */
export async function publishEventToSocial(event: {
  title: string;
  description: string;
  date: string;
  imageUrl?: string;
  platforms: ("instagram" | "facebook")[];
}): Promise<{ results: { platform: string; success: boolean; error?: string }[] }> {
  const caption = `🎭 ${event.title}\n📅 ${event.date}\n\n${event.description}\n\n📍 S'Historia · Rena Majore, Sardegna\n#SHistoria #RenaMajore #Sardegna #CocktailBar`;
  
  const post: SocialPost = {
    caption,
    imageUrl: event.imageUrl,
    platforms: event.platforms,
  };

  const results: { platform: string; success: boolean; error?: string }[] = [];

  if (event.platforms.includes("facebook")) {
    const fb = await postToFacebook(post);
    results.push({ platform: "facebook", ...fb });
  }

  if (event.platforms.includes("instagram")) {
    const ig = await postToInstagram(post);
    results.push({ platform: "instagram", ...ig });
  }

  return { results };
}

/**
 * Generuj caption dla community drinka (do share na social).
 */
export function generateDrinkCaption(drink: {
  name: string;
  author_name: string;
  ingredients: { name: string }[];
  strength_label: string;
}): string {
  const ingrs = drink.ingredients.map((i) => i.name).join(", ");
  return `🍸 ${drink.name} — by ${drink.author_name}\n\n📝 ${ingrs}\n💪 ${drink.strength_label}\n\nCreato con il nostro Cocktail Creator interattivo!\n\n📍 S'Historia · Rena Majore\n#SHistoria #CocktailCreator #DrinkDelMese`;
}
