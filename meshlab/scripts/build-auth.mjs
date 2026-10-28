import { build } from 'esbuild';
await build({ entryPoints: ['scripts/firebase-entry.js'], outfile: 'dist/assets/firebase-auth.js',
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'eof' });
console.log('Built the Firebase email login browser bundle.');
