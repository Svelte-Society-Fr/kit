---
title: Hooks
---

Les "hooks" sont des fonctions que vous déclarez dans votre application et que SvelteKit va exécuter en réponse à des évènements spécifiques, vous donnant un contrôle fin sur le comportement du <span class="vo">[framework](PUBLIC_SVELTE_SITE_URL/docs/web#framework)</span>.

Il existe deux fichiers de hooks, tous les deux optionnels :

- `src/hooks.server.js` — les hooks serveur de votre application
- `src/hooks.client.js` — les hooks client de votre application

Le code de ces modules est exécuté lorsque l'application démarre, les rendant utiles pour initialiser par exemple des clients de bases de données.

> Vous pouvez configurer l'emplacement de ces fichiers avec [`config.kit.files.hooks`](configuration#files).

## Hooks de serveur

Les hooks suivants peuvent être ajoutés au fichier `src/hooks.server.js` :

### `handle`

Cette fonction est exécutée à chaque fois que le serveur SvelteKit reçoit une [requête](web-standards#apis-fetch-request) – que cette requête ait lieu pendant que l'application est en service ou pendant le processus de [prérendu](page-options#prerender) – et en détermine la [réponse](web-standards#apis-fetch-response). La fonction reçoit un objet `event` représentant la requête et une fonction appelée `resolve`, qui rend la route et génère une `Response`. Cela vous permet de modifier les <span class="vo">[headers](PUBLIC_SVELTE_SITE_URL/docs/web#header)</span> ou les <span class="vo">[bodys](PUBLIC_SVELTE_SITE_URL/docs/web#body)</span> de réponse, ou de complètement contourner SvelteKit (pour implémenter des routes programmatiquement par exemple).

```js
/// file: src/hooks.server.js
/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	if (event.url.pathname.startsWith('/custom')) {
		return new Response('réponse personnalisée');
	}

	const response = await resolve(event);
	return response;
}
```

> Les requêtes vers des fichiers statiques – incluant les pages qui ont été prérendues – ne sont _pas_ gérées par SvelteKit.

Si non implémentée, cette fonction sera considérée par défaut comme étant `({ event, resolve }) => resolve(event)`. Pour ajouter de la donnée personnalisée à la requête, qui est fournie aux fonctions de `+server.js` et aux fonctions `load` de serveur, utilisez l'objet `event.locals`, comme montré ci-dessous.

```js
/// file: src/hooks.server.js
// @filename: ambient.d.ts
type User = {
	name: string;
}

declare namespace App {
	interface Locals {
		user: User;
	}
}

const getUserInformation: (cookie: string | void) => Promise<User>;

// @filename: index.js
// ---cut---
/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	event.locals.user = await getUserInformation(event.cookies.get('sessionid'));

	const response = await resolve(event);
	response.headers.set('x-custom-header', 'patate');

	return response;
}
```

Vous pouvez définir plusieurs fonctions `handle` et les exécuter avec [la fonction utilitaire `sequence`](modules#sveltejs-kit-hooks).

`resolve` supporte aussi un deuxième paramètre optionnel qui vous donne plus de contrôle sur la façon dont la réponse est générée. Ce paramètre est un objet qui peut avoir les champs suivants :

- `transformPageChunk(opts: { html: string, done: boolean }): MaybePromise<string | undefined>` – applique des transformations personnalisées au HTML. Si `done` vaut `true`, il s'agit du dernier morceau (_chunk_) de HTML. Les morceaux ne sont pas forcément du HTML bien formé (ils peuvent inclure la balise ouvrante d'un élément mais pas la balise fermante, par exemple), mais ils seront toujours découpés en fonctions de frontières sensibles, comme `%sveltekit.head%` ou les composants de page ou de <span class="vo">[layout](PUBLIC_SVELTE_SITE_URL/docs/web#layout)</span>.
- `filterSerializedResponseHeaders(name: string, value: string): boolean` – détermine quels <span class="vo">[headers](PUBLIC_SVELTE_SITE_URL/docs/web#header)</span> doivent être inclus dans les réponses sérialisées lorsqu'une fonction `load` charge une ressource avec `fetch`. Par défaut, aucun ne sera inclus.
- `preload(input: { type: 'js' | 'css' | 'font' | 'asset', path: string }): boolean` – détermine quels fichiers doivent être ajoutés à la balise `<head>` pour la précharger. Cette méthode est appelée avec chacun des fichiers trouvés au moment de la compilation lorsque les morceaux de HTML sont construits – donc si vous avez par exemple `import './styles.css'` dans votre fichier `+page.svelte`, `preload` sera appelée avec le chemin résolu vers ce fichier CSS lorsque la page sera demandée. Notez qu'en mode développement, `preload` n'est _pas_ exécutée, puisqu'elle dépend d'une analyse qui se produit à la compilation. Le préchargement peut améliorer vos performances en téléchargeant vos fichiers statiques plus tôt, mais peut aussi ralentir votre application si trop de fichiers sont téléchargés inutilement. Par défaut, les fichiers `js` et `css` seront préchargés. Les fichiers `asset` ne sont pas préchargés du tout actuellement, mais pourront l'être plus tard après analyse des retours d'expérience.

```js
/// file: src/hooks.server.js
/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('old', 'new'),
		filterSerializedResponseHeaders: (name) => name.startsWith('x-'),
		preload: ({ type, path }) => type === 'js' || path.includes('/important/')
	});

	return response;
}
```

Notez que `resolve(...)` ne déclenchera jamais d'erreur, elle renverra toujours une `Promise<Response>` avec le code de statut approprié. Si une erreur est déclenchée ailleurs pendant l'exécution de `handle`, elle sera traitée comme étant fatale, et SvelteKit y répondra avec une représentation <span class="vo">[JSON](PUBLIC_SVELTE_SITE_URL/docs/web#json)</span> de l'erreur ou avec la page d'erreur par défaut – que vous pouvez personnaliser via `src/error.html` – en fonction du <span class="vo">[header](PUBLIC_SVELTE_SITE_URL/docs/web#header)</span> `Accept`. Vous pouvez en savoir plus sur la gestion des erreurs dans [ce chapitre](errors).

### `handleFetch`

Cette fonction vous permet de modifier (ou remplacer) une requête `fetch` qui se produit dans une fonction `load` ou `action` exécutée sur le serveur (ou pendant le prérendu).

Par exemple, votre fonction `load` pourrait faire une requête vers une URL publique comme `https://api.yourapp.com` lorsque votre utilisateur ou utilisatrice navigue côté client vers une page, mais lors du rendu côté serveur, cela peut être pertinent de requêter l'<span class="vo">[API](PUBLIC_SVELTE_SITE_URL/docs/development#api)</span> directement (en évitant tout <span class="vo">[proxy](PUBLIC_SVELTE_SITE_URL/docs/web#proxy)</span> ou <span class="vo">[load balancer](PUBLIC_SVELTE_SITE_URL/docs/web#load-balancer)</span> qui se trouverait entre l'API et l'internet public).

```js
/// file: src/hooks.server.js
/** @type {import('@sveltejs/kit').HandleFetch} */
export async function handleFetch({ request, fetch }) {
	if (request.url.startsWith('https://api.yourapp.com/')) {
		// clone la requête originale, mais en change l'URL
		request = new Request(
			request.url.replace('https://api.yourapp.com/', 'http://localhost:9999/'),
			request
		);
	}

	return fetch(request);
}
```

**Identifiants**

Pour les requêtes de même origine, l'implémentation de `fetch` de SvelteKit va relayer les <span class="vo">[headers](PUBLIC_SVELTE_SITE_URL/docs/web#header)</span> `cookie` et `authorization` à moins que l'option `credentials` soit définie à `"omit"`.

Pour les requêtes d'origine différentes, le <span class="vo">[header](PUBLIC_SVELTE_SITE_URL/docs/web#header)</span>`cookie` sera inclus si l'URL de requête appartient à un sous-domaine de l'application – par exemple si votre application est sur le domaine `mon-domaine.com`, et que votre <span class="vo">[API](PUBLIC_SVELTE_SITE_URL/docs/development#api)</span> est sur le domaine `api.mon-domaine.com`, les cookies sont inclus dans la requête.

Si votre application et votre <span class="vo">[API](PUBLIC_SVELTE_SITE_URL/docs/development#api)</span> sont sur des domaines frères – `www.mon-domaine.com` et `api.mon-domaine.com` par exemple – alors un cookie appartenant à un domain parent commun comme `mon-domaine.com` ne seront _pas_ inclus, car SvelteKit n'a aucun moyen de savoir à quel domaine appartient le cookie. Dans ces cas-là, vous aurez besoin d'inclure le cookie manuellement en utilisant `handleFetch` :

```js
/// file: src/hooks.server.js
// @errors: 2345
/** @type {import('@sveltejs/kit').HandleFetch} */
export async function handleFetch({ event, request, fetch }) {
	if (request.url.startsWith('https://api.mon-domaine.com/')) {
		request.headers.set('cookie', event.request.headers.get('cookie'));
	}

	return fetch(request);
}
```

## Hooks partagés

Les fonctions suivantes peuvent être ajoutées aux fichiers `src/hooks.server.js` _et_ `src/hooks.client.js` :

### `handleError`

Si une erreur inattendue se produit pendant le chargement ou le rendu, cette fonction sera exécutée avec `error` et `event` en argument. Cela permet deux choses :

- vous pouvez afficher l'erreur
- vous pouvez générer une représentation de l'erreur que vous affichez aux utilisateurs et utilisatrices, en y enlevant les informations sensibles comme les messages ou les <span class="vo">[stack traces](PUBLIC_SVELTE_SITE_URL/docs/development#stack-trace)</span>. La valeur renvoyée devient la valeur de `$page.error`. Elle vaut par défaut `{ message: 'Not Found' }` dans le cas d'une erreur 404 (vous pouvez les détecter grâce à `event.route.id` qui vaudra `null`) et `{ message: 'Internal Error' }` pour tout le reste. Pour y ajouter du typage, vous pouvez personnaliser la forme de l'objet en déclarant l'interface `App.Error` (qui doit inclure `message: string`, pour garantir le comportement par défaut).

Le code suivant montre un exemple de typage d'erreur utilisant la forme `{ message: string; errorId: string }`, et montrant comment la renvoyer depuis les fonctions `handleError` :

```ts
/// file: src/app.d.ts
declare global {
	namespace App {
		interface Error {
			message: string;
			errorId: string;
		}
	}
}

export {};
```

```js
/// file: src/hooks.server.js
// @errors: 2322
// @filename: ambient.d.ts
declare module '@sentry/node' {
	export const init: (opts: any) => void;
	export const captureException: (error: any, opts: any) => void;
}

// @filename: index.js
// ---cut---
import * as Sentry from '@sentry/node';
import crypto from 'crypto';

Sentry.init({/*...*/})

/** @type {import('@sveltejs/kit').HandleServerError} */
export async function handleError({ error, event }) {
	const errorId = crypto.randomUUID();
	// exemple d'intégration utilisant https://sentry.io/
	Sentry.captureException(error, { extra: { event, errorId } });

	return {
		message: 'Oups !',
		errorId
	};
}
```

```js
/// file: src/hooks.client.js
// @errors: 2322
// @filename: ambient.d.ts
declare module '@sentry/svelte' {
	export const init: (opts: any) => void;
	export const captureException: (error: any, opts: any) => void;
}

// @filename: index.js
// ---cut---
import * as Sentry from '@sentry/svelte';

Sentry.init({/*...*/})

/** @type {import('@sveltejs/kit').HandleClientError} */
export async function handleError({ error, event }) {
	const errorId = crypto.randomUUID();
	// exemple d'intégration utilisant https://sentry.io/
	Sentry.captureException(error, { extra: { event, errorId } });

	return {
		message: 'Oups !',
		errorId
	};
}
```

> Dans le fichier `src/hooks.client.js`, le type de `handleError` est `HandleClientError` plutôt que `HandleServerError`, et `event` est un `NavigationEvent` plutôt qu'un `RequestEvent`.

Cette fonction n'est pas appelée pour les erreurs _attendues_ (celles déclenchées avec la fonction [`error`](modules#sveltejs-kit-error) importée depuis `@sveltejs/kit`).

Pendant le dévelopement, si une erreur se produit parce qu'une erreur de syntaxe est présente dans votre code Svelte, l'erreur fournie aura une propriété supplémentaire `frame` mettant en lumière la position de l'erreur.

> Assurez-vous que `handleError` ne déclenche _jamais_ d'erreur.

## Sur le même sujet

- [Tutoriel: Hooks](PUBLIC_LEARN_SITE_URL/tutorial/handle)
