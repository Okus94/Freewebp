import { describe, expect, it } from 'vitest'
import type { ConvertItem } from '../hooks/useConverter'
import { describeProgress } from './announce'

const item = (name: string, status: ConvertItem['status'], error?: string): ConvertItem => ({
  id: name,
  file: { name } as File,
  previewUrl: '',
  outputName: name,
  status,
  error,
  batchIndex: 0,
})

describe('describeProgress', () => {
  it('says nothing for an empty list', () => {
    expect(describeProgress([])).toBe('')
  })

  it('counts what is still to do while converting', () => {
    expect(describeProgress([item('a.jpg', 'done'), item('b.jpg', 'converting'), item('c.jpg', 'queued')])).toBe(
      'Converting 2 images…',
    )
    expect(describeProgress([item('a.jpg', 'converting')])).toBe('Converting 1 image…')
  })

  it('sums up the batch once everything has finished', () => {
    expect(describeProgress([item('a.jpg', 'done')])).toBe('1 of 1 image converted.')
    expect(describeProgress([item('a.jpg', 'done'), item('b.jpg', 'done')])).toBe('2 of 2 images converted.')
  })

  it('names each file that failed and why', () => {
    const items = [item('a.jpg', 'done'), item('huge.jpg', 'error', 'Larger than 10 MB'), item('notes.pdf', 'error', 'This file type isn’t supported')]
    expect(describeProgress(items)).toBe(
      '1 of 3 images converted. huge.jpg: Larger than 10 MB. notes.pdf: This file type isn’t supported.',
    )
  })

  it('never contains the visible footer text, so the two are not read twice', () => {
    expect(describeProgress([item('a.jpg', 'done'), item('b.jpg', 'done')])).not.toContain('2 of 2 converted')
  })
})
