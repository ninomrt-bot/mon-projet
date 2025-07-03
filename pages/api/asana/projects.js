// pages/api/asana/projects.js
import { Client } from "asana";

export default async function handler(req, res) {
  const accessToken = process.env.ASANA_PERSONAL_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: "Le token Asana n’est pas configuré." });
  }

  try {
    const client = Client.create().useAccessToken(accessToken);
    const response = await client.projects.getProjects({
      workspace: process.env.ASANA_WORKSPACE_GID,
      opt_fields: "gid,name,created_at,public",
    });
    return res.status(200).json(response.data || []);
  } catch (error) {
    console.error("Asana API error (projects):", error);
    return res.status(500).json({ error: "Impossible de récupérer les projets Asana." });
  }
}
