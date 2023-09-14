---
title: Écrire son adaptateur
---

Si un adaptateur pour votre environnement préféré n'existe pas encore, vous pouvez en écrire un. Nous vous recommandons de vous inspirer du [code source de l'adaptateur](https://github.com/sveltejs/kit/tree/master/packages) d'une plateforme similaire à la vôtre, et de le dupliquer pour avoir un point de départ.

Les adaptateurs doivent implémenter l'<span class="vo">[API](PUBLIC_SVELTE_SITE_URL/docs/development#api)</span> suivante, qui crée un `Adapter` :

```js
// @filename: ambient.d.ts
type AdapterSpecificOptions = any;

// @filename: index.js
// ---cut---
/** @param {AdapterSpecificOptions} options */
export default function (options) {
	/** @type {import('@sveltejs/kit').Adapter} */
	const adapter = {
		name: 'adapter-package-name',
		async adapt(builder) {
			// implémentation de l'adaptateur
		}
	};

	return adapter;
}
```

Au sein de la méthode `adapt`, il y a un certain nombre de choses qu'un adaptateur doit faire :
- Vider le contenu du dossier de <span class="vo">[build](PUBLIC_SVELTE_SITE_URL/docs/development#build)</span>
- Écrire le contenu SvelteKit généré avec `builder.writeClient`, `builder.writeServer`, et `builder.writePrerendered`
- Générer le code qui :
	- importe `Server` depuis `${builder.getServerDirectory()}/index.js`
	- instancie l'application avec un manifeste généré avec `builder.generateManifest({ relativePath })`
	- écoute les requêtes vers la plateforme, les convertit en objets standards [Request](https://developer.mozilla.org/fr/docs/Web/API/Request) si nécessaire, appelle la fonction `server.respond(request, { getClientAddress })` pour générer un objet [Response](https://developer.mozilla.org/fr/docs/Web/API/Response) et répond avec cet objet
	- expose à SvelteKit toute information spécifique à la plateforme via l'option `platform` passée à `server.respond`
	- rend `fetch` utilisable sur la plateforme cible, si nécessaire. SvelteKit fournit un utilitaire `@sveltejs/kit/node/polyfills` pour les plateformes qui peuvent utiliser `undici`
- Préparer le code pour éviter d'avoir à installer les dépendances sur la plateforme cible, si nécessaire
- Place les fichiers statiques de l'utilisateur ou l'utilisatrice ainsi que les fichiers JS/CSS à l'endroit prévu par la plateforme cible

Lorsque c'est possible, nous recommandons de placer le code généré par l'adaptateur dans le dossier `build/` avec tout code généré temporairement placé dans `.svelte-kit/[adapter-name]`.
