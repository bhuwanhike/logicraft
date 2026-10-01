import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./extension-resolver.mjs', pathToFileURL(import.meta.filename));
