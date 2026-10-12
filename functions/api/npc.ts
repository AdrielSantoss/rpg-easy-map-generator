import { passwordMatches } from '../../src/npc/auth.ts';
import {
  describeNpc,
  NPC_AGES,
  NPC_EXPRESSIONS,
  NPC_GENDERS,
  NPC_RACES,
  NPC_WEALTHS,
  type NpcAge,
  type NpcExpression,
  type NpcGender,
  type NpcRace,
  type NpcWealth,
} from '../../src/npc/prompt.ts';

/**
 * The only part of the site that runs on a server: it holds the password and
 * the access to the image model, so neither ever reaches the browser.
 *
 *   GET  /api/npc  -> 204 when the password is right (used to unlock the screen)
 *   POST /api/npc  -> one portrait for { race, gender, seed, age?, expression?, wealth? }
 *
 * Both need "Authorization: Bearer <password>".
 */

interface Env {
  /** Workers AI, bound in wrangler.toml. */
  AI: { run(model: string, input: Record<string, unknown>): Promise<{ image?: string }> };
  /** Set with `wrangler pages secret put NPC_PASSWORD`. Without it the tool is closed. */
  NPC_PASSWORD?: string;
}

interface Context {
  request: Request;
  env: Env;
}

const MODEL = '@cf/black-forest-labs/flux-1-schnell';
/** More steps cost more of the daily allowance; four is what this model is made for. */
const STEPS = 4;
/** How long a wrong password is kept waiting, in ms, to make guessing slow. */
const WRONG_PASSWORD_DELAY = 400;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function refuse({ request, env }: Context): Promise<Response | null> {
  const header = request.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (await passwordMatches(given, env.NPC_PASSWORD)) return null;
  await new Promise((resolve) => setTimeout(resolve, WRONG_PASSWORD_DELAY));
  return json({ error: 'Senha incorreta.' }, 401);
}

export async function onRequestGet(context: Context): Promise<Response> {
  return (
    (await refuse(context)) ?? new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
  );
}

export async function onRequestPost(context: Context): Promise<Response> {
  const refused = await refuse(context);
  if (refused) return refused;

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return json({ error: 'Pedido inválido.' }, 400);
  }
  // Only values from the fixed lists are accepted: the picture is described
  // here, from fixed lists, so the tool cannot be used to draw anything else.
  const { race, gender, seed, age, expression, wealth } = body;
  /** Left out means "let the seed choose"; anything else must be on the list. */
  const optional = (list: readonly string[], value: unknown) =>
    value === undefined || (typeof value === 'string' && list.includes(value));
  const known =
    NPC_RACES.includes(race as NpcRace) &&
    NPC_GENDERS.includes(gender as NpcGender) &&
    typeof seed === 'number' &&
    Number.isInteger(seed) &&
    seed >= 0 &&
    seed <= 0xffffffff &&
    optional(NPC_AGES, age) &&
    optional(NPC_EXPRESSIONS, expression) &&
    optional(NPC_WEALTHS, wealth);
  if (!known) return json({ error: 'Pedido inválido.' }, 400);

  // A deployment made without the binding in wrangler.toml has no model to call.
  if (!context.env.AI) return json({ error: 'A IA não está configurada neste servidor.' }, 503);

  const { prompt, summary } = describeNpc(race as NpcRace, gender as NpcGender, seed as number, {
    age: age as NpcAge | undefined,
    expression: expression as NpcExpression | undefined,
    wealth: wealth as NpcWealth | undefined,
  });
  try {
    // The model takes no seed: the seed only picks who is described, and the
    // same description is painted a little differently every time.
    const result = await context.env.AI.run(MODEL, { prompt, steps: STEPS });
    if (!result.image) throw new Error('the model returned no image');
    return json({ image: `data:image/jpeg;base64,${result.image}`, summary }, 200);
  } catch (error) {
    // Most often the free daily allowance has run out; it comes back at 00:00 UTC.
    console.error('npc generation failed', error);
    return json(
      { error: 'A IA não respondeu. A cota gratuita de hoje pode ter acabado; tente de novo mais tarde.' },
      503,
    );
  }
}
