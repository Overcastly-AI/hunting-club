// The phone header menu's script (bundled by `vite build --mode client`, self-hosted, on
// every page). A module script runs after the page is parsed, so the header exists.
import { PHONE_HEADER_MEDIA, setUpMenu } from './menu';

setUpMenu(document, matchMedia(PHONE_HEADER_MEDIA));
