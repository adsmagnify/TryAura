/** Public ping endpoint for uptime monitors / keep-alive cron. */
export async function loader() {
  return Response.json({ ok: true, service: "tryaura-app" });
}
