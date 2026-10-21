/* rekosk.dev: where the site's scripts start.
   The site's code is split into one script per feature (js/*.js, in the order index.html loads them). Each one
   registers a part with rekoSite.part(); js/boot.js, the last one, runs every part in that order, all in one go,
   just like one big script. Parts share names through `site`: site.share({ name: () => name }) in one part,
   then const { name } = site (or site.name, for a value that changes) in the parts after it. `site` itself
   is never on window, so nothing in it can be reached from the browser console. */
'use strict';

window.rekoSite = (() => {
  const parts = [];
  const site = {
    // share({ name: () => name }): site.name always reads the part's current value; [get, set] lets other parts set it
    share(names) {
      Object.entries(names).forEach(([name, acc]) => {
        const [get, set] = Array.isArray(acc) ? acc : [acc];
        Object.defineProperty(site, name, { get, set, enumerable: true });
      });
    },
  };
  return {
    part: (fn) => { parts.push(fn); },
    boot: () => { delete window.rekoSite; parts.forEach((fn) => fn(site)); },
  };
})();

rekoSite.part((site) => {
  site.share({ $: () => $, $$: () => $$, root: () => root, reduceMotion: () => reduceMotion });

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const root = $('#app');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
});
