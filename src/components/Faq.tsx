import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

const QUESTIONS = [
  {
    q: 'What image formats can I convert?',
    a: 'JPG, PNG, GIF, AVIF, BMP, SVG and ICO. Basically, if your browser can open it, you can convert it. For animated GIFs you’ll get the first frame.',
  },
  {
    q: 'Is there a file size limit?',
    a: 'Each image can be up to 10 MB, and you can do 20 at a time. That’s plenty for most photos straight off your phone.',
  },
  {
    q: 'Is my data safe? Do you store my images?',
    a: 'Your images never leave your computer or phone. Everything happens right in your browser, so nothing gets uploaded and there’s nothing for us to keep. Close the tab and they’re gone.',
  },
  {
    q: 'How much smaller will my images get?',
    a: 'It depends on the image, but usually a fair bit. Google found WebP files come out about 25 to 34% smaller than JPGs of the same quality, and PNGs often shrink even more. You’ll see the before and after size for every file.',
  },
  {
    q: 'Does WebP keep transparency?',
    a: 'Yes. If part of your PNG, GIF, SVG or ICO is transparent, it stays transparent in the WebP.',
  },
  {
    q: 'Can I convert multiple images at once?',
    a: 'Yes. Drop in up to 20 images together, then download them one at a time or grab them all in a single ZIP.',
  },
  {
    q: 'Which browsers support WebP?',
    a: 'Every current version of Chrome, Safari, Firefox and Edge, on desktop and mobile. So you can use WebP on your website without worrying about who can see it.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes, completely. No account, no watermarks and no catch. The only limits are the ones above.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="border-b border-hairline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="group flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[17px] leading-[1.4] font-medium tracking-[-0.17px]">{q}</span>
        <ChevronDown
          className={`size-[18px] shrink-0 text-ink-muted transition-[rotate,color] duration-300 ease-fluid group-hover:text-ink ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {/* Height opens via a 0fr→1fr grid track (no measuring); the text fades up slightly after it. */}
      <div
        id={panelId}
        inert={!open}
        className={`grid transition-[grid-template-rows] ease-fluid ${open ? 'grid-rows-[1fr] duration-300' : 'grid-rows-[0fr] duration-200'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <p
            className={`max-w-xl pb-5 text-[15px] leading-[1.6] text-ink-muted transition-[opacity,translate] ease-fluid ${
              open ? 'opacity-100 delay-50 duration-300' : 'opacity-0 duration-150 motion-safe:-translate-y-1'
            }`}
          >
            {a}
          </p>
        </div>
      </div>
    </div>
  )
}

export function Faq() {
  return (
    <section className="flex w-full flex-col items-center gap-7 border-t border-hairline pt-12 pb-24 sm:pt-16">
      <h2 className="text-center text-[28px] leading-[1.15] font-semibold tracking-[-0.96px] sm:text-[32px]">
        Frequently asked questions
      </h2>
      <div className="flex w-full flex-col border-t border-hairline">
        {QUESTIONS.map(({ q, a }) => (
          <FaqItem key={q} q={q} a={a} />
        ))}
      </div>
    </section>
  )
}
