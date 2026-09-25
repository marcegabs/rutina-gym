// Lets you "Add to Home Screen" and open it full-screen like an app.
export default function manifest() {
  return {
    name: 'Rutinas GYM',
    short_name: 'Rutinas',
    description: 'Tu entreno de hoy, series, descansos y progreso.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4EFE7',
    theme_color: '#F4EFE7',
    lang: 'es',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
