"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  FolderPlus,
  ListOrdered,
  ListFilter,
  Globe,
  Users,
  Lock,
  Search,
  BookOpen,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { TopNav } from "@/components/navigation/TopNav";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CreateListModal } from "@/components/lists/CreateListModal";
import { LikeButton } from "@/components/social/LikeButton";
import { getLists } from "@/lib/lists";
import { useAuth } from "@/context/AuthContext";
import type { ListWithItems } from "@/types/database.types";

export default function ListsPage() {
  const { user } = useAuth();
  const [lists, setLists] = useState<ListWithItems[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "my" | "ranked" | "unranked">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getLists(user?.id);
      setLists(data);
    }
    load();
  }, [user?.id]);

  const handleListCreated = (newList: ListWithItems) => {
    setLists((prev) => [newList, ...prev]);
  };

  // Filter lists based on tab and query
  const filteredLists = lists.filter((list) => {
    // Tab filter
    if (activeTab === "my" && user && list.user_id !== user.id && list.user_id !== "demo-user-1") {
      return false;
    }
    if (activeTab === "ranked" && !list.is_ranked) {
      return false;
    }
    if (activeTab === "unranked" && list.is_ranked) {
      return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const listTitle = (list.title || list.name || "").toLowerCase();
      const matchName = listTitle.includes(q);
      const matchDesc = list.description?.toLowerCase().includes(q);
      const matchItem = list.items?.some((it) =>
        it.media?.title.toLowerCase().includes(q)
      );
      return matchName || matchDesc || matchItem;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      <TopNav />

      <main className="flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Editorial Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1.5">
            <span className="text-xs uppercase tracking-widest text-accent font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Curated Collections</span>
            </span>
            <h1 className="font-serif text-2xl sm:text-4xl font-bold text-text tracking-tight">
              Custom Lists & Rankings
            </h1>
            <p className="text-xs sm:text-sm text-text-muted font-sans max-w-xl">
              Build ranked personal canons, unranked moodboards, and themed reading or watchlist anthologies.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<FolderPlus className="w-4 h-4" />}
            className="self-start sm:self-auto shrink-0"
          >
            Create Custom List
          </Button>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          {/* Tab Selector */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 p-1 bg-surface rounded-lg border border-border self-start">
            {(
              [
                { id: "all", label: "All Lists" },
                { id: "my", label: "My Lists" },
                { id: "ranked", label: "Ranked" },
                { id: "unranked", label: "Unranked" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-accent text-accent-contrast shadow-2xs font-semibold"
                    : "text-text-muted hover:text-text hover:bg-surface-hover"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lists or titles..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-text placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent outline-hidden shadow-2xs"
            />
          </div>
        </div>

        {/* Lists Grid */}
        {filteredLists.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border rounded-xl bg-surface/30 p-8 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-surface border border-border flex items-center justify-center text-text-muted">
              <BookOpen className="w-6 h-6 opacity-40" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="font-serif text-lg font-bold text-text">No custom lists found</h3>
              <p className="text-xs text-text-muted">
                {searchQuery
                  ? "Try searching for a different keyword or list title."
                  : "Create your first ranked or unranked collection to organize your favorite media."}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="gap-1.5"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Create New List</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLists.map((list) => {
              const covers = list.preview_covers || [];
              const itemCount = list.item_count || list.items?.length || 0;

              return (
                <Link
                  key={list.id}
                  href={`/lists/${encodeURIComponent(list.id)}`}
                  className="group rounded-xl border border-border bg-surface hover:border-text/30 hover:shadow-md transition-all overflow-hidden flex flex-col cursor-pointer"
                >
                  {/* Poster Collages / Banner */}
                  <div className="relative h-44 bg-surface-elevated/60 border-b border-border/80 overflow-hidden flex items-center justify-center p-3">
                    {covers.length > 0 ? (
                      <div className="flex items-center justify-center -space-x-4 sm:-space-x-6">
                        {covers.slice(0, 4).map((cover, idx) => (
                          <div
                            key={idx}
                            className={`relative w-20 h-28 sm:w-22 sm:h-32 rounded-lg overflow-hidden border border-border/80 shadow-md transform transition-transform group-hover:-translate-y-1 ${
                              idx === 0
                                ? "-rotate-6 z-10"
                                : idx === 1
                                ? "-rotate-2 z-20"
                                : idx === 2
                                ? "rotate-2 z-30"
                                : "rotate-6 z-40"
                            }`}
                          >
                            <Image
                              src={cover}
                              alt="List preview cover"
                              fill
                              className="object-cover"
                              sizes="96px"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-text-muted gap-2">
                        <BookOpen className="w-8 h-8 opacity-30" />
                        <span className="text-[11px] font-serif italic opacity-75">
                          Empty collection
                        </span>
                      </div>
                    )}

                    {/* Ranked / Unranked Floating Pill Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 z-50">
                      {list.is_ranked ? (
                        <Badge variant="amber" size="sm" className="shadow-xs font-bold gap-1 text-[10px]">
                          <ListOrdered className="w-3 h-3" />
                          <span>Ranked</span>
                        </Badge>
                      ) : (
                        <Badge variant="subtle" size="sm" className="shadow-xs font-medium gap-1 text-[10px]">
                          <ListFilter className="w-3 h-3" />
                          <span>Unranked</span>
                        </Badge>
                      )}
                    </div>

                    {/* Privacy Icon */}
                    <div className="absolute top-3 right-3 z-50">
                      <div
                        className="p-1 rounded-md bg-surface/90 backdrop-blur-xs border border-border text-text-muted"
                        title={
                          list.privacy === "public"
                            ? "Public"
                            : list.privacy === "friends"
                            ? "Friends"
                            : "Private"
                        }
                      >
                        {list.privacy === "public" ? (
                          <Globe className="w-3.5 h-3.5 text-emerald-500" />
                        ) : list.privacy === "friends" ? (
                          <Users className="w-3.5 h-3.5 text-sky-500" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <h3 className="font-serif text-lg font-bold text-text group-hover:text-accent transition-colors line-clamp-1 leading-snug">
                        {list.title || list.name || "Untitled List"}
                      </h3>
                      {list.description && (
                        <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                          {list.description}
                        </p>
                      )}
                    </div>

                    {/* Meta Footer */}
                    <div className="pt-3 border-t border-border/70 flex items-center justify-between text-xs text-text-muted">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-accent text-accent-contrast font-serif font-bold text-[9px] flex items-center justify-center">
                          {list.owner?.display_name?.charAt(0).toUpperCase() || "M"}
                        </div>
                        <span className="font-medium text-text text-[11px] truncate max-w-[100px]">
                          {list.owner?.display_name || "Curator"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <LikeButton listId={list.id} size="sm" />
                        <div className="flex items-center gap-1 font-medium text-[11px]">
                          <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
                          <ArrowRight className="w-3 h-3 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Create List Modal */}
      <CreateListModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSaved={handleListCreated}
      />
    </div>
  );
}
