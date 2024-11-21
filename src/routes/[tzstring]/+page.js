

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ params, url }) => {
  return {
    tzstring: params.tzstring,
    url: url,
  };
};