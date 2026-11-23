import { HOME_BUILD_DEFAULT } from './home';

/**
 * The home flag as the layout and the home page share it (TIN-8657).
 * It starts at the build default, which is off in production, and the layout
 * sets it after mount from the address and the remembered preference.
 */
export const homeFlag = $state({ on: HOME_BUILD_DEFAULT });
