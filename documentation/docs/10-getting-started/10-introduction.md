---
title: Introduction
---

## Avant de commencer

> Si vous débutez avec Svelte ou SvelteKit, nous vous recommandons de jeter un œil au [tutoriel interactif](LEARN_SITE_URL).
>
> Si vous êtes bloqué•e, n'hésitez pas à demander de l'aide sur le forum du [Discord francophone](SVELTE_SITE_URL/chat), ou bien du [Discord officiel](https://svelte.dev/chat).

## C'est quoi SvelteKit ?

SvelteKit est un <span class="vo">[framework](SVELTE_SITE_URL/docs/web#framework)</span> permettant de développer des applications web robustes et performantes avec [Svelte](SVELTE_SITE_URL). Si vous êtes habitué•e à React, SvelteKit est comparable à Next. Si vous êtes habitué•e à Vue, SvelteKit est comparable à Nuxt.

Pour en apprendre plus sur les types d'application que vous pouvez construire avec SvelteKit, rendez-vous sur la [FàQ](/docs/faq#what-can-i-make-with-sveltekit)

## C'est quoi Svelte ?

Pour faire court, Svelte est un moyen d'écrire des composants d'interface visuelle — comme une barre de navigation, une section de commentaires, ou un formulaire de contact — que les utilisateurs et utilisatrices voient et utilisent dans leurs navigateurs. Le compilateur Svelte convertit vos composants en du code JavaScript qui peut être exécuté pour afficher le HTML des pages, ainsi qu'en CSS qui applique le style des pages. Vous n'avez pas besoin de connaître Svelte pour comprendre le reste de ce guide, mais cela peut définitivement aider. Si vous souhaitez en savoir plus, n'hésitez pas à aller faire le [tutoriel dédié à Svelte](SVELTE_SITE_URL/tutorial)

## SvelteKit vs Svelte

Svelte affiche des composants visuels. Vous pouvez composer ces composants et construire des pages entières juste avec Svelte, mais vous aurez besoin d'autres outils que Svelte pour construire une application complète.

SvelteKit fournit des fonctionnalités de base comme un [routeur](glossary#routing) — qui met à jour l'interface lorsqu'un lien est cliqué — et du [rendu côté serveur (SSR)](glossary#ssr). Mais au-delà de ces fonctionnalités, construire une application avec tous les outils et bonnes pratiques modernes est affreusement compliqué. Par exemple, l'[optimisation des builds](https://vitejs.dev/guide/features.html#build-optimizations), afin de ne charger que la quantité de code strictement nécessaire ; le [support hors-ligne](service-workers) ; le [pré-chargement](link-options#data-sveltekit-preload-data) des pages avant que la navigation ne soit initiée ; la [configuration de rendu](page-options) qui vous permet de construire différents morceaux de votre application sur le serveur avec du [SSR](glossary#ssr), dans le navigateur avec du [rendu côté client](glossary#csr), ou au moment de la compilation avec du [pré-rendu](glossary#prerendering) ; et bien d'autres choses. SvelteKit s'occupe de toutes ces choses pénibles afin que vous vous concentriez sur les parties plus créatives.

SvelteKit reflète les changements de votre code instantanément dans le navigateur pour vous offrir une expérience de développement riche et efficace en utilisant [Vite](https://vitejs.dev/) au travers d'un [plugin Svelte](https://github.com/sveltejs/vite-plugin-svelte), permettant ainsi le [Hot Module Replacement (HMR)](https://github.com/sveltejs/vite-plugin-svelte/blob/main/docs/config.md#hot).
