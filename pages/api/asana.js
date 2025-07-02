import fetch from "node-fetch";

export default async function handler(req, res) {
  const token = process.env.ASANA_PERSONAL_ACCESS_TOKEN;
  const projectGid = req.query.projectGid; // Assuming projectGid is passed as a query parameter
  if (!token || !projectGid) {
    return res.status(500).json({ error: "Token ou project GID manquant" });
  }

  const url = `https://app.asana.com/api/1.0/projects/${projectGid}/tasks?opt_fields=gid,name,assignee,completed,due_on,custom_fields`;
  const apiRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await apiRes.text();
  if (!apiRes.ok) return res.status(apiRes.status).json({ error: text });
  const { data } = JSON.parse(text);
  res.status(200).json(data);
}
