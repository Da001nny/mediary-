import type {
  CustomList,
  CustomListItem,
  ListWithItems,
  MediaItem,
  PrivacyLevel,
} from "@/types/database.types";

const LOCAL_STORAGE_KEY = "mediary_custom_lists_v1";

export const SAMPLE_LISTS: ListWithItems[] = [
  {
    id: "sample-list-1",
    user_id: "demo-user-1",
    title: "Top 10 Essential Sci-Fi & Mind-Benders",
    name: "Top 10 Essential Sci-Fi & Mind-Benders",
    description:
      "A personal definitive ranking of the most thought-provoking films and series that explore consciousness, time, and human destiny.",
    is_ranked: true,
    privacy: "public",
    created_at: "2026-09-20T10:00:00Z",
    updated_at: "2026-09-28T16:30:00Z",
    item_count: 4,
    preview_covers: [
      "https://image.tmdb.org/t/p/w342/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
      "https://image.tmdb.org/t/p/w342/9PFonB99qQeFLMBoLkeo672oYOX.jpg",
      "https://image.tmdb.org/t/p/w342/czembW0Rk1Ke7lCJGzyAi8Fscgt.jpg",
      "https://image.tmdb.org/t/p/w342/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    ],
    owner: {
      id: "demo-user-1",
      display_name: "Elena Rostova",
      avatar_url: null,
    },
    items: [
      {
        id: "item-1-1",
        list_id: "sample-list-1",
        media_id: "movie-27205",
        position: 1,
        notes: "Nolan's undisputed architectural masterpiece. Zimmer's score elevates every single sequence.",
        added_at: "2026-09-20T10:05:00Z",
        media: {
          id: "movie-27205",
          type: "movie",
          title: "Inception",
          cover_url: "https://image.tmdb.org/t/p/w342/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
          release_date: "2010-07-16",
          genres: ["Action", "Science Fiction", "Adventure"],
          synopsis: "Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets, is offered a chance to regain his old life.",
          community_rating_avg: 8.4,
          community_rating_count: 36000,
          type_specific: {},
          external_ids: { tmdb_id: 27205 },
          watch_providers: {},
          localized_fields: {},
          last_synced_at: "2026-09-20T10:00:00Z",
        },
      },
      {
        id: "item-1-2",
        list_id: "sample-list-1",
        media_id: "tv-95396",
        position: 2,
        notes: "The most gripping corporate thriller of the decade. Season 1 finale was pure edge-of-seat television.",
        added_at: "2026-09-20T10:10:00Z",
        media: {
          id: "tv-95396",
          type: "tv",
          title: "Severance",
          cover_url: "https://image.tmdb.org/t/p/w342/9PFonB99qQeFLMBoLkeo672oYOX.jpg",
          release_date: "2022-02-18",
          genres: ["Drama", "Mystery", "Sci-Fi & Fantasy"],
          synopsis: "Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.",
          community_rating_avg: 8.4,
          community_rating_count: 1400,
          type_specific: {},
          external_ids: { tmdb_id: 95396 },
          watch_providers: {},
          localized_fields: {},
          last_synced_at: "2026-09-20T10:00:00Z",
        },
      },
      {
        id: "item-1-3",
        list_id: "sample-list-1",
        media_id: "movie-693134",
        position: 3,
        notes: "Villeneuve delivered a sensory triumph. The spice harvester assault in IMAX was monumental.",
        added_at: "2026-09-20T10:15:00Z",
        media: {
          id: "movie-693134",
          type: "movie",
          title: "Dune: Part Two",
          cover_url: "https://image.tmdb.org/t/p/w342/czembW0Rk1Ke7lCJGzyAi8Fscgt.jpg",
          release_date: "2024-03-01",
          genres: ["Science Fiction", "Adventure"],
          synopsis: "Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.",
          community_rating_avg: 8.2,
          community_rating_count: 5400,
          type_specific: {},
          external_ids: { tmdb_id: 693134 },
          watch_providers: {},
          localized_fields: {},
          last_synced_at: "2026-09-20T10:00:00Z",
        },
      },
      {
        id: "item-1-4",
        list_id: "sample-list-1",
        media_id: "movie-129",
        position: 4,
        notes: "Miyazaki's spiritual wonder. Beautiful melancholia that transcends genre.",
        added_at: "2026-09-20T10:20:00Z",
        media: {
          id: "movie-129",
          type: "movie",
          title: "Spirited Away",
          cover_url: "https://image.tmdb.org/t/p/w342/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
          release_date: "2001-07-20",
          genres: ["Animation", "Family", "Fantasy"],
          synopsis: "A young girl, Chihiro, becomes trapped in a strange new world of spirits. When her parents undergo a mysterious transformation, she must call upon the courage she never knew she had to free her family.",
          community_rating_avg: 8.5,
          community_rating_count: 17000,
          type_specific: {},
          external_ids: { tmdb_id: 129 },
          watch_providers: {},
          localized_fields: {},
          last_synced_at: "2026-09-20T10:00:00Z",
        },
      },
    ],
  },
  {
    id: "sample-list-2",
    user_id: "demo-user-1",
    title: "Cozy Autumn Nights: Games & Books",
    name: "Cozy Autumn Nights: Games & Books",
    description:
      "Comforting escapes for rainy evenings — narrative games with warm art styles alongside immersive novels.",
    is_ranked: false,
    privacy: "friends",
    created_at: "2026-09-22T14:00:00Z",
    updated_at: "2026-09-29T11:20:00Z",
    item_count: 3,
    preview_covers: [
      "https://media.rawg.io/media/games/1f4/1f47a270b047416762f0af4e0734062e.jpg",
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80",
      "https://media.rawg.io/media/games/618/618c2031a07bbff6b4f611f10f6bcdbc.jpg",
    ],
    owner: {
      id: "demo-user-1",
      display_name: "Elena Rostova",
      avatar_url: null,
    },
    items: [
      {
        id: "item-2-1",
        list_id: "sample-list-2",
        media_id: "game-28199",
        position: 1,
        notes: "Supergiant's roguelike perfection. Darren Korb's soundtrack and Zagreus' voice acting are unmatched.",
        added_at: "2026-09-22T14:10:00Z",
        media: {
          id: "game-28199",
          type: "game",
          title: "Hades",
          cover_url: "https://media.rawg.io/media/games/1f4/1f47a270b047416762f0af4e0734062e.jpg",
          release_date: "2020-09-17",
          genres: ["Action", "RPG", "Indie"],
          synopsis: "Defy the god of the dead as you hack and slash out of the Underworld in this rogue-like dungeon crawler.",
          community_rating_avg: 4.6,
          community_rating_count: 8200,
          type_specific: {},
          external_ids: { rawg_id: 28199 },
          watch_providers: {},
          localized_fields: {},
          last_synced_at: "2026-09-22T14:00:00Z",
        },
      },
      {
        id: "item-2-2",
        list_id: "sample-list-2",
        media_id: "book-sample-1",
        position: 2,
        notes: "Gabrielle Zevin's love letter to game design, friendship, and collaborative art across decades.",
        added_at: "2026-09-22T14:15:00Z",
        media: {
          id: "book-sample-1",
          type: "book",
          title: "Tomorrow, and Tomorrow, and Tomorrow",
          cover_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80",
          release_date: "2022-07-05",
          genres: ["Fiction", "Literary Fiction"],
          synopsis: "In this exhilarating novel, two friends—often in love, but never lovers—come together as creative partners in the world of video game design.",
          community_rating_avg: 4.4,
          community_rating_count: 24000,
          type_specific: {
            author: "Gabrielle Zevin",
            pageCount: 416,
          },
          external_ids: {},
          watch_providers: {},
          localized_fields: {},
          last_synced_at: "2026-09-22T14:00:00Z",
        },
      },
      {
        id: "item-2-3",
        list_id: "sample-list-2",
        media_id: "game-3272",
        position: 3,
        notes: "CD Projekt Red's open-world fantasy pinnacle. Toussaint in the Blood & Wine DLC is pure magic.",
        added_at: "2026-09-22T14:20:00Z",
        media: {
          id: "game-3272",
          type: "game",
          title: "The Witcher 3: Wild Hunt",
          cover_url: "https://media.rawg.io/media/games/618/618c2031a07bbff6b4f611f10f6bcdbc.jpg",
          release_date: "2015-05-18",
          genres: ["Action", "RPG", "Open World"],
          synopsis: "As war rages through the Northern Realms, you take on the greatest contract of your life — tracking down the Child of Prophecy.",
          community_rating_avg: 4.7,
          community_rating_count: 14500,
          type_specific: {},
          external_ids: { rawg_id: 3272 },
          watch_providers: {},
          localized_fields: {},
          last_synced_at: "2026-09-22T14:00:00Z",
        },
      },
    ],
  },
];

/**
 * Reads all stored custom lists from localStorage (or defaults to sample lists).
 */
export function getStoredLists(): ListWithItems[] {
  if (typeof window === "undefined") {
    return SAMPLE_LISTS;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SAMPLE_LISTS));
      return SAMPLE_LISTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.error("Error reading stored lists:", e);
  }
  return SAMPLE_LISTS;
}

/**
 * Saves lists to localStorage.
 */
export function saveStoredLists(lists: ListWithItems[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lists));
  } catch (e) {
    console.error("Error saving lists:", e);
  }
}

/**
 * Fetches all lists (merging server and local fallback).
 */
export async function getLists(userId?: string): Promise<ListWithItems[]> {
  try {
    const params = new URLSearchParams();
    if (userId) params.set("user_id", userId);
    const res = await fetch(`/api/lists?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.lists) && data.lists.length > 0) {
        // Cache to local
        saveStoredLists(data.lists);
        return data.lists;
      }
    }
  } catch {
    // Network or server error, fall back to local
  }
  return getStoredLists();
}

/**
 * Fetches a single list by ID.
 */
export async function getListById(listId: string): Promise<ListWithItems | null> {
  try {
    const res = await fetch(`/api/lists/${encodeURIComponent(listId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.list) {
        return data.list;
      }
    }
  } catch {
    // fallback
  }

  const all = getStoredLists();
  return all.find((l) => l.id === listId) || null;
}

/**
 * Creates a new custom list.
 */
export async function createCustomList(params: {
  name: string;
  description?: string;
  is_ranked?: boolean;
  privacy?: PrivacyLevel;
  userId?: string;
  userName?: string;
}): Promise<ListWithItems> {
  const newList: ListWithItems = {
    id: `list-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id: params.userId || "demo-user-1",
    title: params.name.trim(),
    name: params.name.trim(),
    description: params.description?.trim() || null,
    is_ranked: Boolean(params.is_ranked),
    privacy: params.privacy || "public",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    item_count: 0,
    items: [],
    preview_covers: [],
    owner: {
      id: params.userId || "demo-user-1",
      display_name: params.userName || "You",
      avatar_url: null,
    },
  };

  // Try API first
  try {
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newList.name,
        description: newList.description,
        is_ranked: newList.is_ranked,
        privacy: newList.privacy,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.list) {
        newList.id = data.list.id;
      }
    }
  } catch {
    // Ignore, save locally
  }

  const lists = getStoredLists();
  const updated = [newList, ...lists];
  saveStoredLists(updated);
  return newList;
}

/**
 * Updates a custom list's metadata.
 */
export async function updateCustomList(
  listId: string,
  updates: Partial<Pick<CustomList, "name" | "description" | "is_ranked" | "privacy">>
): Promise<ListWithItems | null> {
  try {
    await fetch(`/api/lists/${encodeURIComponent(listId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  } catch {
    // Fall back to local
  }

  const lists = getStoredLists();
  const idx = lists.findIndex((l) => l.id === listId);
  if (idx === -1) return null;

  const target = { ...lists[idx], ...updates, updated_at: new Date().toISOString() };
  lists[idx] = target;
  saveStoredLists(lists);
  return target;
}

/**
 * Deletes a custom list.
 */
export async function deleteCustomList(listId: string): Promise<boolean> {
  try {
    await fetch(`/api/lists/${encodeURIComponent(listId)}`, {
      method: "DELETE",
    });
  } catch {
    // ignore
  }

  const lists = getStoredLists();
  const filtered = lists.filter((l) => l.id !== listId);
  saveStoredLists(filtered);
  return true;
}

/**
 * Adds a media item to a custom list.
 */
export async function addItemToList(
  listId: string,
  media: Partial<MediaItem> & { id: string; title: string; type: string; cover_url?: string | null },
  notes?: string
): Promise<ListWithItems | null> {
  const lists = getStoredLists();
  const listIndex = lists.findIndex((l) => l.id === listId);
  if (listIndex === -1) return null;

  const list = lists[listIndex];
  const items = list.items ? [...list.items] : [];

  // Check if item already exists
  const existingIdx = items.findIndex((it) => it.media_id === media.id);
  if (existingIdx !== -1) {
    // Update existing notes if provided
    if (notes !== undefined) {
      items[existingIdx].notes = notes;
    }
  } else {
    // Calculate new position (next index, 1-based)
    const nextPosition = items.length + 1;
    const newItem: CustomListItem & { media?: MediaItem | null } = {
      id: `li-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      list_id: listId,
      media_id: media.id,
      position: nextPosition,
      notes: notes || null,
      added_at: new Date().toISOString(),
      media: {
        id: media.id,
        title: media.title,
        type: media.type as "movie" | "tv" | "game" | "book",
        cover_url: media.cover_url || null,
        release_date: media.release_date || null,
        genres: media.genres || [],
        synopsis: media.synopsis || null,
        type_specific: media.type_specific || {},
        external_ids: media.external_ids || {},
        watch_providers: media.watch_providers || {},
        localized_fields: media.localized_fields || {},
        community_rating_avg: media.community_rating_avg || null,
        community_rating_count: media.community_rating_count || 0,
        last_synced_at: new Date().toISOString(),
      },
    };
    items.push(newItem);
  }

  // Update preview covers
  const previewCovers = items
    .map((it) => it.media?.cover_url)
    .filter((c): c is string => Boolean(c))
    .slice(0, 4);

  const updatedList: ListWithItems = {
    ...list,
    items,
    item_count: items.length,
    preview_covers: previewCovers,
    updated_at: new Date().toISOString(),
  };

  lists[listIndex] = updatedList;
  saveStoredLists(lists);

  // Sync to API in background
  try {
    await fetch(`/api/lists/${encodeURIComponent(listId)}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_id: media.id,
        notes: notes || null,
        position: items.length,
      }),
    });
  } catch {
    // Handled locally
  }

  return updatedList;
}

/**
 * Removes an item from a list.
 */
export async function removeItemFromList(
  listId: string,
  mediaId: string
): Promise<ListWithItems | null> {
  const lists = getStoredLists();
  const listIndex = lists.findIndex((l) => l.id === listId);
  if (listIndex === -1) return null;

  const list = lists[listIndex];
  const items = (list.items || [])
    .filter((it) => it.media_id !== mediaId)
    // Recalculate 1-based positions
    .map((it, idx) => ({ ...it, position: idx + 1 }));

  const previewCovers = items
    .map((it) => it.media?.cover_url)
    .filter((c): c is string => Boolean(c))
    .slice(0, 4);

  const updatedList: ListWithItems = {
    ...list,
    items,
    item_count: items.length,
    preview_covers: previewCovers,
    updated_at: new Date().toISOString(),
  };

  lists[listIndex] = updatedList;
  saveStoredLists(lists);

  try {
    await fetch(
      `/api/lists/${encodeURIComponent(listId)}/items?media_id=${encodeURIComponent(mediaId)}`,
      { method: "DELETE" }
    );
  } catch {
    // Handled locally
  }

  return updatedList;
}

/**
 * Reorders items in a list (for drag-and-drop).
 * Takes an array of item IDs in their new desired order.
 */
export async function reorderListItems(
  listId: string,
  orderedItemIds: string[]
): Promise<ListWithItems | null> {
  const lists = getStoredLists();
  const listIndex = lists.findIndex((l) => l.id === listId);
  if (listIndex === -1) return null;

  const list = lists[listIndex];
  const currentItems = list.items || [];

  // Map each item to its new position
  const itemMap = new Map(currentItems.map((it) => [it.id, it]));
  const reordered: typeof currentItems = [];

  orderedItemIds.forEach((id, index) => {
    const it = itemMap.get(id);
    if (it) {
      reordered.push({
        ...it,
        position: index + 1,
      });
    }
  });

  // Include any remaining items not explicitly in orderedItemIds
  currentItems.forEach((it) => {
    if (!orderedItemIds.includes(it.id)) {
      reordered.push({
        ...it,
        position: reordered.length + 1,
      });
    }
  });

  const previewCovers = reordered
    .map((it) => it.media?.cover_url)
    .filter((c): c is string => Boolean(c))
    .slice(0, 4);

  const updatedList: ListWithItems = {
    ...list,
    items: reordered,
    item_count: reordered.length,
    preview_covers: previewCovers,
    updated_at: new Date().toISOString(),
  };

  lists[listIndex] = updatedList;
  saveStoredLists(lists);

  // Sync to API
  try {
    await fetch(`/api/lists/${encodeURIComponent(listId)}/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: reordered.map((it) => ({
          id: it.id,
          position: it.position,
        })),
      }),
    });
  } catch {
    // Handled locally
  }

  return updatedList;
}

/**
 * Returns an array of list IDs that contain the given media item.
 */
export function getListsContainingMedia(mediaId: string): string[] {
  const lists = getStoredLists();
  return lists
    .filter((l) => l.items?.some((it) => it.media_id === mediaId))
    .map((l) => l.id);
}
