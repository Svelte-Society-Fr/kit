import 'svelte'; // pick up `declare module "*.svelte"`
import 'vite/client'; // pick up `declare module "*.jpg"`, etc.
import '../types/ambient.js';

import type { PluginOptions } from '@sveltejs/vite-plugin-svelte';
import { CompileOptions } from 'svelte/types/compiler/interfaces';
import { BuildData, SSRNodeLoader, SSRRoute, ValidatedConfig } from 'types';
import { ActionFailure } from '../runtime/control.js';
import {
	AdapterEntry,
	CspDirectives,
	HttpMethod,
	Logger,
	MaybePromise,
	PrerenderEntryGeneratorMismatchHandlerValue,
	PrerenderHttpErrorHandlerValue,
	PrerenderMissingIdHandlerValue,
	PrerenderOption,
	Prerendered,
	RequestOptions,
	RouteSegment
} from '../types/private.js';

export { PrerenderOption } from '../types/private.js';
export { ActionFailure };

/**
 * [Adapters](https://kit.svelte.dev/docs/adapters) are responsible for taking the production build and turning it into something that can be deployed to a platform of your choosing.
 */
export interface Adapter {
	/**
	 * The name of the adapter, using for logging. Will typically correspond to the package name.
	 */
	name: string;
	/**
	 * This function is called after SvelteKit has built your app.
	 * @param builder An object provided by SvelteKit that contains methods for adapting the app
	 */
	adapt(builder: Builder): MaybePromise<void>;
}

type AwaitedPropertiesUnion<input extends Record<string, any> | void> = input extends void
	? undefined // needs to be undefined, because void will break intellisense
	: input extends Record<string, any>
	? {
			[key in keyof input]: Awaited<input[key]>;
	  }
	: {} extends input // handles the any case
	? input
	: unknown;

export type AwaitedProperties<input extends Record<string, any> | void> =
	AwaitedPropertiesUnion<input> extends Record<string, any>
		? OptionalUnion<AwaitedPropertiesUnion<input>>
		: AwaitedPropertiesUnion<input>;

export type AwaitedActions<T extends Record<string, (...args: any) => any>> = OptionalUnion<
	{
		[Key in keyof T]: UnpackValidationError<Awaited<ReturnType<T[Key]>>>;
	}[keyof T]
>;

// Takes a union type and returns a union type where each type also has all properties
// of all possible types (typed as undefined), making accessing them more ergonomic
type OptionalUnion<
	U extends Record<string, any>, // not unknown, else interfaces don't satisfy this constraint
	A extends keyof U = U extends U ? keyof U : never
> = U extends unknown ? { [P in Exclude<A, keyof U>]?: never } & U : never;

type UnpackValidationError<T> = T extends ActionFailure<infer X>
	? X
	: T extends void
	? undefined // needs to be undefined, because void will corrupt union type
	: T;

/**
 * This object is passed to the `adapt` function of adapters.
 * It contains various methods and properties that are useful for adapting the app.
 */
export interface Builder {
	/** Print messages to the console. `log.info` and `log.minor` are silent unless Vite's `logLevel` is `info`. */
	log: Logger;
	/** Remove `dir` and all its contents. */
	rimraf(dir: string): void;
	/** Create `dir` and any required parent directories. */
	mkdirp(dir: string): void;

	/** The fully resolved `svelte.config.js`. */
	config: ValidatedConfig;
	/** Information about prerendered pages and assets, if any. */
	prerendered: Prerendered;
	/** An array of all routes (including prerendered) */
	routes: RouteDefinition[];

	/**
	 * Create separate functions that map to one or more routes of your app.
	 * @param fn A function that groups a set of routes into an entry point
	 * @deprecated Use `builder.routes` instead
	 */
	createEntries(fn: (route: RouteDefinition) => AdapterEntry): Promise<void>;

	/**
	 * Generate a fallback page for a static webserver to use when no route is matched. Useful for single-page apps.
	 */
	generateFallback(dest: string): Promise<void>;

	/**
	 * Generate a server-side manifest to initialise the SvelteKit [server](https://kit.svelte.dev/docs/types#public-types-server) with.
	 * @param opts a relative path to the base directory of the app and optionally in which format (esm or cjs) the manifest should be generated
	 */
	generateManifest(opts: { relativePath: string; routes?: RouteDefinition[] }): string;

	/**
	 * Resolve a path to the `name` directory inside `outDir`, e.g. `/path/to/.svelte-kit/my-adapter`.
	 * @param name path to the file, relative to the build directory
	 */
	getBuildDirectory(name: string): string;
	/** Get the fully resolved path to the directory containing client-side assets, including the contents of your `static` directory. */
	getClientDirectory(): string;
	/** Get the fully resolved path to the directory containing server-side code. */
	getServerDirectory(): string;
	/** Get the application path including any configured `base` path, e.g. `my-base-path/_app`. */
	getAppPath(): string;

	/**
	 * Write client assets to `dest`.
	 * @param dest the destination folder
	 * @returns an array of files written to `dest`
	 */
	writeClient(dest: string): string[];
	/**
	 * Write prerendered files to `dest`.
	 * @param dest the destination folder
	 * @returns an array of files written to `dest`
	 */
	writePrerendered(dest: string): string[];
	/**
	 * Write server-side code to `dest`.
	 * @param dest the destination folder
	 * @returns an array of files written to `dest`
	 */
	writeServer(dest: string): string[];
	/**
	 * Copy a file or directory.
	 * @param from the source file or directory
	 * @param to the destination file or directory
	 * @param opts.filter a function to determine whether a file or directory should be copied
	 * @param opts.replace a map of strings to replace
	 * @returns an array of files that were copied
	 */
	copy(
		from: string,
		to: string,
		opts?: {
			filter?(basename: string): boolean;
			replace?: Record<string, string>;
		}
	): string[];

	/**
	 * Compress files in `directory` with gzip and brotli, where appropriate. Generates `.gz` and `.br` files alongside the originals.
	 * @param {string} directory The directory containing the files to be compressed
	 */
	compress(directory: string): Promise<void>;
}

export interface Config {
	/**
	 * Options passed to [`svelte.compile`](https://svelte.dev/docs#compile-time-svelte-compile).
	 * @default {}
	 */
	compilerOptions?: CompileOptions;
	/**
	 * List of file extensions that should be treated as Svelte files.
	 * @default [".svelte"]
	 */
	extensions?: string[];
	/** SvelteKit options */
	kit?: KitConfig;
	/** [`@sveltejs/package`](https://kit.sveltefr.dev/docs/packaging) options. */
	package?: {
		source?: string;
		dir?: string;
		emitTypes?: boolean;
		exports?(filepath: string): boolean;
		files?(filepath: string): boolean;
	};
	/** Preprocessor options, if any. Preprocessing can alternatively also be done through Vite's preprocessor capabilities. */
	preprocess?: any;
	/** `vite-plugin-svelte` plugin options. */
	vitePlugin?: PluginOptions;
	/** Any additional options required by tooling that integrates with Svelte. */
	[key: string]: any;
}

export interface Cookies {
	/**
	 * Gets a cookie that was previously set with `cookies.set`, or from the request headers.
	 * @param name the name of the cookie
	 * @param opts the options, passed directly to `cookie.parse`. See documentation [here](https://github.com/jshttp/cookie#cookieparsestr-options)
	 */
	get(name: string, opts?: import('cookie').CookieParseOptions): string | undefined;

	/**
	 * Gets all cookies that were previously set with `cookies.set`, or from the request headers.
	 * @param opts the options, passed directly to `cookie.parse`. See documentation [here](https://github.com/jshttp/cookie#cookieparsestr-options)
	 */
	getAll(opts?: import('cookie').CookieParseOptions): Array<{ name: string; value: string }>;

	/**
	 * Sets a cookie. This will add a `set-cookie` header to the response, but also make the cookie available via `cookies.get` or `cookies.getAll` during the current request.
	 *
	 * The `httpOnly` and `secure` options are `true` by default (except on http://localhost, where `secure` is `false`), and must be explicitly disabled if you want cookies to be readable by client-side JavaScript and/or transmitted over HTTP. The `sameSite` option defaults to `lax`.
	 *
	 * By default, the `path` of a cookie is the 'directory' of the current pathname. In most cases you should explicitly set `path: '/'` to make the cookie available throughout your app.
	 * @param name the name of the cookie
	 * @param value the cookie value
	 * @param opts the options, passed directly to `cookie.serialize`. See documentation [here](https://github.com/jshttp/cookie#cookieserializename-value-options)
	 */
	set(name: string, value: string, opts?: import('cookie').CookieSerializeOptions): void;

	/**
	 * Deletes a cookie by setting its value to an empty string and setting the expiry date in the past.
	 *
	 * By default, the `path` of a cookie is the 'directory' of the current pathname. In most cases you should explicitly set `path: '/'` to make the cookie available throughout your app.
	 * @param name the name of the cookie
	 * @param opts the options, passed directly to `cookie.serialize`. The `path` must match the path of the cookie you want to delete. See documentation [here](https://github.com/jshttp/cookie#cookieserializename-value-options)
	 */
	delete(name: string, opts?: import('cookie').CookieSerializeOptions): void;

	/**
	 * Serialize a cookie name-value pair into a `Set-Cookie` header string, but don't apply it to the response.
	 *
	 * The `httpOnly` and `secure` options are `true` by default (except on http://localhost, where `secure` is `false`), and must be explicitly disabled if you want cookies to be readable by client-side JavaScript and/or transmitted over HTTP. The `sameSite` option defaults to `lax`.
	 *
	 * By default, the `path` of a cookie is the current pathname. In most cases you should explicitly set `path: '/'` to make the cookie available throughout your app.
	 *
	 * @param name the name of the cookie
	 * @param value the cookie value
	 * @param opts the options, passed directly to `cookie.serialize`. See documentation [here](https://github.com/jshttp/cookie#cookieserializename-value-options)
	 */
	serialize(name: string, value: string, opts?: import('cookie').CookieSerializeOptions): string;
}

export interface KitConfig {
	/**
	 * * Votre [adaptateur](https://kit.sveltefr.dev/docs/adapters) est ce qui est exécuté lorsque vous lancez `vite build`. Il détermine comment votre projet est compilé selon différentes plateformes.
	 * @default undefined
	 */
	adapter?: Adapter;
	/**
	 * Un objet contenant zéro alias ou plus utilisés pour remplacer des valeurs dans déclarations `import`. Ces alias sont automatiquement passés à Vite et TypeScript.
	 *
	 * ```js
	 * /// file: svelte.config.js
	 * /// type: import('@sveltejs/kit').Config
	 * const config = {
	 *   kit: {
	 *     alias: {
	 *       // ceci va correspondre à un fichier
	 *       'my-file': 'path/to/my-file.js',
	 *
	 *       // ceci va correspondre à un dossier et son contenu
	 *       // (`my-directory/x` va renvoyer vers `path/to/my-directory/x`)
	 *       'my-directory': 'path/to/my-directory',
	 *
	 *       // un alias se terminant par /* va seulement correspondre
	 * 			 // au contenu du dossier, pas au dossier lui-même
	 *       'my-directory/*': 'path/to/my-directory/*'
	 *     }
	 *   }
	 * };
	 * ```
	 *
	 * > L'alias intégré `$lib` est contrôlé par `config.kit.files.lib` puisqu'il est utilisé pour le packaging.
	 *
	 * > Vous aurez besoin de lancer `npm run dev` pour laisser SvelteKit générer automatiquement la configuration d'alias définie par `jsconfig.json` ou `tsconfig.json`.
	 * @default {}
	 */
	alias?: Record<string, string>;
	/**
	 * Le dossier relatif à `paths.assets` depuis lequel le JS et CSS compilés (ainsi que les fichiers statiques importés) sont servis. (Les noms de fichiers que vous y mettez contiennent des hashs basés sur leur contenu, ce qui signifie qu'ils peuvent être mis en cache indéfiniment). Ne doit pas commencer ou finir par `/`.
	 * @default "_app"
	 */
	appDir?: string;
	/**
	 * La configuration [CSP](https://developer.mozilla.org/fr/docs/Web/HTTP/Headers/Content-Security-Policy). Les CSP vous aident à protéger vos utilisateurs et utilisatrices contre les attaques <span class='vo'>[XSS](https://sveltefr.dev/docs/web#xss)</span>, en limitant les endroits depuis lesquels les ressourcent peuvent être téléchargées. Par exemple, une configuration comme celle-ci...
	 *
	 * ```js
	 * /// file: svelte.config.js
	 * /// type: import('@sveltejs/kit').Config
	 * const config = {
	 *   kit: {
	 *     csp: {
	 *       directives: {
	 *         'script-src': ['self']
	 *       },
	 *       reportOnly: {
	 *         'script-src': ['self']
	 *       }
	 *     }
	 *   }
	 * };
	 *
	 * export default config;
	 * ```
	 *
	 * ... empêche les scripts d'être téléchargés depuis des sites externes. SvelteKit ajoute aux directives spécifiées des nonces ou des hashs (en fonction du `mode`) pour tout style <span class='vo'>[inliné](https://sveltefr.dev/docs/web#inline)</span> et script qu'il génère.
	 *
	 * Pour ajouter un nonce aux scripts et links inclus manuellement dans le fichier `src/app.html`, vous pouvez utiliser le <span class='vo'>[placeholder](https://sveltefr.dev/docs/development#placeholder)</span> `%sveltekit.nonce%` (par exemple `<script nonce="%sveltekit.nonce%">`).
	 *
	 * Lorsque les pages sont prérendues, le <span class='vo'>[header](https://sveltefr.dev/docs/web#header)</span> CSP est ajouté via une balise `<meta http-equiv>` (notez que dans ce cas, les directives `frame-ancestors`, `report-uri` et `sandbox` sont ignorées).
	 *
	 * > Lorsque `mode` vaut `'auto'`, SvelteKit utilise des nonces pour les pages dynamiquement rendues et des hashs pour les pages prérendues. Utiliser des nonces avec des pages prérendues n'est pas sécurisé et donc interdit.
	 *
	 * > Notez que la plupart des [transitions Svelte](https://apprendre.sveltefr.dev/tutorial/transition) fonctionnent en créant un élément `<style>` <span class='vo'>[inliné](https://sveltefr.dev/docs/web#inline)</span>. Si vous les utilisez dans votre application, vous devez soit laisser la directive `style-src` non spécifiée, soit ajouter `unsafe-inline`.
	 *
	 * Si ce niveau de configuration est insuffisant et vous avez des besoins plus dynamiques, vous pouvez utiliser le [hook `handle`](https://kit.sveltefr.dev/hooks#hooks-de-serveur-handle) pour définir vous-même vos CSP.
	 */
	csp?: {
		/**
		 * Mode indiquant d'utiliser des hashs ou des nonces pour restreindre les éléments `<script>` et `<style>`. `'auto'` utilisera les hashs pour les pages prérendues, et des nonces pour les pages rendues dynamiquement.
		 */
		mode?: 'hash' | 'nonce' | 'auto';
		/**
		 * Les directives qui seront ajoutées aux <span class='vo'>[headers](https://sveltefr.dev/docs/web#header)</span> `Content-Security-Policy`.
		 */
		directives?: CspDirectives;
		/**
		 * Les directives qui seront ajoutées aux <span class='vo'>[headers](https://sveltefr.dev/docs/web#header)</span> `Content-Security-Policy-Report-Only`.
		 */
		reportOnly?: CspDirectives;
	};
	/**
	 * Protection contre les attaques de type [CSRF](https://owasp.org/www-community/attacks/csrf).
	 */
	csrf?: {
		/**
		 * Vérifie ou non que le <span class='vo'>[header](https://sveltefr.dev/docs/web#header)</span> `origin` pour les soumissions de formulaire `POST`, `PUT`, `PATCH` ou `DELETE` correspond à l'origine du serveur.
		 *
		 * Si vous souhaitez que des personnes puissent faire des requêtes `POST`, `PUT`, `PATCH` ou `DELETE` avec un `Content-Type` valant `application/x-www-form-urlencoded`, `multipart/form-data`, ou `text/plain` vers votre application depuis d'autres origines, vous devrez désactiver cette option. Soyez vigilants !
		 * @default true
		 */
		checkOrigin?: boolean;
	};
	/**
	 * La zone rouge. Activer à vos risques et périls.
	 */
	dangerZone?: {
		/**
		 * Ajoute automatiquement les URLs requêtées sur le serveur avec `fetch` au dictionnaire de `dependencies` des fonctions `load`.
		 * Ceci expose les secrets au client si votre URL en contient.
		 */
		trackServerFetches?: boolean;
	};
	/**
	 * Si oui ou non l'application est embarquée dans une application plus grande. Si vaut `true`, SvelteKit ajoute les gestionnaires d'évènements liés à la navigation sur le parent du `%sveltekit.body%` plutôt que sur `window`, et passe les `params` depuis le serveur plutôt que de les inférer depuis `location.pathname`.
	 * @default false
	 */
	embedded?: boolean;
	/**
	 * Configuration des variables d'environnement
	 */
	env?: {
		/**
		 * Le dossier dans lequel se trouve vos fichiers `.env`.
		 * @default "."
		 */
		dir?: string;
		/**
		 * Un préfixe qui signale qu'une variable d'environnement est exposable en toute sécurité au code client. Voir [`$env/static/public`](https://kit.sveltefr.dev/docs/modules#$env-static-public) et [`$env/dynamic/public`](https://kit.sveltefr.dev/docs/modules#$env-dynamic-public). Notez que le préfixe [`envPrefix`](https://vitejs.dev/config/shared-options.html#envprefix) de Vite doit être défini à part si vous utilisez le gestionnaire de variables d'environnement de Vite – même si l'usage de cette fonctionnalité n'est en général pas nécessaire.
		 * @default "PUBLIC_"
		 */
		publicPrefix?: string;
		/**
		 * Un préfixe qui signale qu'une variable d'environnement n'est pas exposable en toute sécurité au code client. Les variables d'environnement qui ne correspondent ni au préfixe publique ni au préfixe privé seront complètement ignorées. Voir [`$env/static/public`](https://kit.sveltefr.dev/docs/modules#$env-static-public) et [`$env/dynamic/public`](https://kit.sveltefr.dev/docs/modules#$env-dynamic-public).
		 * @default ""
		 */
		privatePrefix?: string;
	};
	/**
	 * Les emplacements de différents fichiers dans votre projet.
	 */
	files?: {
		/**
		 * un endroit pour placer les fichiers statiques qui doivent avoir des URLS stables et n'être soumis à aucun traitement, comme `favicon.ico` ou `manifest.json`
		 * @default "static"
		 */
		assets?: string;
		hooks?: {
			/**
			 * L'emplacement de vos [hooks](https://kit.sveltefr.dev/docs/hooks) client.
			 * @default "src/hooks.client"
			 */
			client?: string;
			/**
			 * L'emplacement de vos [hooks](https://kit.sveltefr.dev/docs/hooks) serveur.
			 * @default "src/hooks.server"
			 */
			server?: string;
		};
		/**
		 * la librairie interne de votre application, accessible dans votre code via `$lib`
		 * @default "src/lib"
		 */
		lib?: string;
		/**
		 * un dossier contenant vos [fonctions `match`](https://kit.sveltefr.dev/docs/advanced-routing#matching)
		 * @default "src/params"
		 */
		params?: string;
		/**
		 * les fichiers qui définissent la structure de votre application (voir [Routing](https://kit.sveltefr.dev/docs/routing))
		 * @default "src/routes"
		 */
		routes?: string;
		/**
		 * l'emplacement du point d'entrée de vos service workers (voir [Service workers](https://kit.sveltefr.dev/docs/service-workers))
		 * @default "src/service-worker"
		 */
		serviceWorker?: string;
		/**
		 * l'emplacement du <span class='vo'>[template](https://sveltefr.dev/docs/development#template)</span> pour les réponses HTML
		 * @default "src/app.html"
		 */
		appTemplate?: string;
		/**
		 * l'emplacement du <span class='vo'>[template](https://sveltefr.dev/docs/development#template)</span> pour les réponses d'erreur de secours
		 * @default "src/error.html"
		 */
		errorTemplate?: string;
	};
	/**
	 * <span class='vo'>[Inline](https://sveltefr.dev/docs/web#inline)</span> le CSS dans un bloc `<style>` en haut du HTML. Cette option est un nombre qui précise la longueur maximale d'un fichier CSS inliné en unités de code UTF-16, comme spécifié par la propriété [String.length](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/String/length). Tous les fichiers CSS requis pour la page plus petits que cette valeur sont fusionnés et inlinés dans un seul bloc `<style>`.
	 *
	 * > Ceci permet de réduire le nombre initial de requêtes et peut améliorer votre score [First Contentful Paint](https://web.dev/first-contentful-paint). Cependant, cela génère des fichiers HTML plus lourds et réduit l'efficacité des caches de navigateur. Servez-vous en avec précaution.
	 * @default 0
	 */
	inlineStyleThreshold?: number;
	/**
	 * Un tableau d'extensions de fichiers que SvelteKit va traiter comme des modules. Les fichiers avec des extensions qui ne correspondent ni à `config.extensions` ni à `config.kit.moduleExtensions` seront ignorés par le routeur.
	 * @default [".js", ".ts"]
	 */
	moduleExtensions?: string[];
	/**
	 * Le dossier dans lequel SvelteKit écrit les fichiers lors de `dev` et `build`. Vous devriez exclure ce dossier de votre contrôle de version.
	 * @default ".svelte-kit"
	 */
	outDir?: string;
	/**
	 * Des options liées au format du dossier de compilation cible
	 */
	output?: {
		/**
		 * SvelteKit va précharger les modules JavaScript nécessaires pour la page initiale pour éviter des "cascades", impliquant un démarrage plus rapide de l'application. Il y a
		 * trois stratégies avec différents compromis :
		 * - `modulepreload` - utilise `<link rel="modulepreload">`. Cette option fournit les meilleurs résultats dans les navigateurs basés sur Chromium, dans Firefox 115+, et Safari 17+. Elle est ignorée dans les navigateurs plus anciens.
		 * - `preload-js` - utilise `<link rel="preload">`. Évite les cascades dans Chromium et Safari, mais Chromium va traiter chaque module deux fois (une fois en tant que script, une fois en tant que module). Implique que les modules sont requêtés deux fois dans Firefox. C'est une bonne option si vous souhaitez maximiser la performance sur les appareils iOS au prix d'une très légère dégradation sur Chromium.
		 * - `preload-mjs` - utilise `<link rel="preload">` mais avec l'extension `.mjs` qui empêche le double traitement par Chromium. Certains serveurs web statiques échoueront à servir les fichiers `.mjs` avec un <span class='vo'>[header](https://sveltefr.dev/docs/web#header)</span> `Content-Type: application/javascript`, ce qui fera planter votre application. Si ceci ne s'applique pas pour vous, cette option fournira la meilleure performance pour le plus grand nombre de personnes, jusqu'à ce que `modulepreload` soit plus largement supporté.
		 * @default "modulepreload"
		 */
		preloadStrategy?: 'modulepreload' | 'preload-js' | 'preload-mjs';
	};
	paths?: {
		/**
		 * Un chemin absolu depuis lequel les fichiers statiques de votre application sont servis. Ceci est utile si vos fichiers sont servis depuis un espace de stockage.
		 * @default ""
		 */
		assets?: '' | `http://${string}` | `https://${string}`;
		/**
		 * Un chemin relatif à la racine qui doit commencer, mais pas se terminer par `/` (par ex. `/base-path`), à moins que ce ne soit la chaîne de caractères vide. Ceci précise d'où votre application est servie et lui permet d'exister sur un chemin non racine. Notez que vous aurez besoin de préfixer tous vos liens relatifs à la racine avec la valeur de base, au risque de les faire pointer vers la racine de votre domaine, et non vers votre `base` (les navigateurs fonctionnent ainsi). Vous pouvez utiliser [`base` importée depuis `$app/paths`](https://kit.sveltefr.dev/docs/modules#$app-paths-base) pour faire cela: `<a href="{base}/votre-page">Lien</a>`. Si vous devez faire souvent ce remplacement, il peut être utile d'extraire cette logique dans un composant réutilisable.
		 * @default ""
		 */
		base?: '' | `/${string}`;
		/**
		 * Si oui ou non utiliser des chemins de fichiers statiques relatifs. Par défaut, si `paths.assets` n'est pas externe, SvelteKit va remplacer `%sveltekit.assets%` avec un chemin relatif et utiliser des chemins relatifs pour référencer les artefacts de compilation, mais `base` et `assets` importées depuis `$app/paths` resteront tels que spécifiées dans votre configuration.
		 *
		 * Si `true`, `base` et `assets` importées depuis `$app/paths` seront remplacées avec des chemins de fichiers statiques relatifs lors du rendu côté serveur, impliquant du HTML portable.
		 * Si `false`, `%sveltekit.assets%` et les références vers les artefacts de compilation seront toujours des chemins relatifs à la racine, à moins que `paths.assets` soit une URL externe.
		 *
		 * Si votre application utilise un élément `<base>`, vous devriez définir cette option à `false`, sinon les URLs de fichiers statiques seront mal résolues (c'est-à-dire par rapport à l'URL `<base>` plutôt que celle de la page courante).
		 * @default undefined
		 */
		relative?: boolean | undefined;
	};
	/**
	 * Voir la section [Prerendering](https://kit.sveltefr.dev/docs/options-de-page#prerender).
	 */
	prerender?: {
		/**
		 * Nombre de pages pouvant être prérendues simultanément. JS ne s'exécute que sur un seul <span class='vo'>[thread](https://sveltefr.dev/docs/development#thread)</span>, mais dans les cas où la performance de prérendu est liée au réseau (par exemple en chargeant du contenu depuis un <span class='vo'>[CMS](https://sveltefr.dev/docs/web#cms)</span> distant) ceci peut accélérer le processus en effectuant d'autres tâches pendant que les requêtes se terminent.
		 * @default 1
		 */
		concurrency?: number;
		/**
		 * Si oui ou non SvelteKit devrait trouver des pages à prérendre en suivant des liens depuis les entrées `entries`.
		 * @default true
		 */
		crawl?: boolean;
		/**
		 * Un tableau de pages à prérendre, ou depuis lequel commencer à chercher des liens (si `crawl: true`). La chaîne de caractères `*` permet d'inclure toutes les routes non dynamiques (c'est-à-dire les pages sans `[parametres]`, car SvelteKit ne sait pas d'avance les valeurs que vos paramètres peuvent avoir).
		 * @default ["*"]
		 */
		entries?: Array<'*' | `/${string}`>;
		/**
		 * Comportement de SvelteKit lors d'erreurs HTTP rencontrées pendant le prérendu de l'application.
		 *
		 * - `'fail'` — fait échouer la compilation
		 * - `'ignore'` - ignore l'erreur en silence et continue
		 * - `'warn'` — continue, mais affiche un avertissement
		 * - `(details) => void` — un gestionnaire d'erreur personnalisé qui prend en entrée un objet `details` possédant les propriétés `status`, `path`, `referrer`, `referenceType` et `message`. Si vous utilisez `throw` depuis cette fonction, la compilation échouera
		 *
		 * ```js
		 * /// file: svelte.config.js
		 * /// type: import('@sveltejs/kit').Config
		 * const config = {
		 *   kit: {
		 *     prerender: {
		 *       handleHttpError: ({ path, referrer, message }) => {
		 *         // ignore délibérément le lien vers une page 404
		 *         if (path === '/not-found' && referrer === '/blog/how-we-built-our-404-page') {
		 *           return;
		 *         }
		 *
		 *         // sinon fait échouer la compilation
		 *         throw new Error(message);
		 *       }
		 *     }
		 *   }
		 * };
		 * ```
		 *
		 * @default "fail"
		 */
		handleHttpError?: PrerenderHttpErrorHandlerValue;
		/**
		 * Comportement de SvelteKit lorsque les liens d'une page prérendue vers une autre ne correspondent pas à l'`id` de la page cible.
		 *
		 * - `'fail'` — fait échouer la compilation
		 * - `'ignore'` - ignore l'erreur en silence et continue
		 * - `'warn'` — continue, mais affiche un avertissement
		 * - `(details) => void` — un gestionnaire d'erreur personnalisé qui prend en entrée un objet `details` possédant les propriétés `path`, `id`, `referrers` et `message`. Si vous utilisez `throw` depuis cette fonction, la compilation échouera
		 *
		 * @default "fail"
		 */
		handleMissingId?: PrerenderMissingIdHandlerValue;
		/**
		 * Comportement de SvelteKit lorsqu'une entrée générée par l'export `entries` ne correspond pas à la route depuis laquelle elle a été générée.
		 *
		 * - `'fail'` — fait échouer la compilation
		 * - `'ignore'` - ignore l'erreur en silence et continue
		 * - `'warn'` — continue, mais affiche un avertissement
		 * - `(details) => void` — un gestionnaire d'erreur personnalisé qui prend en entrée un objet `details` possédant les propriétés `generatedFromId`, `entry`, `matchedId` et `message`. Si vous utilisez `throw` depuis cette fonction, la compilation échouera
		 *
		 * @default "fail"
		 */
		handleEntryGeneratorMismatch?: PrerenderEntryGeneratorMismatchHandlerValue;
		/**
		 * La valeur de `url.origin` pendant le prérendu ; utile si l'origine est incluse dans le contenu généré.
		 * @default "http://sveltekit-prerender"
		 */
		origin?: string;
	};
	serviceWorker?: {
		/**
		 * Si oui ou non utiliser automatiquement le <span class='vo'>[service worker](https://sveltefr.dev/docs/web#service-worker)</span>, s'il existe.
		 * @default true
		 */
		register?: boolean;
		/**
		 * Détermine quels fichiers de votre dossier `static` seront disponibles dans `$service-worker.files`.
		 * @default (filename) => !/\.DS_Store/.test(filename)
		 */
		files?(filepath: string): boolean;
	};
	typescript?: {
		/**
		 * Une fonction qui permet d'éditer le fichier `tsconfig.json` généré. Vous pouvez muter la configuration (recommandé) ou en renvoyer une nouvelle.
		 * Ceci est utile pour étender un fichier `tsconfig.json` partagé à la racine d'un <span class='vo'>[monorepo](https://sveltefr.dev/docs/development#monorepo)</span>, par exemple.
		 * @default (config) => config
		 */
		config?: (config: Record<string, any>) => Record<string, any> | void;
	};
	/**
	 * Les navigations côté client peuvent être impactées si vous déployez une nouvelle version de votre application pendant que des gens sont en train de l'utiliser. Si le code de la nouvelle page est déjà chargé, il se peut qu'il ait du contenu périmé ; s'il n'est pas encore chargé, le manifeste de routes de votre application peut pointer vers un fichier JavaScript qui n'existe plus.
	 * SvelteKit vous aide à résoudre ce problème via une gestion de version.
	 * Si Sveltekit rencontre une erreur pendant le chargement de la page et détecte qu'une nouvelle version est déployée (en utilisant le `name` spécifié ici, qui par défaut a pour valeur le <span class='vo'>[timestamp](https://sveltefr.dev/docs/development#timestamp)</span> de compilation), il choisit de passer par une navigation traditionnelle qui recharge entièrement la page.
	 * Mais toutes les navigations ne débouchent pas toujours sur une erreur, par exemple si le code JavaScript de la nouvelle page est déjà chargé. Si vous souhaitez toujours forcer une navigation qui recharge toute la page dans ces cas-là, vous pouvez utiliser des techniques telles que définir l'option `pollInterval` puis utiliser `beforeNavigate` :
	 * ```html
	 * /// file: +layout.svelte
	 * <script>
	 *   import { beforeNavigate } from '$app/navigation';
	 *   import { updated } from '$app/stores';
	 *
	 *   beforeNavigate(({ willUnload, to }) => {
	 *     if ($updated && !willUnload && to?.url) {
	 *       location.href = to.url.href;
	 *     }
	 *   });
	 * </script>
	 * ```
	 *
	 * Si vous définissez `pollInterval` comme étant une valeur différente de zéro, SvelteKit va régulièrement vérifier en tâche de fond si une nouvelle version de votre application existe, et mettre la valeur du [store `updated`](https://kit.sveltefr.dev/docs/modules#$app-stores-updated) à `true` s'il détecte une nouvelle version.
	 */
	version?: {
		/**
		 * La version actuelle de votre application. Si précisée, cette valeur doit être déterministe (c'est-à-dire une référence de <span class='vo'>[commit](https://sveltefr.dev/docs/development#commit)</span> plutôt qu'un `Math.random()` ou `Date.now().toString()`). Si non précisée, cette valeur vaut le <span class='vo'>[timestamp](https://sveltefr.dev/docs/development#timestamp)</span> de la dernière compilation.
		 *
		 * Par exemple, pour utiliser le <span class='vo'>[hash](https://sveltefr.dev/docs/development#hash)</span> du dernier <span class='vo'>[commit](https://sveltefr.dev/docs/development#commit)</span>, vous pouvez utiliser `git rev-parse HEAD` :
		 *
		 * ```js
		 * /// file: svelte.config.js
		 * import * as child_process from 'node:child_process';
		 *
		 * export default {
		 *   kit: {
		 *     version: {
		 *       name: child_process.execSync('git rev-parse HEAD').toString().trim()
		 *     }
		 *   }
		 * };
		 * ```
		 */
		name?: string;
		/**
		 * Un intervalle en millisecondes pour vérifier l'existence de nouvelles version. Si cette valeur vaut `0`, aucune vérification n'est faite.
		 * @default 0
		 */
		pollInterval?: number;
	};
}

/**
 * The [`handle`](https://kit.svelte.dev/docs/hooks#server-hooks-handle) hook runs every time the SvelteKit server receives a [request](https://kit.svelte.dev/docs/web-standards#fetch-apis-request) and
 * determines the [response](https://kit.svelte.dev/docs/web-standards#fetch-apis-response).
 * It receives an `event` object representing the request and a function called `resolve`, which renders the route and generates a `Response`.
 * This allows you to modify response headers or bodies, or bypass SvelteKit entirely (for implementing routes programmatically, for example).
 */
export type Handle = (input: {
	event: RequestEvent;
	resolve(event: RequestEvent, opts?: ResolveOptions): MaybePromise<Response>;
}) => MaybePromise<Response>;

/**
 * The server-side [`handleError`](https://kit.svelte.dev/docs/hooks#shared-hooks-handleerror) hook runs when an unexpected error is thrown while responding to a request.
 *
 * If an unexpected error is thrown during loading or rendering, this function will be called with the error and the event.
 * Make sure that this function _never_ throws an error.
 */
export type HandleServerError = (input: {
	error: unknown;
	event: RequestEvent;
}) => MaybePromise<void | App.Error>;

/**
 * The client-side [`handleError`](https://kit.svelte.dev/docs/hooks#shared-hooks-handleerror) hook runs when an unexpected error is thrown while navigating.
 *
 * If an unexpected error is thrown during loading or the following render, this function will be called with the error and the event.
 * Make sure that this function _never_ throws an error.
 */
export type HandleClientError = (input: {
	error: unknown;
	event: NavigationEvent;
}) => MaybePromise<void | App.Error>;

/**
 * The [`handleFetch`](https://kit.svelte.dev/docs/hooks#server-hooks-handlefetch) hook allows you to modify (or replace) a `fetch` request that happens inside a `load` function that runs on the server (or during pre-rendering)
 */
export type HandleFetch = (input: {
	event: RequestEvent;
	request: Request;
	fetch: typeof fetch;
}) => MaybePromise<Response>;

/**
 * The generic form of `PageLoad` and `LayoutLoad`. You should import those from `./$types` (see [generated types](https://kit.svelte.dev/docs/types#generated-types))
 * rather than using `Load` directly.
 */
export type Load<
	Params extends Partial<Record<string, string>> = Partial<Record<string, string>>,
	InputData extends Record<string, unknown> | null = Record<string, any> | null,
	ParentData extends Record<string, unknown> = Record<string, any>,
	OutputData extends Record<string, unknown> | void = Record<string, any> | void,
	RouteId extends string | null = string | null
> = (event: LoadEvent<Params, InputData, ParentData, RouteId>) => MaybePromise<OutputData>;

/**
 * The generic form of `PageLoadEvent` and `LayoutLoadEvent`. You should import those from `./$types` (see [generated types](https://kit.svelte.dev/docs/types#generated-types))
 * rather than using `LoadEvent` directly.
 */
export interface LoadEvent<
	Params extends Partial<Record<string, string>> = Partial<Record<string, string>>,
	Data extends Record<string, unknown> | null = Record<string, any> | null,
	ParentData extends Record<string, unknown> = Record<string, any>,
	RouteId extends string | null = string | null
> extends NavigationEvent<Params, RouteId> {
	/**
	 * `fetch` is equivalent to the [native `fetch` web API](https://developer.mozilla.org/en-US/docs/Web/API/fetch), with a few additional features:
	 *
	 * - It can be used to make credentialed requests on the server, as it inherits the `cookie` and `authorization` headers for the page request.
	 * - It can make relative requests on the server (ordinarily, `fetch` requires a URL with an origin when used in a server context).
	 * - Internal requests (e.g. for `+server.js` routes) go directly to the handler function when running on the server, without the overhead of an HTTP call.
	 * - During server-side rendering, the response will be captured and inlined into the rendered HTML by hooking into the `text` and `json` methods of the `Response` object. Note that headers will _not_ be serialized, unless explicitly included via [`filterSerializedResponseHeaders`](https://kit.svelte.dev/docs/hooks#server-hooks-handle)
	 * - During hydration, the response will be read from the HTML, guaranteeing consistency and preventing an additional network request.
	 *
	 * You can learn more about making credentialed requests with cookies [here](https://kit.svelte.dev/docs/load#cookies)
	 */
	fetch: typeof fetch;
	/**
	 * Contains the data returned by the route's server `load` function (in `+layout.server.js` or `+page.server.js`), if any.
	 */
	data: Data;
	/**
	 * If you need to set headers for the response, you can do so using the this method. This is useful if you want the page to be cached, for example:
	 *
	 *	```js
	 *	/// file: src/routes/blog/+page.js
	 *	export async function load({ fetch, setHeaders }) {
	 *		const url = `https://cms.example.com/articles.json`;
	 *		const response = await fetch(url);
	 *
	 *		setHeaders({
	 *			age: response.headers.get('age'),
	 *			'cache-control': response.headers.get('cache-control')
	 *		});
	 *
	 *		return response.json();
	 *	}
	 *	```
	 *
	 * Setting the same header multiple times (even in separate `load` functions) is an error — you can only set a given header once.
	 *
	 * You cannot add a `set-cookie` header with `setHeaders` — use the [`cookies`](https://kit.svelte.dev/docs/types#public-types-cookies) API in a server-only `load` function instead.
	 *
	 * `setHeaders` has no effect when a `load` function runs in the browser.
	 */
	setHeaders(headers: Record<string, string>): void;
	/**
	 * `await parent()` returns data from parent `+layout.js` `load` functions.
	 * Implicitly, a missing `+layout.js` is treated as a `({ data }) => data` function, meaning that it will return and forward data from parent `+layout.server.js` files.
	 *
	 * Be careful not to introduce accidental waterfalls when using `await parent()`. If for example you only want to merge parent data into the returned output, call it _after_ fetching your other data.
	 */
	parent(): Promise<ParentData>;
	/**
	 * This function declares that the `load` function has a _dependency_ on one or more URLs or custom identifiers, which can subsequently be used with [`invalidate()`](https://kit.sveltefr.dev/docs/modules#$app-navigation-invalidate) to cause `load` to rerun.
	 *
	 * Most of the time you won't need this, as `fetch` calls `depends` on your behalf — it's only necessary if you're using a custom API client that bypasses `fetch`.
	 *
	 * URLs can be absolute or relative to the page being loaded, and must be [encoded](https://developer.mozilla.org/en-US/docs/Glossary/percent-encoding).
	 *
	 * Custom identifiers have to be prefixed with one or more lowercase letters followed by a colon to conform to the [URI specification](https://www.rfc-editor.org/rfc/rfc3986.html).
	 *
	 * The following example shows how to use `depends` to register a dependency on a custom identifier, which is `invalidate`d after a button click, making the `load` function rerun.
	 *
	 * ```js
	 * /// file: src/routes/+page.js
	 * let count = 0;
	 * export async function load({ depends }) {
	 * 	depends('increase:count');
	 *
	 * 	return { count: count++ };
	 * }
	 * ```
	 *
	 * ```html
	 * /// file: src/routes/+page.svelte
	 * <script>
	 * 	import { invalidate } from '$app/navigation';
	 *
	 * 	export let data;
	 *
	 * 	const increase = async () => {
	 * 		await invalidate('increase:count');
	 * 	}
	 * </script>
	 *
	 * <p>{data.count}<p>
	 * <button on:click={increase}>Increase Count</button>
	 * ```
	 */
	depends(...deps: string[]): void;
}

export interface NavigationEvent<
	Params extends Partial<Record<string, string>> = Partial<Record<string, string>>,
	RouteId extends string | null = string | null
> {
	/**
	 * The parameters of the current page - e.g. for a route like `/blog/[slug]`, a `{ slug: string }` object
	 */
	params: Params;
	/**
	 * Info about the current route
	 */
	route: {
		/**
		 * The ID of the current route - e.g. for `src/routes/blog/[slug]`, it would be `/blog/[slug]`
		 */
		id: RouteId;
	};
	/**
	 * The URL of the current page
	 */
	url: URL;
}

/**
 * Information about the target of a specific navigation.
 */
export interface NavigationTarget {
	/**
	 * Parameters of the target page - e.g. for a route like `/blog/[slug]`, a `{ slug: string }` object.
	 * Is `null` if the target is not part of the SvelteKit app (could not be resolved to a route).
	 */
	params: Record<string, string> | null;
	/**
	 * Info about the target route
	 */
	route: { id: string | null };
	/**
	 * The URL that is navigated to
	 */
	url: URL;
}

/**
 * - `enter`: The app has hydrated
 * - `form`: The user submitted a `<form>` with a GET method
 * - `leave`: The user is leaving the app by closing the tab or using the back/forward buttons to go to a different document
 * - `link`: Navigation was triggered by a link click
 * - `goto`: Navigation was triggered by a `goto(...)` call or a redirect
 * - `popstate`: Navigation was triggered by back/forward navigation
 */
export type NavigationType = 'enter' | 'form' | 'leave' | 'link' | 'goto' | 'popstate';

export interface Navigation {
	/**
	 * Where navigation was triggered from
	 */
	from: NavigationTarget | null;
	/**
	 * Where navigation is going to/has gone to
	 */
	to: NavigationTarget | null;
	/**
	 * The type of navigation:
	 * - `form`: The user submitted a `<form>`
	 * - `leave`: The user is leaving the app by closing the tab or using the back/forward buttons to go to a different document
	 * - `link`: Navigation was triggered by a link click
	 * - `goto`: Navigation was triggered by a `goto(...)` call or a redirect
	 * - `popstate`: Navigation was triggered by back/forward navigation
	 */
	type: Exclude<NavigationType, 'enter'>;
	/**
	 * Whether or not the navigation will result in the page being unloaded (i.e. not a client-side navigation)
	 */
	willUnload: boolean;
	/**
	 * In case of a history back/forward navigation, the number of steps to go back/forward
	 */
	delta?: number;
	/**
	 * A promise that resolves once the navigation is complete, and rejects if the navigation
	 * fails or is aborted. In the case of a `willUnload` navigation, the promise will never resolve
	 */
	complete: Promise<void>;
}

/**
 * The argument passed to [`beforeNavigate`](https://kit.svelte.dev/docs/modules#$app-navigation-beforenavigate) callbacks.
 */
export interface BeforeNavigate extends Navigation {
	/**
	 * Call this to prevent the navigation from starting.
	 */
	cancel(): void;
}

/**
 * The argument passed to [`onNavigate`](https://kit.svelte.dev/docs/modules#$app-navigation-onnavigate) callbacks.
 */
export interface OnNavigate extends Navigation {
	/**
	 * The type of navigation:
	 * - `form`: The user submitted a `<form>`
	 * - `link`: Navigation was triggered by a link click
	 * - `goto`: Navigation was triggered by a `goto(...)` call or a redirect
	 * - `popstate`: Navigation was triggered by back/forward navigation
	 */
	type: Exclude<NavigationType, 'enter' | 'leave'>;
	/**
	 * Since `onNavigate` callbacks are called immediately before a client-side navigation, they will never be called with a navigation that unloads the page.
	 */
	willUnload: false;
}

/**
 * The argument passed to [`afterNavigate`](https://kit.svelte.dev/docs/modules#$app-navigation-afternavigate) callbacks.
 */
export interface AfterNavigate extends Omit<Navigation, 'type'> {
	/**
	 * The type of navigation:
	 * - `enter`: The app has hydrated
	 * - `form`: The user submitted a `<form>`
	 * - `link`: Navigation was triggered by a link click
	 * - `goto`: Navigation was triggered by a `goto(...)` call or a redirect
	 * - `popstate`: Navigation was triggered by back/forward navigation
	 */
	type: Exclude<NavigationType, 'leave'>;
	/**
	 * Since `afterNavigate` callbacks are called after a navigation completes, they will never be called with a navigation that unloads the page.
	 */
	willUnload: false;
}

/**
 * The shape of the `$page` store
 */
export interface Page<
	Params extends Record<string, string> = Record<string, string>,
	RouteId extends string | null = string | null
> {
	/**
	 * The URL of the current page
	 */
	url: URL;
	/**
	 * The parameters of the current page - e.g. for a route like `/blog/[slug]`, a `{ slug: string }` object
	 */
	params: Params;
	/**
	 * Info about the current route
	 */
	route: {
		/**
		 * The ID of the current route - e.g. for `src/routes/blog/[slug]`, it would be `/blog/[slug]`
		 */
		id: RouteId;
	};
	/**
	 * Http status code of the current page
	 */
	status: number;
	/**
	 * The error object of the current page, if any. Filled from the `handleError` hooks.
	 */
	error: App.Error | null;
	/**
	 * The merged result of all data from all `load` functions on the current page. You can type a common denominator through `App.PageData`.
	 */
	data: App.PageData & Record<string, any>;
	/**
	 * Filled only after a form submission. See [form actions](https://kit.svelte.dev/docs/form-actions) for more info.
	 */
	form: any;
}

/**
 * The shape of a param matcher. See [matching](https://kit.svelte.dev/docs/advanced-routing#matching) for more info.
 */
export type ParamMatcher = (param: string) => boolean;

export interface RequestEvent<
	Params extends Partial<Record<string, string>> = Partial<Record<string, string>>,
	RouteId extends string | null = string | null
> {
	/**
	 * Get or set cookies related to the current request
	 */
	cookies: Cookies;
	/**
	 * `fetch` is equivalent to the [native `fetch` web API](https://developer.mozilla.org/en-US/docs/Web/API/fetch), with a few additional features:
	 *
	 * - It can be used to make credentialed requests on the server, as it inherits the `cookie` and `authorization` headers for the page request.
	 * - It can make relative requests on the server (ordinarily, `fetch` requires a URL with an origin when used in a server context).
	 * - Internal requests (e.g. for `+server.js` routes) go directly to the handler function when running on the server, without the overhead of an HTTP call.
	 * - During server-side rendering, the response will be captured and inlined into the rendered HTML by hooking into the `text` and `json` methods of the `Response` object. Note that headers will _not_ be serialized, unless explicitly included via [`filterSerializedResponseHeaders`](https://kit.svelte.dev/docs/hooks#server-hooks-handle)
	 * - During hydration, the response will be read from the HTML, guaranteeing consistency and preventing an additional network request.
	 *
	 * You can learn more about making credentialed requests with cookies [here](https://kit.svelte.dev/docs/load#cookies)
	 */
	fetch: typeof fetch;
	/**
	 * The client's IP address, set by the adapter.
	 */
	getClientAddress(): string;
	/**
	 * Contains custom data that was added to the request within the [`handle hook`](https://kit.svelte.dev/docs/hooks#server-hooks-handle).
	 */
	locals: App.Locals;
	/**
	 * The parameters of the current route - e.g. for a route like `/blog/[slug]`, a `{ slug: string }` object
	 */
	params: Params;
	/**
	 * Additional data made available through the adapter.
	 */
	platform: Readonly<App.Platform> | undefined;
	/**
	 * The original request object
	 */
	request: Request;
	/**
	 * Info about the current route
	 */
	route: {
		/**
		 * The ID of the current route - e.g. for `src/routes/blog/[slug]`, it would be `/blog/[slug]`
		 */
		id: RouteId;
	};
	/**
	 * If you need to set headers for the response, you can do so using the this method. This is useful if you want the page to be cached, for example:
	 *
	 *	```js
	 *	/// file: src/routes/blog/+page.js
	 *	export async function load({ fetch, setHeaders }) {
	 *		const url = `https://cms.example.com/articles.json`;
	 *		const response = await fetch(url);
	 *
	 *		setHeaders({
	 *			age: response.headers.get('age'),
	 *			'cache-control': response.headers.get('cache-control')
	 *		});
	 *
	 *		return response.json();
	 *	}
	 *	```
	 *
	 * Setting the same header multiple times (even in separate `load` functions) is an error — you can only set a given header once.
	 *
	 * You cannot add a `set-cookie` header with `setHeaders` — use the [`cookies`](https://kit.svelte.dev/docs/types#public-types-cookies) API instead.
	 */
	setHeaders(headers: Record<string, string>): void;
	/**
	 * The requested URL.
	 */
	url: URL;
	/**
	 * `true` if the request comes from the client asking for `+page/layout.server.js` data. The `url` property will be stripped of the internal information
	 * related to the data request in this case. Use this property instead if the distinction is important to you.
	 */
	isDataRequest: boolean;
	/**
	 * `true` for `+server.js` calls coming from SvelteKit without the overhead of actually making an HTTP request. This happens when you make same-origin `fetch` requests on the server.
	 */
	isSubRequest: boolean;
}

/**
 * A `(event: RequestEvent) => Response` function exported from a `+server.js` file that corresponds to an HTTP verb (`GET`, `PUT`, `PATCH`, etc) and handles requests with that method.
 *
 * It receives `Params` as the first generic argument, which you can skip by using [generated types](https://kit.svelte.dev/docs/types#generated-types) instead.
 */
export type RequestHandler<
	Params extends Partial<Record<string, string>> = Partial<Record<string, string>>,
	RouteId extends string | null = string | null
> = (event: RequestEvent<Params, RouteId>) => MaybePromise<Response>;

export interface ResolveOptions {
	/**
	 * Applies custom transforms to HTML. If `done` is true, it's the final chunk. Chunks are not guaranteed to be well-formed HTML
	 * (they could include an element's opening tag but not its closing tag, for example)
	 * but they will always be split at sensible boundaries such as `%sveltekit.head%` or layout/page components.
	 * @param input the html chunk and the info if this is the last chunk
	 */
	transformPageChunk?(input: { html: string; done: boolean }): MaybePromise<string | undefined>;
	/**
	 * Determines which headers should be included in serialized responses when a `load` function loads a resource with `fetch`.
	 * By default, none will be included.
	 * @param name header name
	 * @param value header value
	 */
	filterSerializedResponseHeaders?(name: string, value: string): boolean;
	/**
	 * Determines what should be added to the `<head>` tag to preload it.
	 * By default, `js` and `css` files will be preloaded.
	 * @param input the type of the file and its path
	 */
	preload?(input: { type: 'font' | 'css' | 'js' | 'asset'; path: string }): boolean;
}

export interface RouteDefinition<Config = any> {
	id: string;
	api: {
		methods: Array<HttpMethod | '*'>;
	};
	page: {
		methods: Array<Extract<HttpMethod, 'GET' | 'POST'>>;
	};
	pattern: RegExp;
	prerender: PrerenderOption;
	segments: RouteSegment[];
	methods: Array<HttpMethod | '*'>;
	config: Config;
}

export class Server {
	constructor(manifest: SSRManifest);
	init(options: ServerInitOptions): Promise<void>;
	respond(request: Request, options: RequestOptions): Promise<Response>;
}

export interface ServerInitOptions {
	env: Record<string, string>;
}

export interface SSRManifest {
	appDir: string;
	appPath: string;
	assets: Set<string>;
	mimeTypes: Record<string, string>;

	/** private fields */
	_: {
		client: NonNullable<BuildData['client']>;
		nodes: SSRNodeLoader[];
		routes: SSRRoute[];
		matchers(): Promise<Record<string, ParamMatcher>>;
	};
}

/**
 * The generic form of `PageServerLoad` and `LayoutServerLoad`. You should import those from `./$types` (see [generated types](https://kit.svelte.dev/docs/types#generated-types))
 * rather than using `ServerLoad` directly.
 */
export type ServerLoad<
	Params extends Partial<Record<string, string>> = Partial<Record<string, string>>,
	ParentData extends Record<string, any> = Record<string, any>,
	OutputData extends Record<string, any> | void = Record<string, any> | void,
	RouteId extends string | null = string | null
> = (event: ServerLoadEvent<Params, ParentData, RouteId>) => MaybePromise<OutputData>;

export interface ServerLoadEvent<
	Params extends Partial<Record<string, string>> = Partial<Record<string, string>>,
	ParentData extends Record<string, any> = Record<string, any>,
	RouteId extends string | null = string | null
> extends RequestEvent<Params, RouteId> {
	/**
	 * `await parent()` returns data from parent `+layout.server.js` `load` functions.
	 *
	 * Be careful not to introduce accidental waterfalls when using `await parent()`. If for example you only want to merge parent data into the returned output, call it _after_ fetching your other data.
	 */
	parent(): Promise<ParentData>;
	/**
	 * This function declares that the `load` function has a _dependency_ on one or more URLs or custom identifiers, which can subsequently be used with [`invalidate()`](https://kit.sveltefr.dev/docs/modules#$app-navigation-invalidate) to cause `load` to rerun.
	 *
	 * Most of the time you won't need this, as `fetch` calls `depends` on your behalf — it's only necessary if you're using a custom API client that bypasses `fetch`.
	 *
	 * URLs can be absolute or relative to the page being loaded, and must be [encoded](https://developer.mozilla.org/en-US/docs/Glossary/percent-encoding).
	 *
	 * Custom identifiers have to be prefixed with one or more lowercase letters followed by a colon to conform to the [URI specification](https://www.rfc-editor.org/rfc/rfc3986.html).
	 *
	 * The following example shows how to use `depends` to register a dependency on a custom identifier, which is `invalidate`d after a button click, making the `load` function rerun.
	 *
	 * ```js
	 * /// file: src/routes/+page.js
	 * let count = 0;
	 * export async function load({ depends }) {
	 * 	depends('increase:count');
	 *
	 * 	return { count: count++ };
	 * }
	 * ```
	 *
	 * ```html
	 * /// file: src/routes/+page.svelte
	 * <script>
	 * 	import { invalidate } from '$app/navigation';
	 *
	 * 	export let data;
	 *
	 * 	const increase = async () => {
	 * 		await invalidate('increase:count');
	 * 	}
	 * </script>
	 *
	 * <p>{data.count}<p>
	 * <button on:click={increase}>Increase Count</button>
	 * ```
	 */
	depends(...deps: string[]): void;
}

/**
 * Shape of a form action method that is part of `export const actions = {..}` in `+page.server.js`.
 * See [form actions](https://kit.svelte.dev/docs/form-actions) for more information.
 */
export type Action<
	Params extends Partial<Record<string, string>> = Partial<Record<string, string>>,
	OutputData extends Record<string, any> | void = Record<string, any> | void,
	RouteId extends string | null = string | null
> = (event: RequestEvent<Params, RouteId>) => MaybePromise<OutputData>;

/**
 * Shape of the `export const actions = {..}` object in `+page.server.js`.
 * See [form actions](https://kit.svelte.dev/docs/form-actions) for more information.
 */
export type Actions<
	Params extends Partial<Record<string, string>> = Partial<Record<string, string>>,
	OutputData extends Record<string, any> | void = Record<string, any> | void,
	RouteId extends string | null = string | null
> = Record<string, Action<Params, OutputData, RouteId>>;

/**
 * When calling a form action via fetch, the response will be one of these shapes.
 * ```svelte
 * <form method="post" use:enhance={() => {
 *   return ({ result }) => {
 * 		// result is of type ActionResult
 *   };
 * }}
 * ```
 */
export type ActionResult<
	Success extends Record<string, unknown> | undefined = Record<string, any>,
	Failure extends Record<string, unknown> | undefined = Record<string, any>
> =
	| { type: 'success'; status: number; data?: Success }
	| { type: 'failure'; status: number; data?: Failure }
	| { type: 'redirect'; status: number; location: string }
	| { type: 'error'; status?: number; error: any };

/**
 * The object returned by the [`error`](https://kit.svelte.dev/docs/modules#sveltejs-kit-error) function.
 */
export interface HttpError {
	/** The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses), in the range 400-599. */
	status: number;
	/** The content of the error. */
	body: App.Error;
}

/**
 * The object returned by the [`redirect`](https://kit.svelte.dev/docs/modules#sveltejs-kit-redirect) function
 */
export interface Redirect {
	/** The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#redirection_messages), in the range 300-308. */
	status: 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308;
	/** The location to redirect to. */
	location: string;
}

export type SubmitFunction<
	Success extends Record<string, unknown> | undefined = Record<string, any>,
	Failure extends Record<string, unknown> | undefined = Record<string, any>
> = (input: {
	action: URL;
	/**
	 * use `formData` instead of `data`
	 * @deprecated
	 */
	data: FormData;
	formData: FormData;
	/**
	 * use `formElement` instead of `form`
	 * @deprecated
	 */
	form: HTMLFormElement;
	formElement: HTMLFormElement;
	controller: AbortController;
	submitter: HTMLElement | null;
	cancel(): void;
}) => MaybePromise<
	| void
	| ((opts: {
			/**
			 * use `formData` instead of `data`
			 * @deprecated
			 */
			data: FormData;
			formData: FormData;
			/**
			 * use `formElement` instead of `form`
			 * @deprecated
			 */
			form: HTMLFormElement;
			formElement: HTMLFormElement;
			action: URL;
			result: ActionResult<Success, Failure>;
			/**
			 * Call this to get the default behavior of a form submission response.
			 * @param options Set `reset: false` if you don't want the `<form>` values to be reset after a successful submission.
			 * @param invalidateAll Set `invalidateAll: false` if you don't want the action to call `invalidateAll` after submission.
			 */
			update(options?: { reset?: boolean; invalidateAll?: boolean }): Promise<void>;
	  }) => void)
>;

/**
 * The type of `export const snapshot` exported from a page or layout component.
 */
export interface Snapshot<T = any> {
	capture: () => T;
	restore: (snapshot: T) => void;
}

export * from './index.js';
