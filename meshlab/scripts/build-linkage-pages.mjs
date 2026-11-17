import {buildPages} from './build-experiments.mjs';
import {definitions} from '../dist/linkages/mechanics.mjs';
await buildPages(Object.keys(definitions));
