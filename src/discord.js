// Somente imagens do CDN do Discord são exibidas como foto de perfil.
const AVATAR = /^https:\/\/cdn\.discordapp\.com\/(avatars|embed\/avatars)\/[\w./-]+(\?[\w=&]*)?$/;
export const isDiscordAvatar = (url) => typeof url === 'string' && AVATAR.test(url);

// Lê nome e foto da identidade Discord da sessão; null quando a conta não usa Discord.
export function discordProfile(user) {
  const identity = user?.identities?.find((i) => i.provider === 'discord');
  if (!identity) return null;
  const data = identity.identity_data || {};
  const name = String(
    data.custom_claims?.global_name || data.full_name || data.name || 'Hunter',
  ).trim();
  return {
    nickname: name.length < 2 ? 'Hunter' : Array.from(name).slice(0, 32).join(''),
    avatar_url: isDiscordAvatar(data.avatar_url) ? data.avatar_url : null,
  };
}
