/**
 * Avatar du joueur, ou ses initiales à défaut.
 *
 * Les images ne sont pas servies depuis /public : elles vivent dans DATA_DIR,
 * derrière une route authentifiée, comme les sauvegardes.
 */
export function Avatar({
  user,
  size = 32,
}: {
  user: { id: string; pseudo: string; avatarPath: string | null };
  size?: number;
}) {
  if (user.avatarPath) {
    return (
      // Route dédiée plutôt que next/image : le fichier est déjà redimensionné
      // et converti en webp à l'envoi.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatar/${user.id}`}
        alt=""
        width={size}
        height={size}
        className="rounded-full border border-ink-700 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = user.pseudo
    .split(/[\s-_]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full border border-ink-700 bg-ink-800 font-semibold text-ink-200"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </span>
  );
}
