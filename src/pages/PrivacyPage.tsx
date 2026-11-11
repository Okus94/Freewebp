import type { ReactNode } from 'react'
import { SubPage } from '../components/SubPage'

const UPDATED = '11 November 2026'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[20px] leading-[1.3] font-semibold tracking-[-0.3px]">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-[1.6] text-ink-muted">{children}</div>
    </section>
  )
}

export function PrivacyPage() {
  return (
    <SubPage>
      <article className="flex w-full max-w-[640px] flex-col gap-10 pt-12 sm:pt-20">
        <header className="flex flex-col gap-3">
          <h1 className="text-[36px] leading-[1.1] font-medium tracking-[-0.04em] sm:text-[48px]">Privacy policy</h1>
          <p className="text-[14px] text-ink-muted">Last updated {UPDATED}</p>
        </header>

        <Section title="Your images never leave your device">
          <p>
            WebP Converter converts images entirely inside your browser. The images you choose are never uploaded,
            sent to a server or stored by us. When you close or reload the page, they're gone.
          </p>
        </Section>

        <Section title="What we collect">
          <p>
            Nothing about you. The site doesn't use cookies, doesn't ask you to sign up, and doesn't run any analytics
            or advertising. Fonts and code are served from this site itself, so no other company sees your visit
            through them.
          </p>
        </Section>

        <Section title="Hosting">
          <p>
            The site is hosted by Netlify. Like any web host, Netlify's servers handle the technical details of each
            request, such as your IP address and browser type, to deliver the page and keep it secure. See{' '}
            <a
              href="https://www.netlify.com/privacy/"
              className="text-ink underline decoration-hairline underline-offset-4 transition-colors duration-150 hover:decoration-ink"
            >
              Netlify's privacy policy
            </a>{' '}
            for how they handle that data.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If this changes, for example if we add privacy-friendly analytics, we'll update this page and the date at
            the top before it takes effect.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            The site's code is public on{' '}
            <a
              href="https://github.com/Okus94/Freewebp"
              className="text-ink underline decoration-hairline underline-offset-4 transition-colors duration-150 hover:decoration-ink"
            >
              GitHub
            </a>
            , so you can check all of this yourself. You can also ask a question there by opening an issue.
          </p>
        </Section>
      </article>
    </SubPage>
  )
}
