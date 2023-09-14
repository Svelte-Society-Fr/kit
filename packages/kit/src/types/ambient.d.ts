/**
 * It's possible to tell SvelteKit how to type objects inside your app by declaring the `App` namespace. By default, a new project will have a file called `src/app.d.ts` containing the following:
 *
 * ```ts
 * declare global {
 * 	namespace App {
 * 		// interface Error {}
 * 		// interface Locals {}
 * 		// interface PageData {}
 * 		// interface Platform {}
 * 	}
 * }
 *
 * export {};
 * ```
 *
 * The `export {}` line exists because without it, the file would be treated as an _ambient module_ which prevents you from adding `import` declarations.
 * If you need to add ambient `declare module` declarations, do so in a separate file like `src/ambient.d.ts`.
 *
 * By populating these interfaces, you will gain type safety when using `event.locals`, `event.platform`, and `data` from `load` functions.
 */
declare namespace App {
	/**
	 * Définit la forme commune des erreurs attendues et inattendues. Les erreurs attendues sont levées en utilisant la fonction `error`. Les erreurs inattendues sont gérées par le [hook](https://kit.sveltefr.dev/docs/hooks) `handleError` qui doit renvoyer cette forme.
	 */
	export interface Error {
		message: string;
	}

	/**
	 * L'interface qui définit `event.locals`, qui est accessible dans les [hooks](https://kit.sveltefr.dev/docs/hooks) (`handle`, et `handleError`), les fonctions `load` de serveur, et les fichiers `+server.js`.
	 */
	export interface Locals {}

	/**
	 *
	 * Définit la forme commune du [store $page.data](/docs/modules#$app-stores-page) - c'est-à-dire les données qui sont partagées entre toutes les pages.
	 * Les types des fonctions `Load` et `ServerLoad` dans `./$types` seront affinés en fonction.
	 * Utilisez des propriétés optionnelles pour des données uniquement présentes dans certaines pages. N'ajoutez pas de signature d'indice (`[key: string]: any`).
	 */
	export interface PageData {}

	/**
	 * Si votre adaptateur fournit un [contexte spécifique à sa plateforme](/docs/adapters#contexte-sp-cifique-chaque-plateforme) via `event.platform`, vous pouvez le spécifier ici.
	 */
	export interface Platform {}
}

/**
 * Ce module est uniquement disponible dans les [service workers](https://kit.sveltefr.dev/docs/service-workers)
 */
declare module '$service-worker' {
	/**
	 * Le chemin de `base` de déploiement. Ceci est équivalent à `config.kit.paths.base`, mais est calculé en utilisant `location.pathname`, ce qui implique que cela continuera à fonctionner correctement si le site est déployé dans un sous-dossier.
	 * Notez qu'il y a une `base` mais pas d'`assets`, puisque les <span class='vo'>[service workers](https://sveltefr.dev/docs/web#service-worker)</span> ne peuvent pas être utilisés si `config.kit.paths.assets` est précisé.
	 */
	export const base: string;
	/**
	 * Un tableau d'URLs représentant les fichiers générés par Vite, pouvant être mises en cache avec `cache.addAll(build)`.
	 * Pendant le développement, ceci est un tableau vide.
	 */
	export const build: string[];
	/**
	 * Un tableau d'URLs représentant les fichiers dans votre dossier `static`, ou celui précisé par `config.kit.files.assets`. Vous pouvez personnaliser les fichiers qui sont inclus dans le dossier `static` en utilisant [`config.kit.serviceWorker.files`](https://kit.sveltefr.dev/docs/configuration).
	 */
	export const files: string[];
	/**
	 * Un tableau de chemins correspondant aux pages et <span class='vo'>[endpoints](https://sveltefr.dev/docs/web#endpoints)</span> prérendus.
	 * Pendant le développement, ceci est un tableau vide.
	 */
	export const prerendered: string[];
	/**
	 * Voir [`config.kit.version`](https://kit.sveltefr.dev/docs/configuration#version). Ceci est utile pour générer des noms de cache uniques dans votre <span class='vo'>[service worker](https://sveltefr.dev/docs/web#service-worker)</span>, afin qu'un déploiement ultérieur de votre application puisse invalider les anciens caches.
	 */
	export const version: string;
}

/** Internal version of $app/environment */
declare module '__sveltekit/environment' {
	/**
	 * SvelteKit analyse votre application pendant l'étape de `build` en l'exécutant. Pendant ce processus, `building` vaut `true`. Ceci s'applique aussi pendant le prérendu.
	 */
	export const building: boolean;
	/**
	 * La valeur de `config.kit.version.name`.
	 */
	export const version: string;
	export function set_building(): void;
}

/** Internal version of $app/paths */
declare module '__sveltekit/paths' {
	/**
	 * Une chaîne de caractères qui correspond à [`config.kit.paths.base`](https://kit.sveltefr.dev/docs/configuration#paths)
	 *
	 * Exemple d'utilisation: `<a href="{base}/your-page">Lien</a>`
	 */
	export let base: '' | `/${string}`;
	/**
	 * Un chemin absolu qui correspond à [`config.kit.paths.assets`](https://kit.sveltefr.dev/docs/configuration#paths).
	 *
	 * > Si une valeur `config.kit.paths.assets` est précisée, elle sera remplacée par `'/_svelte_kit_assets'` pendant l'exécution de `vite dev` or `vite preview`, puisque les fichiers statiques ne sont pas encore déployés sur leur URL éventuelle.
	 */
	export let assets: '' | `https://${string}` | `http://${string}` | '/_svelte_kit_assets';
	export let relative: boolean | undefined; // TODO in 2.0, make this a `boolean` that defaults to `true`
	export function reset(): void;
	export function override(paths: { base: string; assets: string }): void;
	export function set_assets(path: string): void;
}
