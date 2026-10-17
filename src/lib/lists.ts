import type {
  CustomList,
  ListWithItems,
  MediaItem,
  PrivacyLevel,
} from "@/types/database.types";

// Purge obsolete localStorage key if present
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("mediary_custom_lists_v1");
  } catch {
    // Ignore
  }
}

export interface GetListsResult {
  lists: ListWithItems[];
  error: string | null;
}

export interface GetListResult {
  list: ListWithItems | null;
  error: string | null;
}

/**
 * Fetches lists from the database API.
 * Never falls back to localStorage. An empty list array is a valid result.
 * Returns an error state on network or server error.
 */
export async function getLists(userId?: string): Promise<GetListsResult> {
  try {
    const params = new URLSearchParams();
    if (userId) params.set("user_id", userId);
    const res = await fetch(`/api/lists?${params.toString()}`);
    if (!res.ok) {
      return { lists: [], error: "Couldn't load lists" };
    }
    const data = await res.json();
    if (data.error) {
      return { lists: [], error: "Couldn't load lists" };
    }
    if (Array.isArray(data.lists)) {
      return { lists: data.lists, error: null };
    }
    return { lists: [], error: null };
  } catch (err) {
    console.error("Network or server error in getLists:", err);
    return { lists: [], error: "Couldn't load lists" };
  }
}

/**
 * Fetches a single list by ID from the database API.
 * Never falls back to localStorage or sample lists.
 * Returns { list: null, error: null } if not found, or error message on failure.
 */
export async function getListById(listId: string): Promise<GetListResult> {
  // Sample lists do not exist in the database and must show normal "list not found" state
  if (listId === "sample-list-1" || listId === "sample-list-2") {
    return { list: null, error: null };
  }

  try {
    const res = await fetch(`/api/lists/${encodeURIComponent(listId)}`);
    if (res.status === 404) {
      return { list: null, error: null };
    }
    if (!res.ok) {
      return { list: null, error: "Couldn't load list" };
    }
    const data = await res.json();
    return { list: data.list || null, error: null };
  } catch (err) {
    console.error("Network or server error in getListById:", err);
    return { list: null, error: "Couldn't load list" };
  }
}

/**
 * Creates a new custom list in the database.
 * No localStorage persistence. Throws on API failure.
 */
export async function createCustomList(params: {
  name: string;
  description?: string;
  is_ranked?: boolean;
  privacy?: PrivacyLevel;
  userId?: string;
  userName?: string;
}): Promise<ListWithItems> {
  const res = await fetch("/api/lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name.trim(),
      description: params.description?.trim() || null,
      is_ranked: Boolean(params.is_ranked),
      privacy: params.privacy || "public",
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error || "Failed to create list");
  }

  const data = await res.json();
  if (!data.list) {
    throw new Error("Invalid response received from server");
  }

  return data.list;
}

/**
 * Updates a custom list's metadata in the database.
 * No localStorage persistence. Throws on API failure.
 */
export async function updateCustomList(
  listId: string,
  updates: Partial<Pick<CustomList, "name" | "description" | "is_ranked" | "privacy">>
): Promise<ListWithItems> {
  const res = await fetch(`/api/lists/${encodeURIComponent(listId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error || "Failed to update list");
  }

  const data = await res.json();
  if (!data.list) {
    throw new Error("Invalid response received from server");
  }

  return data.list;
}

/**
 * Deletes a custom list from the database.
 * No localStorage persistence. Throws on API failure.
 */
export async function deleteCustomList(listId: string): Promise<boolean> {
  const res = await fetch(`/api/lists/${encodeURIComponent(listId)}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error || "Failed to delete list");
  }

  return true;
}

/**
 * Adds or updates a media item in a custom list in the database.
 * No localStorage persistence. Throws on API failure.
 */
export async function addItemToList(
  listId: string,
  media: Partial<MediaItem> & { id: string; title: string; type: string; cover_url?: string | null },
  notes?: string
): Promise<{ success: boolean; item?: unknown }> {
  const res = await fetch(`/api/lists/${encodeURIComponent(listId)}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_id: media.id,
      notes: notes || null,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error || "Failed to add item to list");
  }

  const data = await res.json();
  return { success: true, item: data.item };
}

/**
 * Removes an item from a list in the database.
 * No localStorage persistence. Throws on API failure.
 */
export async function removeItemFromList(
  listId: string,
  mediaId: string
): Promise<boolean> {
  const res = await fetch(
    `/api/lists/${encodeURIComponent(listId)}/items?media_id=${encodeURIComponent(mediaId)}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error || "Failed to remove item from list");
  }

  return true;
}

/**
 * Reorders items in a list in the database.
 * Takes an array of item IDs in their new desired order.
 * No localStorage persistence. Throws on API failure.
 */
export async function reorderListItems(
  listId: string,
  orderedItemIds: string[]
): Promise<boolean> {
  const res = await fetch(`/api/lists/${encodeURIComponent(listId)}/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: orderedItemIds.map((id, index) => ({
        id,
        position: index + 1,
      })),
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error || "Failed to reorder list items");
  }

  return true;
}

/**
 * Returns an array of list IDs that contain the given media item from a provided list set.
 */
export function getListsContainingMedia(mediaId: string, lists: ListWithItems[] = []): string[] {
  return lists
    .filter((l) => l.items?.some((it) => it.media_id === mediaId))
    .map((l) => l.id);
}
