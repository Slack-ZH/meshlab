import {buildPages} from './build-experiments.mjs';
import {definitions} from '../dist/mechanisms/mechanics.mjs';
await buildPages(Object.keys(definitions));
