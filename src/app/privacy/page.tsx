import type { Metadata } from "next";
import Link from "next/link";
import { TopNav } from "@/components/navigation/TopNav";
import { ArrowLeft, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — meDiary",
  description:
    "Learn how meDiary protects your media journal data, privacy tiers, and account information.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Privacy Policy — meDiary",
    description:
      "Learn how meDiary protects your media journal data, privacy tiers, and account information.",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      <TopNav />

      <main className="max-w-[70ch] mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Breadcrumb / Back */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text font-mono transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Page Header */}
        <header className="border-b border-border/80 pb-6 mb-8">
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-accent font-bold font-mono mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Legal & Privacy</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-text">
            Privacy Policy
          </h1>
          <p className="mt-2 text-xs font-mono text-text-muted">
            Last updated: October 19, 2026
          </p>
        </header>

        {/* Policy Content */}
        <article className="space-y-8 text-sm sm:text-base text-text-muted leading-relaxed">
          <p className="text-text font-medium text-base sm:text-lg leading-relaxed">
            meDiary is a personal diary for movies, TV shows, video games, and
            books. We believe what you watch, read, and play is personal. This
            Privacy Policy outlines the information meDiary collects, how that
            information is used and safeguarded, your privacy controls, and how
            you can export or permanently delete your records at any time.
          </p>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              What we collect
            </h2>
            <p>
              We collect only the information necessary to provide you with a
              calm, reliable media journal:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-text/90">
              <li>
                <strong className="text-text">Account Information:</strong> When
                you create an account, we collect your email address and an
                optional display name. If you sign in through Google OAuth, we
                receive your email address and basic profile details authorized
                by you.
              </li>
              <li>
                <strong className="text-text">Media Entries & Logs:</strong> The
                titles you log, statuses (e.g. Watching, Completed, Dropped,
                Plan to Watch), ratings, reviews, progress markers, dates
                (started, finished, logged), and spoiler flags.
              </li>
              <li>
                <strong className="text-text">Custom Lists:</strong> Curated
                lists you assemble, list titles, descriptions, and item notes.
              </li>
              <li>
                <strong className="text-text">Social Interactions:</strong> Who
                you follow, who follows you, and any likes or comments you
                exchange with other readers.
              </li>
              <li>
                <strong className="text-text">Preferences:</strong> Your chosen
                rating scale, interface theme, region, and default entry
                privacy settings.
              </li>
              <li>
                <strong className="text-text">Imports:</strong> the entries from
                the Letterboxd or Goodreads files you choose to import, and the
                progress of each import.
              </li>
              <li>
                <strong className="text-text">Technical data:</strong> sign-in
                session cookies that keep you signed in, your theme choice
                (stored in your browser), and standard server logs from our
                hosting provider, which include your IP address and browser
                details.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              Who can see what
            </h2>
            <p>
              Every entry in your journal is subject to strict, database-enforced
              privacy rules:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-text/90">
              <li>
                New entries and lists use your default privacy setting, which is
                Private unless you change it in Settings. You can also choose
                privacy for each entry.
              </li>
              <li>
                <strong className="text-text">Public:</strong> Visible to anyone
                visiting meDiary or browsing your public profile.
              </li>
              <li>
                <strong className="text-text">Friends:</strong> Visible only to
                users with whom you share a mutual follow.
              </li>
              <li>
                <strong className="text-text">Private:</strong> Visible strictly
                and exclusively to you. Private entries never appear on community
                feeds, public profiles, or search indexes.
              </li>
              <li>
                <strong className="text-text">Profile Visibility:</strong> If you
                choose to hide your profile in Settings, your profile page is
                hidden from the public and returns a not-found page to other
                viewers.
              </li>
              <li>
                <strong className="text-text">Shared Year in Review:</strong> If
                you opt in to share your Year in Review via a public link, only
                entries explicitly marked as Public are included. Friends-only
                and private entries never appear on shared pages.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              Services we use
            </h2>
            <p>
              meDiary interfaces with external catalog providers to provide
              search, artwork, and metadata for titles you log:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-text/90">
              <li>
                <strong className="text-text">TMDB, RAWG and Google Books:</strong> Movie
                and TV data from TMDB. This product uses the TMDB API but is not
                endorsed or certified by TMDB. Game data from RAWG. Book data
                from Google Books. Cover images are served from those services&apos;
                image servers, which may see your IP address when an image loads.
              </li>
              <li>
                <strong className="text-text">Algolia:</strong> search over the
                title catalog. When you search, the text you type is sent to
                Algolia along with your device&apos;s IP address, as with any
                web request. Your diary entries are never sent to Algolia.
              </li>
              <li>
                <strong className="text-text">Supabase:</strong> Encrypted
                Postgres database storage, Row Level Security (RLS), and
                authentication infrastructure.
              </li>
            </ul>
            <p className="pt-1">
              We never sell, rent, or trade your personal journal data or email
              address to advertisers or third-party brokers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              4. Data Portability & Account Deletion
            </h2>
            <p>
              Your data belongs to you. meDiary provides native, self-service
              tools to control your information:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-text/90">
              <li>
                <strong className="text-text">Download My Data:</strong> You can
                export a complete JSON archive of your profile, entries, lists,
                reviews, likes, comments, and import history at any time from
                your Account Settings.
              </li>
              <li>
                <strong className="text-text">Permanent Deletion:</strong> You can
                permanently delete your account and all associated records
                directly from the Danger Zone in Settings. Deletion cascades
                immediately across our database, permanently removing your
                profile, entries, lists, and activity.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              5. Data Security
            </h2>
            <p>
              We protect your data using industry-standard technical measures,
              including Postgres Row Level Security (RLS) policies on every
              table, encrypted HTTPS data transmission, and secure token-based
              authentication.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              6. Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time to reflect
              feature improvements or legal requirements. Material changes will
              be indicated by the &ldquo;Last updated&rdquo; date at the top of
              this page.
            </p>
          </section>

          <section className="space-y-3 pt-2">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text">
              7. Contact Us
            </h2>
            <p>
              If you have any questions or feedback regarding this Privacy
              Policy or our data practices, please reach out to us at{" "}
              <a
                href="mailto:privacy@mediary.app"
                className="text-text hover:text-accent underline underline-offset-4 font-mono text-xs transition-colors"
              >
                privacy@mediary.app
              </a>
              .
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
