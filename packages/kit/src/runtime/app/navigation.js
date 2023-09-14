import { client_method } from '../client/singletons.js';

/**
 * Si appelée lorsque la page est en train d'être mise à jour à la suite d'une navigation (dans `onMount` ou `afterNavigate` ou une action, par exemple), cette méthode désactive le comportement de défilement par défaut de SvelteKit.
 * Ceci n'est en général pas recommandé, puisque cela diffère des attentes des utilisateurs et utilisatrices.
 * @returns {void}
 */
export const disableScrollHandling = /* @__PURE__ */ client_method('disable_scroll_handling');

/**
 * Renvoie une `Promise` qui est résolue lorsque SvelteKit navigue (ou échoue à naviguer, auquel cas la promesse est rejetée) vers l'`url` fournie.
 * Pour les URLs externes, utilisez `window.location = url` plutôt que `goto(url)`.
 *
 * @type {(url: string | URL, opts?: { replaceState?: boolean; noScroll?: boolean; keepFocus?: boolean; invalidateAll?: boolean; state?: App.PageState }) => Promise<void>}
 * @param {string | URL} url Where to navigate to. Note that if you've set [`config.kit.paths.base`](https://kit.svelte.dev/docs/configuration#paths) and the URL is root-relative, you need to prepend the base path if you want to navigate within the app.
 * @param {Object} [opts] Options related to the navigation
 * @param {boolean} [opts.replaceState] If `true`, will replace the current `history` entry rather than creating a new one with `pushState`
 * @param {boolean} [opts.noScroll] If `true`, the browser will maintain its scroll position rather than scrolling to the top of the page after navigation
 * @param {boolean} [opts.keepFocus] If `true`, the currently focused element will retain focus after navigation. Otherwise, focus will be reset to the body
 * @param {boolean} [opts.invalidateAll] If `true`, all `load` functions of the page will be rerun. See https://kit.svelte.dev/docs/load#rerunning-load-functions for more info on invalidation.
 * @param {App.PageState} [opts.state] An optional object that will be available on the `$page.state` store
 * @returns {Promise<void>}
 */
export const goto = /* @__PURE__ */ client_method('goto');

/**
 * Déclenche l'exécution de toute fonction `load` appartenant à la page active si elle dépend de l'`url` en question, via `fetch` ou `depends`. Renvoie une `Promise` qui est résolue lorsque la page est mise à jour.
 *
 * Si l'argument est fourni en tant que `string` ou `URL`, il doit correspondre à la même URL qui a été passée à `fetch` ou `depends` (en incluant les paramètres de recherche).
 * Pour créer un identifiant personnalisé, vous devez utiliser une chaîne de caractère commençant par `[a-z]+:` (par ex. `custom:state`) – ce qui en fait une URL valide.
 *
 * Un argument de type fonction peut être utilisé pour définir un prédicat personnalisé. Il recevra l'`URL` complète et déclenchera l'exécution des fonctions `load` si `true` est renvoyée.
 * Ceci est utile si vous souhaitez invalider des données en fonction d'un motif plutôt qu'une URL précise.
 *
 * ```ts
 * // Example: Match '/path' regardless of the query parameters
 * import { invalidate } from '$app/navigation';
 *
 * invalidate((url) => url.pathname === '/path');
 * ```
 * @type {(url: string | URL | ((url: URL) => boolean)) => Promise<void>}
 * @param {string | URL | ((url: URL) => boolean)} url The invalidated URL
 * @returns {Promise<void>}
 */
export const invalidate = /* @__PURE__ */ client_method('invalidate');

/**
 * Déclenche l'exécution de toutes les fonctions `load` appartenant à la page active. Renvoie une `Promise` qui est résolue lorsque la page est mise à jour.
 * @type {() => Promise<void>}
 * @returns {Promise<void>}
 */
export const invalidateAll = /* @__PURE__ */ client_method('invalidate_all');

/**
 * Précharge programmatiquement une page donnée, ce qui permet
 *  1. de s'assurer que le code de la page est bien chargé, et
 *  2. d'appeler la fonction `load` de la page avec les options appropriées.
 *
 * Ce comportement est le même que SvelteKit déclenche lorsque l'utilisateur ou l'utilisatrice survole un élément `<a>` avec `data-sveltekit-preload-data`.
 * Si la navigation à venir cible `href`, les valeurs renvoyées par `load` seront utilisées, rendant la navigation instantanée.
 * Renvoie une `Promise` qui est résolue avec le résultat de la nouvelle exécution de la fonction `load` lorsque le préchargement est terminé.
 *
 * @type {(href: string) => Promise<Record<string, any>>}
 * @param {string} href Page to preload
 * @returns {Promise<{ type: 'loaded'; status: number; data: Record<string, any> } | { type: 'redirect'; location: string }>}
 */
export const preloadData = /* @__PURE__ */ client_method('preload_data');

/**
 * Importe programmatiquement le code des routes qui n'ont pas encore été récupérées.
 * Vous pouvez typiquement utiliser cette méthode pour accélérer les navigations à venir.
 *
 * Vous pouvez spécifier des routes correspondant à n'importe quel chemin  comme `/about` (pour correspondre à `src/routes/about/+page.svelte`) ou `/blog/*` (pour correspondre à `src/routes/blog/[slug]/+page.svelte`).
 *
 * À la différence de `preloadData`, cette fonction ne va pas appeler de fonctions `load`.
 * Renvoie une `Promise` qui est résolue lorsque les modules ont été importés.
 *
 * @type {(url: string) => Promise<void>}
 * @param {string} url
 * @returns {Promise<void>}
 */
export const preloadCode = /* @__PURE__ */ client_method('preload_code');

/**
 * Un intercepteur de navigation qui se déclenche avant toute navigation vers une nouvelle URL, que ce soit via un clic sur un lien, via `goto(...)`, ou via les bouton retour/suivant du navigateur.
 *
 * Appeler `cancel()` va empêcher la navigation de se terminer. Si `navigation.type === 'leave'`, c'est à dire lorsque l'utilisateur ou l'utilisatrice navigue à l'extérieur de l'application (ou ferme l'onglet), appeler `cancel` va déclencher la boîte de dialogue correspodante du navigateur. Dans ce cas, la navigation sera peut être annulé ou non selon la réponse de l'utilisateur.
 *
 * Lorsqu'une navigation ne va pas vers une route gérée par SvelteKit (et donc pas gérée par le router SvelteKit client), alors `navigation.willUnload` vaut `null`.
 *
 * Si la navigation cause le démontage du document, en d'autres termes les navigations pour quitter l'application SvelteKit et les navigations par lien pour lesquelles `navigation.to.route === null`, alors `navigation.willUnload` vaut `true`.
 *
 * `beforeNavigate` doit être exécutée pendant l'initialisation du composant. Elle reste active tant que le composant est monté.
 * @type {(callback: (navigation: import('@sveltejs/kit').BeforeNavigate) => void) => void}
 * @param {(navigation: import('@sveltejs/kit').BeforeNavigate) => void} callback
 * @returns {void}
 */
export const beforeNavigate = /* @__PURE__ */ client_method('before_navigate');

/**
 * Une fonction de cycle de vie qui exécute immédiatement le <span class='vo'>[`callback`](https://sveltefr.dev/docs/development#callback)</span> fourni, avant de naviguer vers la nouvelle URL à l'exception des navigations non gérées par SvelteKit.
 *
 * Si vous renvoyez une `Promise`, SvelteKit va attendre sa résolution avant de terminer la navigation. Ceci vous permet – par exemple – d'utiliser `document.startViewTransition`. Évitez les promesses trop lentes à résoudre, qui rendraient la navigation saccadée.
 *
 * Si une fonction (ou une `Promise` qui résout une fonction) est renvoyée du callback, celle-ci sera appelée une fois que le <span class='vo'>[DOM](https://sveltefr.dev/docs/web#dom)</span> aura été mis à jour.
 *
 * `onNavigate` doit être exécutée pendant l'initialisation du composant. Elle reste active tant que le composant est monté.
 * @type {(callback: (navigation: import('@sveltejs/kit').OnNavigate) => import('types').MaybePromise<(() => void) | void>) => void}
 * @param {(navigation: import('@sveltejs/kit').OnNavigate) => void} callback
 * @returns {void}
 */
export const onNavigate = /* @__PURE__ */ client_method('on_navigate');

/**
 * Une fonction de cycle de vie qui exécute le <span class='vo'>[`callback`](https://sveltefr.dev/docs/development#callback)</span> fourni lorsque le composant est monté, ainsi qu'à chaque fois que l'on navigue vers une nouvelle URL.
 *
 * `afterNavigate` doit être exécutée pendant l'initialisation du composant. Elle reste active tant que le composant est monté.
 * @type {(callback: (navigation: import('@sveltejs/kit').AfterNavigate) => void) => void}
 * @param {(navigation: import('@sveltejs/kit').AfterNavigate) => void} callback
 * @returns {void}
 */
export const afterNavigate = /* @__PURE__ */ client_method('after_navigate');

/**
 * Crée une nouvelle entrée dans l'historique avec l'état `$page.state` donné. Pour utiliser l'URL courante, vous pouvez passer `''` comme premier argument. Utilisé pour le [routage superficiel] (https://kit.sveltefr.dev/docs/shallow-routing).
 *
 * @type {(url: string | URL, state: App.PageState) => void}
 * @param {string | URL} url
 * @param {App.PageState} state
 * @returns {void}
 */
export const pushState = /* @__PURE__ */ client_method('push_state');

/**
 * Remplace l'entrée courante de l'historique avec la valeur de `$page.state` courante. Pour utiliser l'URL courante, vous pouvez passer `''` comme premier argument. Utilisé pour le [routage superficiel] (https://kit.sveltefr.dev/docs/shallow-routing).
 *
 * @type {(url: string | URL, state: App.PageState) => void}
 * @param {string | URL} url
 * @param {App.PageState} state
 * @returns {void}
 */
export const replaceState = /* @__PURE__ */ client_method('replace_state');
