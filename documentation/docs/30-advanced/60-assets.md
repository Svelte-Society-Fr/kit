---
title: Gestion des fichiers statiques
---

## Cache et <span class="vo">[inlining](PUBLIC_SVELTE_SITE_URL/docs/javascript#inline)</span>

[Vite traite automatiquement les fichiers statiques importés](https://vitejs.dev/guide/assets.html) (en anglais) pour améliorer les performances. Des <span class="vo">[hashes](PUBLIC_SVELTE_SITE_URL/docs/development#hash)</span> sont ajoutés aux noms de fichiers afin qu'ils puissent être mis en cache. Les fichiers statiques plus légers que la valeur précisée par `assetsInlineLimit` seront <span class="vo">[inlinés](PUBLIC_SVELTE_SITE_URL/docs/javascript#inline)</span>.

```html
<script>
	import logo from '$lib/assets/logo.png';
</script>

<img alt="Le logo du projet" src={logo} />
```

Si vous préférez référencer vos fichiers statiques directement dans le <span class="vo">[markup](PUBLIC_SVELTE_SITE_URL/docs/web#markup)</span>, vous pouvez utiliser un préprocesseur comme [svelte-preprocess-import-assets](https://github.com/bluwy/svelte-preprocess-import-assets).

Pour les fichiers inclus via la fonction CSS `url()`, vous pourriez avoir besoin de [`vitePreprocess`](/docs/integrations#preprocessors-vitepreprocess).

## Transformations

Vous pourriez vouloir transformer vos images pour générer des formats d'image compressés comme `.webp` ou `.avif`, des images <span class="vo">[responsives](PUBLIC_SVELTE_SITE_URL/docs/web#responsive)</span> avec différentes tailles pour différents appareils, ou des images dont les données EXIF ont été supprimées pour respecter la vie privée. Pour les images qui sont incluses de manière statique, vous pouvez utiliser un <span class="vo">[plugin](PUBLIC_SVELTE_SITE_URL/docs/development#plugin)</span> Vite comme [vite-imagetools](https://github.com/JonasKruckenberg/imagetools). Vous pouvez aussi considérer l'utilisation d'un <span class="vo">[CDN](PUBLIC_SVELTE_SITE_URL/docs/web#cdn)</span>, qui sera capable de servir l'image transformée pertinente en fonction du <span class="vo">[header](PUBLIC_SVELTE_SITE_URL/docs/web#header)</span> HTTP `Accept` ainsi que des paramètres de recherche.
