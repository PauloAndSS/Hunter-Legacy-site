import test from 'node:test';
import assert from 'node:assert/strict';
import { discordProfile, isDiscordAvatar } from '../src/discord.js';

const user = (identity_data) => ({ identities: [{ provider: 'discord', identity_data }] });

test('accepts only Discord CDN avatars', () => {
  assert.ok(isDiscordAvatar('https://cdn.discordapp.com/avatars/123/abc.png'));
  assert.ok(isDiscordAvatar('https://cdn.discordapp.com/avatars/123/a_bc.gif?size=256'));
  assert.ok(isDiscordAvatar('https://cdn.discordapp.com/embed/avatars/0.png'));
  for (const bad of [
    null,
    'http://cdn.discordapp.com/avatars/1/a.png',
    'https://cdn.discordapp.com.evil.test/avatars/1/a.png',
    'https://cdn.discordapp.com/attachments/1/a.png',
    'https://x.supabase.co/storage/v1/object/public/avatars/u/avatar.webp',
  ])
    assert.equal(isDiscordAvatar(bad), false);
});

test('reads name and avatar from the Discord identity', () => {
  const avatar_url = 'https://cdn.discordapp.com/avatars/1/a.png';
  assert.deepEqual(
    discordProfile(user({ avatar_url, full_name: 'gon', custom_claims: { global_name: 'Gon' } })),
    { nickname: 'Gon', avatar_url },
  );
  assert.equal(discordProfile(user({ full_name: 'x' })).nickname, 'Hunter');
  assert.equal(discordProfile(user({ full_name: 'a'.repeat(50) })).nickname.length, 32);
});

test('ignores accounts without Discord', () => {
  assert.equal(discordProfile({ identities: [{ provider: 'email' }] }), null);
  assert.equal(discordProfile(null), null);
});
