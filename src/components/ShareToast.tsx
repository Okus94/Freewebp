import { Check, Link2, X } from 'lucide-react'
import { toast } from 'sonner'

const TOAST_ID = 'share'
const PRESS = 'transition-[transform,background-color,color] duration-150 ease-fluid motion-safe:active:scale-[0.96]'

function GlassToast({
  title,
  description,
  onCopy,
  copied,
}: {
  title: string
  description: string
  onCopy?: () => void
  copied?: boolean
}) {
  return (
    <div className="glass-toast flex w-[min(380px,calc(100vw-32px))] items-start gap-3 rounded-2xl p-4 text-left font-sans text-ink">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-wash text-rose">
        <Check className="size-4" strokeWidth={2.25} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-[1.35] font-semibold tracking-[-0.01em]">{title}</p>
        <p className="mt-0.5 text-[13px] leading-[1.45] text-ink-muted">{description}</p>
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            className={`glass-button mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] leading-[1.3] font-medium text-white ${PRESS}`}
          >
            <Link2 className="size-3.5" aria-hidden />
            Copy link
          </button>
        )}
        {copied && <p className="mt-2 text-[13px] leading-[1.3] font-medium text-rose">Link copied</p>}
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(TOAST_ID)}
        className={`-mt-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-field hover:text-ink ${PRESS}`}
        aria-label="Dismiss"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}

const TITLE = 'All done — your images are saved'

async function copyLink() {
  const link = window.location.origin
  try {
    await navigator.clipboard.writeText(link)
    toast.custom(() => <GlassToast title={TITLE} description="Thanks for sharing it." copied />, {
      id: TOAST_ID,
      duration: 2500,
    })
  } catch {
    // Clipboard can be blocked (permissions, older browsers): show the link so it can be copied by hand.
    toast.custom(() => <GlassToast title={TITLE} description={`Couldn’t copy automatically — the link is ${link}`} />, {
      id: TOAST_ID,
      duration: 8000,
    })
  }
}

/**
 * A friendly nudge after a download, built headless on Sonner (its positioning, stacking and swipe, our
 * glass styling). Shown once per visit: a toast that repeats on every download would become noise.
 */
export function showShareToast() {
  toast.custom(
    () => (
      <GlassToast title={TITLE} description="Know someone who’d find this handy? Share the link." onCopy={copyLink} />
    ),
    { id: TOAST_ID, duration: 9000 },
  )
}
