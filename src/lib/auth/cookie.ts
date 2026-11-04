/**
 * Nom du cookie de session, isolé dans son propre module.
 *
 * Le middleware tourne dans le runtime Edge, où ni SQLite ni le module de
 * session ne peuvent être chargés : il a besoin de cette constante seule.
 */
export const SESSION_COOKIE = "oe_session";
