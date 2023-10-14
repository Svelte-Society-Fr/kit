---
title: Vercel
---

Pour déployer sur [Vercel](https://vercel.com/home), utilisez [`adapter-vercel`](https://github.com/sveltejs/kit/tree/master/packages/adapter-vercel).

Cet adaptateur sera installé par défaut lorsque vous utilisez [`adapter-auto`](adapter-auto), mais l'ajouter à votre projet vous permet de spécifier des options spécifiques à Vercel.

## Usage

Installez l'adaptateur avec `npm i -D @sveltejs/adapter-vercel`, puis ajoutez-le à votre fichier `svelte.config.js` :

```js
// @errors: 2307 2345
/// file: svelte.config.js
import adapter from '@sveltejs/adapter-vercel';

export default {
	kit: {
		adapter: adapter({
			// voir la section "Configuration de déploiement" plus bas
		})
	}
};
```

## Configuration de déploiement

Pour contrôler comment vos routes sont déployées en tant que fonctions Vercel, vous pouvez préciser une configuration de déploiement, soit au travers de l'option indiquée plus haut, ou bien avec [`export const config`](page-options#config) dans vos fichiers `+server.js`, `+page(.server).js` and `+layout(.server).js`.

Vous pouvez par exemple déployer des morceaux de votre application en tant que [Edge Functions](https://vercel.com/docs/concepts/functions/edge-functions)...

```js
/// file: about/+page.js
/** @type {import('@sveltejs/adapter-vercel').Config} */
export const config = {
	runtime: 'edge'
};
```

...et d'autres en tant que [Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions) (notez qu'en précisant `config` dans un <span class="vo">[layout](PUBLIC_SVELTE_SITE_URL/docs/web#layout)</span>, l'option s'applique à toutes les pages enfant) :

```js
/// file: admin/+layout.js
/** @type {import('@sveltejs/adapter-vercel').Config} */
export const config = {
	runtime: 'nodejs18.x'
};
```

Les options suivantes sont valables pour toutes les fonctions :
- `runtime`: `'edge'`, `'nodejs16.x'` ou `'nodejs18.x'`. Par défaut, l'adaptateur va choisir `'nodejs16.x'` ou `'nodejs18.x'`, en fonction de la version Node que vous avez choisi d'utiliser pour ce projet dans votre espace Vercel
- `regions`: un tableau de [régions du réseau edge](https://vercel.com/docs/concepts/edge-network/regions) (vaut par défaut `["iad1"]` pour les fonctions <span class="vo">[serverless](PUBLIC_SVELTE_SITE_URL/docs/web#serverless)</span>) ou `'all'` si `runtime` vaut `edge` (le défaut). Notez que vous pouvez définir plusieurs régions pour les fonctions serverless uniquement avec les comptes Enterprise
- `split`: si `true`, la route sera alors déployée en tant que fonction individuelle. Si `split` vaut `true` au niveau de l'adaptateur, toutes les routes seront déployées en tant que fonctions individuelles

De plus, l'option suivante s'applique aux fonctions <span class="vo">[edge](PUBLIC_SVELTE_SITE_URL/docs/web#edge)</span> :
- `external`: un tableau de dépendances que esbuild doit traiter comme extérieures lorsque vous compilez des fonctions. Vous ne devriez utiliser cette option que pour exclure des dépendances optionnelles qui ne s'exécutent pas en dehors de Node

Enfin les options suivantes s'appliquent aux fonctions <span class="vo">[serverless](PUBLIC_SVELTE_SITE_URL/docs/web#serverless)</span> :
- `memory`: la quantité de mémoire disponible pour la fonction. Vaut par défaut `1024` Mb, et peut être réduite à `128` Mb ou [augmentée](https://vercel.com/docs/concepts/limits/overview#serverless-function-memory) par tranche de 64Mb jusqu'à `3008` Mb pour les comptes Pro ou Enterprise
- `maxDuration`: durée maximum d'exécution de la fonction. Vaut par défaut `10` secondes pour les comptes Hobby, `60` pour les comptes Pro et `900` pour les comptes Enterprise
- `isr`: la configuration de l'<span class="vo">[ISR](PUBLIC_SVELTE_SITE_URL/docs/web#isr)</span>, décrite plus bas

Si vos fonctions ont besoin d'avoir accès à des données dans une région spécifique, il est recommandé qu'elles soient déployées dans la même région (ou proche de celle-ci) pour optimiser la performance.

## Incremental Static Regeneration

Vercel supporte [Incremental Static Regeneration](https://vercel.com/docs/concepts/incremental-static-regeneration/overview) (<span class="vo">[ISR](PUBLIC_SVELTE_SITE_URL/docs/web#isr)</span>), qui fournit les performances et les avantages de coût d'un contenu prérendu avec la flexibilité d'un contenu rendu dynamiquement.

Pour ajouter l'<span class="vo">[ISR](PUBLIC_SVELTE_SITE_URL/docs/web#isr)</span> à une route, ajoutez la propriété `isr` à votre objet `config` :

```js
/// file: blog/[slug]/+page.server.js
// @filename: ambient.d.ts
declare module '$env/static/private' {
	export const BYPASS_TOKEN: string;
}

// @filename: index.js
// ---cut---
import { BYPASS_TOKEN } from '$env/static/private';

export const config = {
	isr: {
		// Temps d'expiration (en secondes) avant que les fichiers statiques en cache soient regénérés en invoquant la Serverless Function
		// Définir cette valeur à `false` signifie qu'il n'y a pas de limite d'expiration.
		expiration: 60,

		// Jeton aléatoire qui peut être fourni dans l'URL pour contourner la version en cache du fichier, en le requêtant
		// avec un cookie __prerender_bypass=<token>.
		//
		// Faire une requête `GET` ou `HEAD` avec `x-prerender-revalidate: <token>` va forcer la revalidation du fichier.
		bypassToken: BYPASS_TOKEN,

		// Liste de tous les paramètres de recherche valides. Les autres paramètres (comme les codes de tracking utm) seront ignorés,
		// permettant de s'assurer qu'ils ne provoquent un rendu non nécessaire d'un contenu
		allowQuery: ['search']
	}
};
```

La propriété `expiration` est requise ; toutes les autres sont optionnelles.

## Variables d'environnement

Vercel met à disposition un ensemble de [variables d'environnement dédiée au déploiement](https://vercel.com/docs/concepts/projects/environment-variables#system-environment-variables). Comme toutes les variables d'environnement, celles-ci sont accessibles depuis `$env/static/private` et `$env/dynamic/private` (parfois – nous en reparlerons), et inaccessibles pour leurs équivalents publics. Pour lire une de ces variables depuis le client :

```js
// @errors: 2305
/// file: +layout.server.js
import { VERCEL_COMMIT_REF } from '$env/static/private';

/** @type {import('./$types').LayoutServerLoad} */
export function load() {
	return {
		deploymentGitBranch: VERCEL_COMMIT_REF
	};
}
```

```svelte
<!--- file: +layout.svelte --->
<script>
	/** @type {import('./$types').LayoutServerData} */
	export let data;
</script>

<p>Cet environnement de démo à été déployé depuis la branche {data.deploymentGitBranch}.</p>
```

Puisque toutes ces variables sont inchangées entre le moment de compilation et l'exécution sur Vercel, nous recommandons d'utiliser `$env/static/private` – qui va remplacer les variables de manière statique, permettant des optimisations comme la suppression de code mort – plutôt que d'utiliser `$env/dynamic/private`.

## Notes

### Fonctions Vercel

Si vous avez des fonctions Vercel dans le dossier `api` de la racine de votre projet, toute requête vers `/api/*` ne sera _pas_ gérée par SvelteKit. Vous devriez plutôt implémenter ces fonctions en tant que [routes d'API](routing#server) dans votre application SvelteKit, à moins d'avoir besoin d'utiliser un langage autre que JavaScript, auquel cas vous devrez vous assurer de n'avoir aucune route `/api/*` dans votre application SvelteKit.

### Version de Node

Les projets créés avant une certaine date utiliseront par défaut Node 14, alors que SvelteKit nécessite Node 16 ou plus récent. Vous pouvez [changer la version de Node dans les paramètres de votre projet](https://vercel.com/docs/concepts/functions/serverless-functions/runtimes/node-js#node.js-version).

## Résolution de problèmes

### Accès au système de fichiers

Vous ne pouvez pas accéder au système de fichiers avec les méthodes type `fs.readFileSync` dans les environnement <span class="vo">[Serverless](PUBLIC_SVELTE_SITE_URL/docs/web#serverless)</span>/<span class="vo">[Edge](PUBLIC_SVELTE_SITE_URL/docs/web#edge)</span>. Si vous avez besoin d'accéder à des fichiers de cette manière là, faites-le pendant la compilation de votre application grâce au [prérendu](page-options#prerender). Si vous avez un blog par exemple, et ne voulez pas gérer votre contenu via un <span class="vo">[CMS](PUBLIC_SVELTE_SITE_URL/docs/web#cms)</span>, vous pouvez alors prérendre le contenu (ou prérendre le <span class="vo">[endpoint](PUBLIC_SVELTE_SITE_URL/docs/web#endpoint)</span> à partir duquel vous récupérez le contenu) et redéployer votre blog à chaque fois que vous ajoutez du nouveau contenu.

