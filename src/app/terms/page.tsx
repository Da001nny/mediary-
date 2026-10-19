import type { Metadata } from "next";
import Link from "next/link";
import { TopNav } from "@/components/navigation/TopNav";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — meDiary",
  description:
    "Terms of service, community guidelines, and third-party data credits for meDiary.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Terms of Service — meDiary",
    description:
      "Terms of service, community guidelines, and third-party data credits for meDiary.",
  },
};

export default function TermsOfServicePage() {
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
            <FileText className="w-3.5 h-3.5" />
            <span>Legal Agreement</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-text">
            Terms of Service
          </h1>
          <p className="mt-2 text-xs font-mono text-text-muted">
            Last updated: October 19, 2026
          </p>
        </header>

        {/* Terms Content */}
        <article className="space-y-8 text-sm sm:text-base text-text-muted leading-relaxed">
          <p className="text-text font-medium text-base sm:text-lg leading-relaxed">
            Welcome to meDiary. By creating an account, browsing, or using
            meDiary (&ldquo;the Service&rdquo;), you agree to be bound by these
            Terms of Service. If you do not agree with any part of these terms,
            you may not access or use the Service.
          </p>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              1. The Service
            </h2>
            <p>
              meDiary is an intentional, personal media journal designed for
              cataloging, reviewing, and organizing movies, television shows,
              video games, and books. We provide tools to log activity, create
              custom lists, and connect with other readers and viewers through
              calm social feeds.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              2. User Accounts & Responsibilities
            </h2>
            <p>
              When you register an account, you must provide valid credentials.
              You are responsible for:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-text/90">
              <li>Maintaining the confidentiality of your login credentials.</li>
              <li>
                All activity, content postings, and interactions occurring under
                your account.
              </li>
              <li>
                Notifying us immediately if you suspect unauthorized access to
                your account.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              3. User Content & Intellectual Property
            </h2>
            <p>
              You retain all ownership rights to the reviews, diary notes, lists,
              and ratings you submit to meDiary (&ldquo;User Content&rdquo;).
            </p>
            <p>
              By submitting User Content to meDiary, you grant meDiary a
              non-exclusive, royalty-free license to store, process, and display
              your content strictly in accordance with your chosen privacy
              tier (Public, Friends, or Private).
            </p>
            <p>
              You agree not to post content that is defamatory, abusive,
              unlawful, infringing on copyright, or that violates the rights of
              any third party.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              4. Third-Party Data & Credits
            </h2>
            <p>
              meDiary interfaces with external catalog providers to provide
              search, artwork, and metadata for titles you log:
            </p>
            <div className="p-4 rounded-xl bg-surface/60 border border-border/80 text-text text-xs sm:text-sm leading-relaxed">
              Movie and TV data from TMDB. This product uses the TMDB API but is not
              endorsed or certified by TMDB. Game data from RAWG. Book data from
              Google Books.
            </div>
            <p className="text-xs text-text-muted">
              All trademarks, product names, logos, and brands displayed on the
              Service are property of their respective owners.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              5. Acceptable Use
            </h2>
            <p>
              To keep meDiary a respectful and sustainable environment, you agree
              not to:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-text/90">
              <li>
                Scrape, crawl, or harvest data through automated means without
                prior consent.
              </li>
              <li>
                Bypass comment and review rate limits, or disrupt our API
                services.
              </li>
              <li>
                Attempt to gain unauthorized access to any other user&rsquo;s
                private diary records.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              6. Data Ownership & Account Termination
            </h2>
            <p>
              You may download a full export of your personal data at any time via
              the &ldquo;Download My Data&rdquo; feature in Settings.
            </p>
            <p>
              You may permanently terminate and delete your account at any time
              through the self-service Danger Zone in Settings. Upon confirmation,
              all associated records are immediately deleted from our database.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              7. Disclaimers & Limitation of Liability
            </h2>
            <p>
              The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; basis without warranties of any kind. To the
              fullest extent permitted by law, meDiary and its contributors shall
              not be liable for any indirect, incidental, or consequential
              damages resulting from your use of or inability to use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text pt-2">
              8. Changes to Terms
            </h2>
            <p>
              We may modify these Terms of Service periodically. Continued use of
              meDiary following any modifications constitutes your acceptance of
              the revised terms.
            </p>
          </section>

          <section className="space-y-3 pt-2">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text">
              9. Contact
            </h2>
            <p>
              For inquiries regarding these Terms of Service, please reach out to{" "}
              <a
                href="mailto:legal@mediary.app"
                className="text-text hover:text-accent underline underline-offset-4 font-mono text-xs transition-colors"
              >
                legal@mediary.app
              </a>
              .
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
