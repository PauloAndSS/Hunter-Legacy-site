// Resolve arquivos de `public/` respeitando a base do site (ex.: GitHub Pages em subpasta).
export const asset = (path) => import.meta.env.BASE_URL + path;
