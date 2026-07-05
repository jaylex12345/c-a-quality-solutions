exports.handler = async function handler() {
  const supabaseUrl = process.env.SUPABASE_URL || "";

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
    body: `window.CAQ_SUPABASE_URL = ${JSON.stringify(supabaseUrl)};`,
  };
};
