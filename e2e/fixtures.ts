export const FIXTURE_DIR = new URL('../.qa/fixtures', import.meta.url).pathname

/** Every supported format the site should convert, with the size the WebP should come out at. */
export const FIXTURES = [
  { file: 'photo.jpg', output: 'photo.webp', width: 240, height: 160, transparent: false },
  { file: 'transparent.png', output: 'transparent.webp', width: 240, height: 160, transparent: true },
  { file: 'animation.gif', output: 'animation.webp', width: 240, height: 160, transparent: false },
  { file: 'photo.avif', output: 'photo.webp', width: 240, height: 160, transparent: false },
  { file: 'photo.bmp', output: 'photo.webp', width: 240, height: 160, transparent: false },
  { file: 'icon.ico', output: 'icon.webp', width: 64, height: 64, transparent: true },
  { file: 'vector.svg', output: 'vector.webp', width: 200, height: 120, transparent: true },
  { file: 'already.webp', output: 'already.webp', width: 240, height: 160, transparent: false },
]

export const fixturePath = (name: string) => `${FIXTURE_DIR}/${name}`
