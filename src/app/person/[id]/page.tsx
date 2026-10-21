import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TopNav } from "@/components/navigation/TopNav";
import { PersonFilmographyView } from "@/components/person/PersonFilmographyView";
import { fetchTMDBPerson } from "@/lib/tmdb";
import { createClient } from "@/lib/supabase/server";
import { Users, ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    return {
      title: "Sign in to view Person Filmography — meDiary",
      description: "Sign in to meDiary to view filmography and creator credits.",
    };
  }

  const { data: person } = await fetchTMDBPerson(id);

  if (!person) {
    return {
      title: "Person Filmography — meDiary",
      description: "Filmography and media credits on meDiary.",
    };
  }

  return {
    title: `${person.name} — Filmography & Credits | meDiary`,
    description:
      person.biography?.slice(0, 160) ||
      `Explore ${person.name}'s known-for movies, TV shows, and full credits on meDiary.`,
    openGraph: {
      title: `${person.name} — Filmography & Credits | meDiary`,
      description:
        person.biography?.slice(0, 160) ||
        `Explore ${person.name}'s known-for movies and TV shows on meDiary.`,
      images: person.profile_url ? [{ url: person.profile_url }] : [],
    },
  };
}

export default async function PersonDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
        <TopNav />
        <main className="flex-1 max-w-xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-accent mb-4 shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-text mb-2">
            Sign in to search and view details
          </h1>
          <p className="text-sm text-text-muted max-w-md mb-6 leading-relaxed">
            Viewing cast and crew filmographies and credits requires being signed in to meDiary.
          </p>
          <div className="flex items-center gap-3">
            <Link href={`/login?returnTo=/person/${encodeURIComponent(id)}`}>
              <Button variant="primary" size="md">
                Sign In
              </Button>
            </Link>
            <Link href="/">
              <Button variant="secondary" size="md">
                Return to Catalog
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { data: person, error } = await fetchTMDBPerson(id);

  if (!person) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
        <TopNav />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted mb-4 shadow-xs">
            <Users className="w-8 h-8 opacity-50" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-text mb-2">
            Performer or Creator Not Found
          </h1>
          <p className="text-sm text-text-muted max-w-md mb-6">
            {error ||
              "We couldn't retrieve filmography data for this person from TMDB. Check the URL or search for another title in the catalog."}
          </p>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Return to Catalog
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans">
      <TopNav />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <PersonFilmographyView person={person} />
      </main>
    </div>
  );
}
